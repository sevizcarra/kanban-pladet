/**
 * POST /api/std-import
 *
 * Import STD documents into the Kanban as draft projects.
 * Reads std-documents from Firestore, classifies, groups by project,
 * and creates email-drafts for admin review.
 *
 * GET /api/std-import — preview what would be imported (dry run)
 */

import { NextResponse } from "next/server";
import { getSTDDocuments, createEmailDraft } from "@/lib/firestore";
import { groupMemosByProject, normalizeTitleForGrouping } from "@/lib/std-classifier";

export const maxDuration = 60;

// GET — preview import (no changes)
export async function GET() {
  try {
    const docs = await getSTDDocuments();
    const groups = groupMemosByProject(docs);

    // Also show filtered-out count
    const { classifySTDDocument } = await import("@/lib/std-classifier");
    const filtered = docs.filter(d => classifySTDDocument(d).filteredOut);

    return NextResponse.json({
      totalDocuments: docs.length,
      filteredOut: filtered.length,
      projectGroups: groups.length,
      groups: groups.map(g => ({
        title: cleanTitle(g.title),
        normalizedTitle: g.normalizedTitle,
        recinto: g.recinto || "—",
        memos: g.memos.map(m => ({ key: m.key, tipo: m.tipo })),
        tipoLicitacion: g.classification.tipoLicitacion || "—",
        categoriaProyecto: g.classification.categoriaProyecto || "—",
        dashboardType: g.classification.dashboardType,
        budget: g.budget || "—",
        codigoUsa: g.codigoUsa || "—",
        requestingUnit: g.requestingUnit,
      })),
      filteredExamples: filtered.slice(0, 10).map(d => ({
        memo: d.memoKey,
        asunto: d.asunto?.slice(0, 80),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

// POST — create drafts from STD documents
export async function POST() {
  const startTime = Date.now();

  try {
    const docs = await getSTDDocuments();
    const groups = groupMemosByProject(docs);

    let created = 0;
    let skipped = 0;

    for (const group of groups) {
      const title = cleanTitle(group.title);
      const primaryMemo = group.memos[0];

      // Build a rich description from the body
      const description = group.cuerpoDocumento
        ? group.cuerpoDocumento.slice(0, 400)
        : `Proyecto identificado desde STD — ${group.memos.length} memo(s) vinculado(s).`;

      // Build memo info for the draft detail
      const memoList = group.memos
        .map(m => `${m.key} (${m.tipo})`)
        .join(", ");

      try {
        await createEmailDraft({
          // Email-like fields (repurposed for STD import)
          from: "std-import@pladet.usach.cl",
          fromName: "Importación STD",
          subject: `[STD] ${title}`,
          body: description,
          emailDate: new Date().toISOString(),
          attachments: [],
          // Classification
          suggestedAction: "create_project",
          suggestedTitle: title,
          suggestedMemo: primaryMemo.key,
          suggestedUnit: mapToRequestingUnitCode(group.requestingUnit),
          suggestedPriority: "media",
          suggestedDashboardType: group.classification.dashboardType,
          suggestedCategory: group.classification.categoriaProyecto || "",
          suggestedSector: "",
          suggestedProjectRef: "",
          suggestedDetail: JSON.stringify({
            memos: group.memos,
            budget: group.budget,
            codigoUsa: group.codigoUsa,
            plazoEjecucion: group.plazoEjecucion,
            tipoLicitacion: group.classification.tipoLicitacion,
            recinto: group.recinto,
            dataSource: "std",
            stdAsunto: group.title,
          }),
          // Status
          status: "pending",
          createdAt: new Date().toISOString(),
        });
        created++;
      } catch (err) {
        console.error(`Failed to create draft for "${title}":`, err);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      totalDocuments: docs.length,
      projectGroups: groups.length,
      draftsCreated: created,
      skipped,
      duration: Date.now() - startTime,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

// ── Helpers ──

function cleanTitle(asunto: string): string {
  return asunto
    .replace(/^solicita?\s*(CDP\s*para\s*)?[""]?/i, "")
    .replace(/^licitaci[oó]n\s*l1\s*[""]?/i, "")
    .replace(/^cotizaci[oó]n\s*convenio\s*marco\s*(para\s*)?[""]?/i, "")
    .replace(/^compra\s*[aá]gil\s*/i, "")
    .replace(/[""]$/g, "")
    .trim() || asunto;
}

/**
 * Map full unit name from STD to the short code used in REQUESTING_UNITS.
 * E.g., "DEPARTAMENTO OPERATIVO DE COMPRAS Y LICITACIONES DE PRORRECTORIA" → "PRO"
 */
function mapToRequestingUnitCode(fullName: string): string {
  const upper = fullName.toUpperCase();
  if (upper.includes("PRORRECTOR")) return "PRO";
  if (upper.includes("RECTOR")) return "REC";
  if (upper.includes("VRAE")) return "VRAE";
  if (upper.includes("VINCULACI")) return "VIME";
  if (upper.includes("INVESTIGACI")) return "VRIIC";
  if (upper.includes("GESTI") && upper.includes("TECNOL")) return "VRIFYL";
  if (upper.includes("ARQUITECTURA")) return "FARAC";
  if (upper.includes("INGENIER")) return "FING";
  if (upper.includes("FACIMED") || upper.includes("CIENCIAS M")) return "FACIMED";
  if (upper.includes("CIENCIAS") && !upper.includes("MÉDICAS")) return "FACCM";
  if (upper.includes("DERECHO")) return "FADER";
  if (upper.includes("HUMANIDADES")) return "FAHU";
  if (upper.includes("ADMINISTRACI") && upper.includes("ECONOM")) return "FAE";
  if (upper.includes("TECNOL")) return "FACTEC";
  if (upper.includes("QU[IÍ]MICA") || upper.includes("BIOLOG")) return "FQYB";
  if (upper.includes("BACHILLERATO")) return "BACH";
  if (upper.includes("SECRETAR")) return "SECGEN";
  if (upper.includes("PROYECTOS ESTRATEG")) return "PRO";
  if (upper.includes("COMPRAS") && upper.includes("LICITACION")) return "PRO";
  return "";
}
