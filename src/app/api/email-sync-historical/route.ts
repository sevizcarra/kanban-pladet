/**
 * POST /api/email-sync-historical
 *
 * Processes ALL emails (read and unread) in batches.
 * Each email becomes a DRAFT for admin review.
 * Called repeatedly by the frontend with increasing offset.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchAllEmails } from "@/lib/email-reader";
import { classifyEmail } from "@/lib/email-processor";
import type { EmailAction } from "@/lib/email-processor";
import type { ParsedEmail } from "@/lib/email-reader";
import type { EmailDraft } from "@/lib/firestore";
import { collection, getDocs, query, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createEmailDraft, checkDuplicateDraft } from "@/lib/firestore";

const BATCH_SIZE = 30;

export async function POST(req: NextRequest) {
  // Auth: verify CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isAuth = (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    process.env.NODE_ENV === "development";
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.PLADET_APP_PASSWORD) {
    return NextResponse.json({ error: "PLADET_APP_PASSWORD not configured" }, { status: 500 });
  }

  let body: { offset?: number } = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine, default offset=0
  }

  const offset = body.offset || 0;

  try {
    // 1. Fetch batch of emails
    const { emails, total } = await fetchAllEmails(offset, BATCH_SIZE);

    if (emails.length === 0) {
      return NextResponse.json({
        done: true,
        offset,
        total,
        processed: 0,
        created: 0,
        skipped: 0,
        message: "No hay más correos por procesar",
      });
    }

    // 2. Get existing memo numbers for classification hints
    const existingMemos = await getExistingMemoNumbers();

    let created = 0;
    let skipped = 0;

    // 3. Process each email → save as draft
    for (const email of emails) {
      try {
        const emailDateStr = email.date ? email.date.toISOString() : new Date().toISOString();

        // Check for duplicate draft
        const isDuplicate = await checkDuplicateDraft(email.subject, email.from, emailDateStr);
        if (isDuplicate) {
          skipped++;
          continue;
        }

        // Classify email (for suggestions only)
        const action = classifyEmail(email, existingMemos);

        // Build and save draft
        const draft = buildDraftFromAction(email, action, emailDateStr);
        await createEmailDraft(draft);
        created++;
      } catch (err) {
        console.error(`Error processing historical email: ${email.subject}`, err);
        skipped++;
      }
    }

    // Save a log entry
    await addDoc(collection(db, "email-sync-log"), {
      timestamp: new Date().toISOString(),
      emailsRead: emails.length,
      actions: [
        {
          type: "info",
          detail: `Procesamiento histórico (borradores): lote ${Math.floor(offset / BATCH_SIZE) + 1} — ${created} borradores creados, ${skipped} ignorados`,
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
      commented: 0,
      skipped,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("Historical sync error:", err);
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

// ── Helpers ──

async function getExistingMemoNumbers(): Promise<string[]> {
  try {
    const q = query(collection(db, "projects"));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => d.data().memorandumNumber as string)
      .filter(Boolean);
  } catch {
    return [];
  }
}
