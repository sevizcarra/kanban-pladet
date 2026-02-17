/**
 * POST /api/email-sync-trigger
 *
 * Manual sync trigger from the UI.
 * Runs the sync logic directly (no internal fetch that could timeout).
 */

import { NextResponse } from "next/server";
import { fetchUnreadEmails } from "@/lib/email-reader";
import { classifyEmail } from "@/lib/email-processor";
import type { EmailAction } from "@/lib/email-processor";
import type { ParsedEmail } from "@/lib/email-reader";
import type { EmailDraft } from "@/lib/firestore";
import { collection, addDoc, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createEmailDraft, checkDuplicateDraft } from "@/lib/firestore";

export async function POST() {
  if (!process.env.PLADET_APP_PASSWORD) {
    return NextResponse.json({ error: "PLADET_APP_PASSWORD not configured" }, { status: 500 });
  }

  const startTime = Date.now();

  try {
    const emails = await fetchUnreadEmails(15);

    if (emails.length === 0) {
      await saveSyncLog({
        timestamp: new Date().toISOString(),
        emailsRead: 0,
        actions: [{ type: "info", detail: "No hay correos nuevos", success: true }],
        duration: Date.now() - startTime,
      });
      return NextResponse.json({ message: "No new emails", emailsRead: 0 });
    }

    const existingMemos = await getExistingMemoNumbers();
    const actions: { type: string; detail: string; success: boolean; error?: string }[] = [];
    let draftsCreated = 0;
    let skipped = 0;

    for (const email of emails) {
      try {
        const emailDateStr = email.date ? email.date.toISOString() : new Date().toISOString();
        const isDuplicate = await checkDuplicateDraft(email.subject, email.from, emailDateStr);
        if (isDuplicate) {
          actions.push({ type: "ignore", detail: `Duplicado: "${email.subject.slice(0, 60)}"`, success: true });
          skipped++;
          continue;
        }

        const action = classifyEmail(email, existingMemos);
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
          detail: `Error: ${email.subject}`,
          success: false,
          error: err instanceof Error ? err.message : "Unknown",
        });
      }
    }

    await saveSyncLog({
      timestamp: new Date().toISOString(),
      emailsRead: emails.length,
      actions,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({
      message: "Sync completed",
      emailsRead: emails.length,
      draftsCreated,
      skipped,
      duration: Date.now() - startTime,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    await saveSyncLog({
      timestamp: new Date().toISOString(),
      emailsRead: 0,
      actions: [{ type: "error", detail: errorMsg, success: false, error: errorMsg }],
      duration: Date.now() - startTime,
    });
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// ── Helpers ──

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

async function getExistingMemoNumbers(): Promise<string[]> {
  try {
    const q = query(collection(db, "projects"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data().memorandumNumber as string).filter(Boolean);
  } catch {
    return [];
  }
}

async function saveSyncLog(entry: {
  timestamp: string;
  emailsRead: number;
  actions: { type: string; detail: string; success: boolean; error?: string }[];
  duration: number;
}) {
  try {
    await addDoc(collection(db, "email-sync-log"), entry);
  } catch (err) {
    console.error("Error saving sync log:", err);
  }
}
