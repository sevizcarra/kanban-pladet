/**
 * POST /api/std-batch
 *
 * Two-phase batch processing of STD documents from emails.
 *
 * Phase "scan":  Read emails via IMAP, extract STD links, save to Firestore.
 *                Fast — only touches IMAP, no STD requests.
 *                Call repeatedly with increasing offset until done=true.
 *
 * Phase "scrape": Take unscraped links from Firestore, login to STD,
 *                 fetch documents, save enriched data.
 *                 Call repeatedly until done=true.
 *
 * Body: {
 *   phase: "scan" | "scrape",
 *   offset?: number,        // scan phase: email offset (default 0)
 *   batchSize?: number,     // scan phase: emails per call (default 50)
 *   scrapeLimit?: number    // scrape phase: docs per call (default 15)
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchAllEmails } from "@/lib/email-reader";
import {
  extractSTDLinks,
  extractMemoFromSubject,
  loginToSTD,
  fetchSTDDocument,
  extractProjectFromSTD,
} from "@/lib/std-scraper";
import {
  saveSTDLinks,
  getUnscrapedMemoKeys,
  markLinksScraped,
  getSTDLinkStats,
  saveSTDDocument,
  getSTDDocumentCount,
  getSTDDocuments,
} from "@/lib/firestore";
import type { STDLink } from "@/lib/firestore";

export const maxDuration = 60;

// GET /api/std-batch — return all scraped documents for analysis
export async function GET() {
  try {
    const docs = await getSTDDocuments();
    const stats = await getSTDLinkStats();
    return NextResponse.json({ documents: docs, stats, count: docs.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  if (!process.env.PLADET_APP_PASSWORD) {
    return NextResponse.json({ error: "PLADET_APP_PASSWORD not configured" }, { status: 500 });
  }

  let body: {
    phase?: string;
    offset?: number;
    batchSize?: number;
    scrapeLimit?: number;
  } = {};
  try {
    body = await req.json();
  } catch {
    // no body
  }

  const phase = body.phase || "scan";

  try {
    if (phase === "scan") {
      return await handleScan(body.offset ?? 0, body.batchSize ?? 50, startTime);
    } else if (phase === "scrape") {
      return await handleScrape(body.scrapeLimit ?? 15, startTime);
    } else {
      return NextResponse.json({ error: `Unknown phase: ${phase}` }, { status: 400 });
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: errorMsg, phase, duration: Date.now() - startTime },
      { status: 500 }
    );
  }
}

// ── Phase 1: Scan emails and extract STD links ──

async function handleScan(offset: number, batchSize: number, startTime: number) {
  // Cap at 500 emails max
  const safeBatchSize = Math.min(batchSize, 50);

  // Fetch emails
  const { emails, total } = await fetchAllEmails(offset, safeBatchSize);

  // Extract STD links from each email
  const linksToSave: Omit<STDLink, "id">[] = [];
  let emailsWithLinks = 0;

  for (const email of emails) {
    const urls = extractSTDLinks(email.htmlBody, email.body);
    if (urls.length === 0) continue;
    emailsWithLinks++;

    // Extract memo info from subject
    const memoInfo = extractMemoFromSubject(email.subject);

    for (const url of urls) {
      linksToSave.push({
        url,
        memoNumber: memoInfo?.number || "",
        memoPeriod: memoInfo?.period || "",
        memoKey: memoInfo?.key || `UNKNOWN_${email.uid}`,
        emailSubject: email.subject,
        emailFrom: email.from,
        emailDate: email.date?.toISOString() || "",
        emailUid: email.uid,
        emailType: memoInfo?.type || "otro",
        scrapedAt: null,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Save to Firestore
  const saved = linksToSave.length > 0 ? await saveSTDLinks(linksToSave) : 0;

  // Check if we're done (processed all 500 or reached end of mailbox)
  const nextOffset = offset + emails.length;
  const maxEmails = Math.min(total, 500); // Only process last 500
  const done = nextOffset >= maxEmails || emails.length === 0;

  // Get current stats
  const stats = await getSTDLinkStats();

  return NextResponse.json({
    phase: "scan",
    done,
    progress: {
      processed: nextOffset,
      total: maxEmails,
      emailsInBatch: emails.length,
      emailsWithLinks,
      newLinksFound: saved,
      uniqueMemosTotal: stats.uniqueMemos,
      totalLinksInDB: stats.total,
    },
    nextOffset: done ? null : nextOffset,
    duration: Date.now() - startTime,
  });
}

// ── Phase 2: Scrape STD documents ──

async function handleScrape(scrapeLimit: number, startTime: number) {
  if (!process.env.STD_PASS) {
    return NextResponse.json({ error: "STD_PASS not configured" }, { status: 500 });
  }

  const safeLimit = Math.min(scrapeLimit, 20);

  // Get unscraped memos
  const pending = await getUnscrapedMemoKeys();
  if (pending.length === 0) {
    const stats = await getSTDLinkStats();
    const docCount = await getSTDDocumentCount();
    return NextResponse.json({
      phase: "scrape",
      done: true,
      progress: {
        processed: 0,
        pending: 0,
        documentsScraped: 0,
        documentsFailed: 0,
        totalDocumentsInDB: docCount,
        uniqueMemosTotal: stats.uniqueMemos,
      },
      duration: Date.now() - startTime,
    });
  }

  // Login to STD
  const session = await loginToSTD();

  // Scrape documents
  const toScrape = pending.slice(0, safeLimit);
  let scraped = 0;
  let failed = 0;

  for (const { memoKey, url } of toScrape) {
    // Time budget: leave 8s margin for Firestore writes
    if (Date.now() - startTime > 48000) break;

    const doc = await fetchSTDDocument(url, session);
    if (doc) {
      const projectData = extractProjectFromSTD(doc);

      // Save to std-documents
      await saveSTDDocument(memoKey, {
        numero: doc.numero,
        periodo: doc.periodo,
        memoKey,
        asunto: doc.asunto,
        unidadRemitente: doc.unidadRemitente,
        unidadCreadora: doc.unidadCreadora,
        motivos: doc.motivos,
        cuerpoDocumento: doc.cuerpoDocumento.slice(0, 2000),
        budget: projectData.budget,
        codigoUsa: projectData.codigoUsa,
        plazoEjecucion: projectData.plazoEjecucion,
        historialExterno: doc.historialExterno,
        archivos: doc.archivos,
        sourceUrl: url,
        scrapedAt: new Date().toISOString(),
        emailCount: 0, // Will be computed later
      });

      // Mark all links for this memo as scraped
      await markLinksScraped(memoKey);
      scraped++;
    } else {
      failed++;
      // Still mark as scraped to avoid retrying broken links forever
      await markLinksScraped(memoKey);
    }
  }

  const stats = await getSTDLinkStats();
  const docCount = await getSTDDocumentCount();
  const remainingPending = pending.length - scraped - failed;

  return NextResponse.json({
    phase: "scrape",
    done: remainingPending <= 0,
    progress: {
      processed: scraped + failed,
      pending: remainingPending,
      documentsScraped: scraped,
      documentsFailed: failed,
      totalDocumentsInDB: docCount,
      uniqueMemosTotal: stats.uniqueMemos,
    },
    duration: Date.now() - startTime,
  });
}
