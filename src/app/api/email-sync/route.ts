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
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createEmailDraft, checkDuplicateDraft, saveSTDDocument } from "@/lib/firestore";
import {
  extractSTDLinks,
  extractMemoFromSubject,
  loginToSTD,
  fetchSTDDocument,
  extractProjectFromSTD,
} from "@/lib/std-scraper";
import type { STDDocumentData } from "@/lib/std-scraper";
import { classifySTDDocument } from "@/lib/std-classifier";

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

    // 2. Get existing project memo numbers for classification
    const existingProjects = await getExistingProjects();

    let draftsCreated = 0;
    let skipped = 0;

    // 3. Process each email → save as draft
    for (const email of emails) {
      try {
        // Check for duplicate draft
        const emailDateStr = email.date ? email.date.toISOString() : new Date().toISOString();
        const isDuplicate = await checkDuplicateDraft(email.subject, email.from, emailDateStr);
        if (isDuplicate) {
          actions.push({
            type: "ignore",
            detail: `Borrador duplicado: "${email.subject.slice(0, 60)}"`,
            success: true,
          });
          skipped++;
          continue;
        }

        // Classify email (for suggestions only)
        const action = classifyEmail(email, existingProjects);

        // Build draft from classification
        const draft = buildDraftFromAction(email, action, emailDateStr);

        // ── STD Enrichment: if this is an STD notification, scrape + classify ──
        const isSTDEmail = /std@usach|trazabilidad/i.test(email.from);
        if (isSTDEmail) {
          const enriched = await enrichDraftWithSTD(email, draft);
          if (enriched) {
            actions.push({
              type: "std_enriched",
              detail: `STD enriquecido: "${draft.suggestedTitle?.slice(0, 50)}" — ${draft.suggestedMemo}`,
              success: true,
            });
          }
        }

        await createEmailDraft(draft);
        draftsCreated++;

        actions.push({
          type: "create_draft",
          detail: `Borrador creado: "${email.subject.slice(0, 60)}" — sugerencia: ${action.type}`,
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

// ── STD Enrichment ──

import type { EmailAction, ProjectMatchData } from "@/lib/email-processor";
import type { ParsedEmail } from "@/lib/email-reader";
import type { EmailDraft } from "@/lib/firestore";

// Reuse STD session across emails in the same sync run
let cachedSTDSession: { cookies: string; csrfToken: string } | null = null;

/**
 * Enrich a draft with STD data by scraping the linked document.
 * Mutates the draft object in place. Returns true if enriched.
 */
async function enrichDraftWithSTD(
  email: ParsedEmail,
  draft: Omit<EmailDraft, "id">
): Promise<boolean> {
  try {
    // 1. Extract STD link from email
    const links = extractSTDLinks(email.htmlBody || "", email.body || "");
    if (links.length === 0) return false;

    // 2. Extract memo info from subject
    const memoInfo = extractMemoFromSubject(email.subject);

    // 3. Login to STD (reuse session)
    if (!cachedSTDSession) {
      cachedSTDSession = await loginToSTD();
    }

    // 4. Scrape the first STD link
    const stdDoc = await fetchSTDDocument(links[0], cachedSTDSession);
    if (!stdDoc) {
      // Session might have expired, retry once
      cachedSTDSession = await loginToSTD();
      const retryDoc = await fetchSTDDocument(links[0], cachedSTDSession);
      if (!retryDoc) return false;
      return applySTDEnrichment(draft, retryDoc, memoInfo, email);
    }

    return applySTDEnrichment(draft, stdDoc, memoInfo, email);
  } catch (err) {
    console.error("STD enrichment failed:", err);
    return false;
  }
}

/**
 * Apply STD document data to the draft fields.
 */
function applySTDEnrichment(
  draft: Omit<EmailDraft, "id">,
  stdDoc: STDDocumentData,
  memoInfo: ReturnType<typeof extractMemoFromSubject>,
  email: ParsedEmail
): boolean {
  // Extract structured project data
  const projectData = extractProjectFromSTD(stdDoc);

  // Build the STDDocumentRecord to save to Firestore
  const memoKey = memoInfo?.key || `MEM-${stdDoc.periodo}-${stdDoc.numero}`;
  const docRecord = {
    memoKey,
    numero: stdDoc.numero,
    periodo: stdDoc.periodo,
    asunto: stdDoc.asunto,
    unidadRemitente: stdDoc.unidadRemitente,
    unidadCreadora: stdDoc.unidadCreadora,
    cuerpoDocumento: stdDoc.cuerpoDocumento?.slice(0, 3000) || "",
    budget: projectData.budget,
    codigoUsa: projectData.codigoUsa,
    plazoEjecucion: projectData.plazoEjecucion,
    archivos: stdDoc.archivos,
    sourceUrl: stdDoc.sourceUrl,
    scrapedAt: new Date().toISOString(),
  };

  // Save to std-documents collection (fire and forget)
  saveSTDDocument(memoKey, {
    ...docRecord,
    motivos: [],
    historialExterno: [],
    emailCount: 1,
  } as Omit<import("@/lib/firestore").STDDocumentRecord, "id">).catch(err =>
    console.error("Failed to save STD doc:", err)
  );

  // Classify using STD classifier
  const classification = classifySTDDocument(docRecord as Parameters<typeof classifySTDDocument>[0]);

  // Enrich the draft
  draft.suggestedTitle = projectData.title;
  draft.suggestedMemo = memoKey;
  if (stdDoc.unidadRemitente) {
    draft.suggestedUnit = mapToUnitCode(stdDoc.unidadRemitente);
  }
  if (classification.categoriaProyecto) {
    draft.suggestedCategory = classification.categoriaProyecto;
  }
  draft.suggestedDashboardType = classification.dashboardType;

  // If classifier says filter out → suggest ignore
  if (classification.filteredOut) {
    draft.suggestedAction = "ignore";
    draft.suggestedDetail = JSON.stringify({
      filterReason: classification.filterReason,
      dataSource: "std",
      stdAsunto: stdDoc.asunto,
    });
    return true;
  }

  // For relevant docs, override action to create_project if no match
  if (draft.suggestedAction !== "add_comment" && draft.suggestedAction !== "update_status") {
    draft.suggestedAction = "create_project";
  }

  // Store enriched data in suggestedDetail as JSON
  draft.suggestedDetail = JSON.stringify({
    memos: [{
      key: memoKey,
      tipo: classification.memoTipo,
      asunto: stdDoc.asunto,
      fecha: email.date?.toISOString() || new Date().toISOString(),
    }],
    budget: projectData.budget,
    codigoUsa: projectData.codigoUsa,
    plazoEjecucion: projectData.plazoEjecucion,
    tipoLicitacion: classification.tipoLicitacion,
    categoriaProyecto: classification.categoriaProyecto,
    memoTipo: classification.memoTipo,
    dataSource: "std",
    stdAsunto: stdDoc.asunto,
    stdCuerpoDoc: stdDoc.cuerpoDocumento?.slice(0, 500) || "",
  });

  return true;
}

/** Map full STD unit name to short code */
function mapToUnitCode(fullName: string): string {
  const upper = fullName.toUpperCase();
  if (upper.includes("PRORRECTOR")) return "PRO";
  if (upper.includes("RECTOR")) return "REC";
  if (upper.includes("VRAE")) return "VRAE";
  if (upper.includes("VINCULACI")) return "VIME";
  if (upper.includes("INVESTIGACI")) return "VRIIC";
  if (upper.includes("ARQUITECTURA")) return "FARAC";
  if (upper.includes("INGENIER")) return "FING";
  if (upper.includes("FACIMED") || upper.includes("CIENCIAS M")) return "FACIMED";
  if (upper.includes("HUMANIDADES")) return "FAHU";
  if (upper.includes("ADMINISTRACI") && upper.includes("ECONOM")) return "FAE";
  if (upper.includes("TECNOL")) return "FACTEC";
  if (upper.includes("COMPRAS") && upper.includes("LICITACION")) return "PRO";
  if (upper.includes("PLANIFICACION") || upper.includes("DESARROLLO TERRITORIAL")) return "PRO";
  return "";
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
