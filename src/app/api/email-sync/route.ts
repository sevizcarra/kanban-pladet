/**
 * POST /api/email-sync
 *
 * Cron endpoint: reads unread emails from pladet@usach.cl,
 * classifies them, and:
 *   - For matched projects: AUTO-APPLIES updates (status changes, comments)
 *   - For new projects: saves as DRAFTS for admin review
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchUnreadEmails } from "@/lib/email-reader";
import { classifyEmail, detectStatusAdvance } from "@/lib/email-processor";
import type { EmailAction, ProjectMatchData } from "@/lib/email-processor";
import type { ParsedEmail } from "@/lib/email-reader";
import type { EmailDraft } from "@/lib/firestore";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  createEmailDraft,
  checkDuplicateDraft,
  updateProject,
  addComment,
} from "@/lib/firestore";

const SYNC_LOG_COLLECTION = "email-sync-log";

interface SyncLogEntry {
  timestamp: string;
  emailsRead: number;
  actions: {
    type: string;
    detail: string;
    success: boolean;
    error?: string;
  }[];
  duration: number;
}

// Verify cron secret or admin auth
function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (cronSecret && secret === cronSecret) return true;

  if (process.env.NODE_ENV === "development") return true;

  return false;
}

export async function GET(req: NextRequest) {
  return handleSync(req);
}

export async function POST(req: NextRequest) {
  return handleSync(req);
}

async function handleSync(req: NextRequest) {
  const startTime = Date.now();

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.PLADET_APP_PASSWORD) {
    return NextResponse.json(
      { error: "PLADET_APP_PASSWORD not configured" },
      { status: 500 }
    );
  }

  const actions: SyncLogEntry["actions"] = [];

  try {
    // 1. Fetch unread emails
    const emails = await fetchUnreadEmails(15);

    if (emails.length === 0) {
      const logEntry: SyncLogEntry = {
        timestamp: new Date().toISOString(),
        emailsRead: 0,
        actions: [{ type: "info", detail: "No hay correos nuevos", success: true }],
        duration: Date.now() - startTime,
      };
      await saveSyncLog(logEntry);
      return NextResponse.json({ message: "No new emails", emailsRead: 0 });
    }

    // 2. Get existing projects (with current status for auto-advance)
    const existingProjects = await getExistingProjects();

    let draftsCreated = 0;
    let autoApplied = 0;
    let skipped = 0;

    // 3. Process each email
    for (const email of emails) {
      try {
        const emailDateStr = email.date ? email.date.toISOString() : new Date().toISOString();
        const isDuplicate = await checkDuplicateDraft(email.subject, email.from, emailDateStr);
        if (isDuplicate) {
          actions.push({
            type: "ignore",
            detail: `Duplicado: "${email.subject.slice(0, 60)}"`,
            success: true,
          });
          skipped++;
          continue;
        }

        // Classify email
        const action = classifyEmail(email, existingProjects);

        // ── AUTO-APPLY for matched projects ──
        if (action.type === "update_status" || action.type === "add_comment" || action.type === "attach_document") {
          const applied = await autoApplyAction(email, action, existingProjects);
          if (applied) {
            // Save draft as "auto_applied" for audit trail
            const draft = buildDraftFromAction(email, action, emailDateStr);
            draft.status = "approved" as const;
            await createEmailDraft(draft);
            autoApplied++;
            actions.push({
              type: "auto_apply",
              detail: `Auto-aplicado: ${action.type} — "${email.subject.slice(0, 50)}"`,
              success: true,
            });
            continue;
          }
        }

        // ── DRAFT for new projects or unmatched emails ──
        const draft = buildDraftFromAction(email, action, emailDateStr);
        await createEmailDraft(draft);
        draftsCreated++;

        actions.push({
          type: "create_draft",
          detail: `Borrador: "${email.subject.slice(0, 60)}" — sugerencia: ${action.type}`,
          success: true,
        });
      } catch (err) {
        actions.push({
          type: "error",
          detail: `Error procesando: ${email.subject}`,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // 4. Save sync log
    const logEntry: SyncLogEntry = {
      timestamp: new Date().toISOString(),
      emailsRead: emails.length,
      actions,
      duration: Date.now() - startTime,
    };
    await saveSyncLog(logEntry);

    return NextResponse.json({
      message: "Sync completed",
      emailsRead: emails.length,
      draftsCreated,
      autoApplied,
      skipped,
      duration: logEntry.duration,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    const logEntry: SyncLogEntry = {
      timestamp: new Date().toISOString(),
      emailsRead: 0,
      actions: [{ type: "error", detail: errorMsg, success: false, error: errorMsg }],
      duration: Date.now() - startTime,
    };
    await saveSyncLog(logEntry);

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// ── Auto-apply action to an existing project ──

async function autoApplyAction(
  email: ParsedEmail,
  action: EmailAction,
  existingProjects: ProjectMatchData[]
): Promise<boolean> {
  try {
    if (action.type === "update_status") {
      const project = existingProjects.find(p => p.id === action.projectRef);
      if (!project) return false;

      // Use detectStatusAdvance to ensure we only move forward
      const fullText = `${email.subject} ${email.body}`;
      const newStatus = detectStatusAdvance(fullText, project.status || "recepcion_requerimiento");

      if (newStatus) {
        // Update project status
        await updateProject(action.projectRef, { status: newStatus });

        // Add comment documenting the change
        await addComment(action.projectRef, {
          authorEmail: "pladet@usach.cl",
          content: `🤖 **Avance automático** → ${getStatusLabel(newStatus)}\n\nDetectado en correo de ${email.fromName || email.from}:\n"${email.subject}"\n\nMotivo: ${action.reason}`,
          mentions: [],
          createdAt: new Date().toISOString(),
        });
        return true;
      }

      // No status advance but still an update_status action — add as comment instead
      await addComment(action.projectRef, {
        authorEmail: "pladet@usach.cl",
        content: `📧 **${email.fromName || email.from}** — ${email.subject}\n\n${(email.body || "").slice(0, 500)}`,
        mentions: [],
        createdAt: new Date().toISOString(),
      });
      return true;
    }

    if (action.type === "add_comment") {
      await addComment(action.projectRef, {
        authorEmail: "pladet@usach.cl",
        content: `📧 **${email.fromName || email.from}** — ${email.subject}\n\n${(email.body || "").slice(0, 500)}`,
        mentions: [],
        createdAt: new Date().toISOString(),
      });
      return true;
    }

    if (action.type === "attach_document") {
      await addComment(action.projectRef, {
        authorEmail: "pladet@usach.cl",
        content: `📎 **Documento detectado** — ${action.docType}: ${action.filename}\n\nDe: ${email.fromName || email.from}\nAsunto: ${email.subject}`,
        mentions: [],
        createdAt: new Date().toISOString(),
      });
      return true;
    }

    return false;
  } catch (err) {
    console.error("Error auto-applying action:", err);
    return false;
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    recepcion_requerimiento: "Recepción Requerimiento",
    asignacion_profesional: "En Asignación de Profesional",
    en_diseno: "En Diseño",
    gestion_compra: "En Gestión de Compra",
    coordinacion_ejecucion: "En Coord. de Ejecución",
    en_ejecucion: "En Ejecución",
    terminada: "Terminada",
  };
  return labels[status] || status;
}

// ── Build draft from classification ──

function buildDraftFromAction(
  email: ParsedEmail,
  action: EmailAction,
  emailDateStr: string
): Omit<EmailDraft, "id"> {
  const base: Omit<EmailDraft, "id"> = {
    from: email.from,
    fromName: email.fromName,
    subject: email.subject,
    body: email.body.slice(0, 2000),
    emailDate: emailDateStr,
    attachments: email.attachments,
    suggestedAction: action.type,
    suggestedTitle: "",
    suggestedMemo: "",
    suggestedUnit: "",
    suggestedPriority: "media",
    suggestedDashboardType: "compras",
    suggestedCategory: "",
    suggestedSector: "",
    suggestedProjectRef: "",
    suggestedDetail: "",
    suggestedStatus: "recepcion_requerimiento",
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  switch (action.type) {
    case "create_project":
      base.suggestedTitle = action.data.title;
      base.suggestedMemo = action.data.memorandumNumber;
      base.suggestedUnit = action.data.requestingUnit;
      base.suggestedPriority = action.data.priority;
      base.suggestedDashboardType = action.data.dashboardType;
      base.suggestedCategory = action.data.categoriaProyecto;
      base.suggestedSector = action.data.sector;
      base.suggestedDetail = action.data.description;
      base.suggestedStatus = action.data.detectedStatus;
      break;

    case "add_comment":
      base.suggestedProjectRef = action.projectRef;
      base.suggestedDetail = action.comment;
      base.suggestedTitle = email.subject;
      break;

    case "update_status":
      base.suggestedProjectRef = action.projectRef;
      base.suggestedDetail = `${action.reason} → ${action.newStatus}`;
      base.suggestedTitle = email.subject;
      base.suggestedStatus = action.newStatus;
      break;

    case "attach_document":
      base.suggestedProjectRef = action.projectRef;
      base.suggestedDetail = `${action.docType}: ${action.filename}`;
      base.suggestedTitle = email.subject;
      break;

    case "ignore":
      base.suggestedDetail = action.reason;
      base.suggestedTitle = email.subject;
      break;
  }

  return base;
}

// ── Firestore helpers ──

async function getExistingProjects(): Promise<ProjectMatchData[]> {
  try {
    const q = query(collection(db, "projects"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        memorandumNumber: data.memorandumNumber || "",
        title: data.title || "",
        requestingUnit: data.requestingUnit || "",
        contactEmail: data.contactEmail || "",
        contactName: data.contactName || "",
        sector: data.sector || "",
        status: data.status || "recepcion_requerimiento",
        idLicitacion: data.idLicitacion,
        codigoProyectoDCI: data.codigoProyectoDCI,
        codigoProyectoUsa: data.codigoProyectoUsa,
      } as ProjectMatchData;
    });
  } catch {
    return [];
  }
}

async function saveSyncLog(entry: SyncLogEntry): Promise<void> {
  try {
    await addDoc(collection(db, SYNC_LOG_COLLECTION), entry);
  } catch (err) {
    console.error("Error saving sync log:", err);
  }
}

// ── Public: get recent sync logs (for dashboard) ──
export async function getRecentSyncLogs(count = 10) {
  try {
    const q = query(
      collection(db, SYNC_LOG_COLLECTION),
      orderBy("timestamp", "desc"),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}
