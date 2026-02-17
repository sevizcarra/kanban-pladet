/**
 * POST /api/email-sync-historical-trigger
 *
 * Proxy for historical email processing.
 * Same logic as email-sync-historical but called directly from UI.
 * Auto-applies matched projects, drafts for new ones.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchAllEmails } from "@/lib/email-reader";
import { classifyEmail, detectStatusAdvance } from "@/lib/email-processor";
import type { EmailAction, ProjectMatchData } from "@/lib/email-processor";
import type { ParsedEmail } from "@/lib/email-reader";
import type { EmailDraft } from "@/lib/firestore";
import { collection, getDocs, query, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  createEmailDraft,
  checkDuplicateDraft,
  updateProject,
  addComment,
} from "@/lib/firestore";

const BATCH_SIZE = 30;

export async function POST(req: NextRequest) {
  if (!process.env.PLADET_APP_PASSWORD) {
    return NextResponse.json({ error: "PLADET_APP_PASSWORD not configured" }, { status: 500 });
  }

  let body: { offset?: number } = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine
  }

  const offset = body.offset || 0;

  try {
    const { emails, total } = await fetchAllEmails(offset, BATCH_SIZE);

    if (emails.length === 0) {
      return NextResponse.json({
        done: true,
        offset,
        total,
        processed: 0,
        created: 0,
        autoApplied: 0,
        skipped: 0,
        message: "No hay más correos por procesar",
      });
    }

    const existingProjects = await getExistingProjects();

    let created = 0;
    let autoApplied = 0;
    let skipped = 0;

    for (const email of emails) {
      try {
        const emailDateStr = email.date ? email.date.toISOString() : new Date().toISOString();

        const isDuplicate = await checkDuplicateDraft(email.subject, email.from, emailDateStr);
        if (isDuplicate) {
          skipped++;
          continue;
        }

        const action = classifyEmail(email, existingProjects);

        // ── AUTO-APPLY for matched projects ──
        if (action.type === "update_status" || action.type === "add_comment" || action.type === "attach_document") {
          const applied = await autoApplyAction(email, action, existingProjects);
          if (applied) {
            const draft = buildDraftFromAction(email, action, emailDateStr);
            draft.status = "approved" as const;
            await createEmailDraft(draft);
            autoApplied++;
            continue;
          }
        }

        const draft = buildDraftFromAction(email, action, emailDateStr);
        await createEmailDraft(draft);
        created++;
      } catch (err) {
        console.error(`Error processing email: ${email.subject}`, err);
        skipped++;
      }
    }

    await addDoc(collection(db, "email-sync-log"), {
      timestamp: new Date().toISOString(),
      emailsRead: emails.length,
      actions: [
        {
          type: "info",
          detail: `Histórico lote ${Math.floor(offset / BATCH_SIZE) + 1} — ${created} borradores, ${autoApplied} auto-aplicados, ${skipped} ignorados`,
          success: true,
        },
      ],
      duration: 0,
    });

    const nextOffset = offset + BATCH_SIZE;
    const done = nextOffset >= total;

    return NextResponse.json({
      done,
      offset,
      nextOffset: done ? null : nextOffset,
      total,
      processed: emails.length,
      created,
      autoApplied,
      commented: 0,
      skipped,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("Historical sync error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// ── Auto-apply action to existing project ──

async function autoApplyAction(
  email: ParsedEmail,
  action: EmailAction,
  existingProjects: ProjectMatchData[]
): Promise<boolean> {
  try {
    if (action.type === "update_status") {
      const project = existingProjects.find(p => p.id === action.projectRef);
      if (!project) return false;

      const fullText = `${email.subject} ${email.body}`;
      const newStatus = detectStatusAdvance(fullText, project.status || "recepcion_requerimiento");

      if (newStatus) {
        await updateProject(action.projectRef, { status: newStatus });
        await addComment(action.projectRef, {
          authorEmail: "pladet@usach.cl",
          content: `🤖 **Avance automático** → ${getStatusLabel(newStatus)}\n\nDetectado en correo de ${email.fromName || email.from}:\n"${email.subject}"\n\nMotivo: ${action.reason}`,
          mentions: [],
          createdAt: new Date().toISOString(),
        });
        return true;
      }

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
