/**
 * POST /api/email-sync
 *
 * Cron endpoint: reads unread emails from pladet@usach.cl,
 * classifies them, and saves them as DRAFTS for admin review.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchUnreadEmails } from "@/lib/email-reader";
import { classifyEmail } from "@/lib/email-processor";
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
import { createEmailDraft, checkDuplicateDraft } from "@/lib/firestore";

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

    // 2. Get existing projects for classification
    const existingProjects = await getExistingProjects();

    let draftsCreated = 0;
    let skipped = 0;

    // 3. Process each email → save as draft
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

        // Classify email (for suggestions only)
        const action = classifyEmail(email, existingProjects);

        // Save as draft for admin review
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
      message: "Sync completed — drafts created",
      emailsRead: emails.length,
      draftsCreated,
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
