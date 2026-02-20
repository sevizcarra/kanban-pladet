/**
 * POST /api/std-test
 *
 * Test endpoint: reads the last N emails, extracts STD links,
 * logs into STD, scrapes document details, and generates a report
 * of what Kanban cards could be built from the enriched data.
 *
 * Body: { count?: number } — how many emails to scan (default 50)
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchAllEmails } from "@/lib/email-reader";
import {
  extractSTDLinks,
  loginToSTD,
  fetchSTDDocument,
  extractProjectFromSTD,
} from "@/lib/std-scraper";
import type { STDDocumentData, STDLinkInfo } from "@/lib/std-scraper";

export const maxDuration = 60; // Vercel max for hobby

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Optional: require auth
  if (!process.env.PLADET_APP_PASSWORD) {
    return NextResponse.json(
      { error: "PLADET_APP_PASSWORD not configured" },
      { status: 500 }
    );
  }

  if (!process.env.STD_PASS) {
    return NextResponse.json(
      { error: "STD_PASS not configured — add STD_PASS=Usach2026 to env" },
      { status: 500 }
    );
  }

  let body: { count?: number } = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine
  }

  const emailCount = Math.min(body.count || 50, 100);

  try {
    // 1. Fetch emails
    const { emails, total } = await fetchAllEmails(0, emailCount);

    // 2. Extract STD links from each email
    const allLinks: STDLinkInfo[] = [];
    const emailsWithLinks: number[] = [];
    const emailsWithoutLinks: string[] = [];

    for (const email of emails) {
      const links = extractSTDLinks(email.htmlBody, email.body);
      if (links.length > 0) {
        emailsWithLinks.push(email.uid);
        for (const url of links) {
          allLinks.push({
            url,
            emailSubject: email.subject,
            emailFrom: email.from,
            emailDate: email.date?.toISOString() || "",
          });
        }
      } else {
        emailsWithoutLinks.push(
          `${email.subject.slice(0, 60)} (${email.from})`
        );
      }
    }

    // Deduplicate links by URL
    const uniqueLinks = Array.from(
      new Map(allLinks.map((l) => [l.url, l])).values()
    );

    // 3. Login to STD
    let session;
    try {
      session = await loginToSTD();
    } catch (loginErr) {
      return NextResponse.json({
        phase: "login_failed",
        error:
          loginErr instanceof Error ? loginErr.message : "STD login failed",
        emailsScanned: emails.length,
        totalEmails: total,
        stdLinksFound: uniqueLinks.length,
        sampleLinks: uniqueLinks.slice(0, 5).map((l) => ({
          url: l.url.slice(0, 100) + "...",
          emailSubject: l.emailSubject.slice(0, 60),
        })),
        duration: Date.now() - startTime,
      });
    }

    // 4. Fetch each STD document (limit to 10 to avoid timeouts)
    const docsToFetch = uniqueLinks.slice(0, 10);
    const fetchedDocs: (STDDocumentData | null)[] = [];
    const projectCards: {
      title: string;
      memorandumNumber: string;
      requestingUnit: string;
      budget: string;
      codigoUsa: string;
      status: string;
      asuntoOriginal: string;
      historialEntries: number;
      emailSubject: string;
    }[] = [];

    for (const link of docsToFetch) {
      // Check time budget — leave 5s margin
      if (Date.now() - startTime > 50000) {
        break;
      }

      const doc = await fetchSTDDocument(link.url, session);
      fetchedDocs.push(doc);

      if (doc) {
        const projectData = extractProjectFromSTD(doc);
        projectCards.push({
          title: projectData.title,
          memorandumNumber: projectData.memorandumNumber,
          requestingUnit: projectData.requestingUnit,
          budget: projectData.budget,
          codigoUsa: projectData.codigoUsa,
          status: projectData.status,
          asuntoOriginal: doc.asunto.slice(0, 100),
          historialEntries: doc.historialExterno.length,
          emailSubject: link.emailSubject.slice(0, 80),
        });
      }
    }

    // 5. Generate report
    return NextResponse.json({
      report: {
        emailsScanned: emails.length,
        totalInMailbox: total,
        emailsWithSTDLinks: emailsWithLinks.length,
        emailsWithoutSTDLinks: emailsWithoutLinks.length,
        uniqueSTDLinks: uniqueLinks.length,
        documentsFetched: fetchedDocs.filter(Boolean).length,
        documentsFailed: fetchedDocs.filter((d) => !d).length,
      },
      projectCards,
      allSTDLinks: uniqueLinks.map((l) => ({
        url: l.url.slice(0, 120) + "...",
        emailSubject: l.emailSubject.slice(0, 80),
        emailFrom: l.emailFrom,
        emailDate: l.emailDate,
      })),
      emailsWithoutLinks: emailsWithoutLinks.slice(0, 20),
      duration: Date.now() - startTime,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: errorMsg, duration: Date.now() - startTime },
      { status: 500 }
    );
  }
}
