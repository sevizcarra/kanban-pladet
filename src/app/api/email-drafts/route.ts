/**
 * /api/email-drafts
 *
 * GET  — returns pending drafts (or all if ?all=true)
 * POST — approve a draft (creates project or adds comment)
 * DELETE — dismiss a draft
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getPendingDrafts,
  getAllDrafts,
  countDrafts,
  updateEmailDraft,
  dismissMultipleDrafts,
  dismissAllPendingDrafts,
  createProject,
  addComment,
} from "@/lib/firestore";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const showAll = url.searchParams.get("all") === "true";
    const debug = url.searchParams.get("debug") === "true";

    if (debug) {
      // Debug endpoint to check what's in Firestore
      const counts = await countDrafts();
      const allDrafts = await getAllDrafts(5);
      return NextResponse.json({
        counts,
        sampleDrafts: allDrafts.map(d => ({
          id: d.id,
          subject: d.subject?.slice(0, 60),
          status: d.status,
          from: d.from,
          emailDate: d.emailDate,
        })),
      });
    }

    const drafts = showAll ? await getAllDrafts() : await getPendingDrafts();
    return NextResponse.json(drafts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : "";
    console.error("GET /api/email-drafts error:", msg, stack);
    return NextResponse.json({ error: msg, stack }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      draftId,
      draftIds,       // array of IDs for group approval
      draftsData,     // array of { id, from, fromName, subject, body, emailDate } for group
      // Editable fields the admin may have modified
      title,
      memorandumNumber,
      requestingUnit,
      priority,
      dashboardType,
      categoriaProyecto,
      sector,
      description,
      contactName,
      contactEmail,
    } = body;

    // ── GROUP APPROVAL ──
    if (draftIds && Array.isArray(draftIds) && draftIds.length > 0) {
      const emails: { from: string; fromName: string; subject: string; body: string; emailDate: string; suggestedDetail?: string }[] = draftsData || [];

      // Build a compiled description from all emails
      const compiledEmails = emails
        .sort((a: { emailDate: string }, b: { emailDate: string }) => new Date(a.emailDate).getTime() - new Date(b.emailDate).getTime())
        .map((e: { fromName: string; from: string; subject: string; emailDate: string; body: string }, i: number) => {
          const date = new Date(e.emailDate).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
          return `[${i + 1}] ${date} — ${e.fromName || e.from}\nAsunto: ${e.subject}\n${(e.body || "").slice(0, 300)}`;
        })
        .join("\n\n---\n\n");

      // Unique senders
      const senders = Array.from(new Set(emails.map((e: { fromName: string; from: string }) => e.fromName || e.from)));

      // Check for STD enrichment from any draft in the group
      const stdEnrichment = body.suggestedDetail
        ? parseSTDDetail(body.suggestedDetail)
        : emails.map((e: { suggestedDetail?: string }) => e.suggestedDetail).filter(Boolean).map(d => parseSTDDetail(d!)).find(d => d !== null) || null;

      // Merge memos from all enriched drafts in the group
      const allMemos: unknown[] = [];
      for (const e of emails) {
        if (e.suggestedDetail) {
          const parsed = parseSTDDetail(e.suggestedDetail);
          if (parsed?.memos) allMemos.push(...parsed.memos);
        }
      }

      // Create project
      const projectData: Record<string, unknown> = {
        title: title || "Sin título",
        description: description || "",
        status: "recepcion_requerimiento",
        priority: priority || "media",
        memorandumNumber: memorandumNumber || "",
        requestingUnit: requestingUnit || "",
        contactName: contactName || senders[0] || "",
        contactEmail: contactEmail || (emails[0]?.from || ""),
        budget: stdEnrichment?.budget || "0",
        dueDate: null,
        tipoFinanciamiento: null,
        codigoProyectoUsa: stdEnrichment?.codigoUsa || "",
        tipoDesarrollo: "",
        disciplinaLider: "",
        sector: sector || "",
        categoriaProyecto: categoriaProyecto || "",
        dashboardType: dashboardType || "compras",
        createdAt: new Date().toISOString(),
        commentCount: 1,
      };

      // Add STD-enriched fields if available
      if (stdEnrichment) {
        projectData.dataSource = "std";
        if (stdEnrichment.tipoLicitacion) projectData.tipoLicitacion = stdEnrichment.tipoLicitacion;
        if (allMemos.length > 0) projectData.memos = allMemos;
        if (stdEnrichment.stdAsunto) projectData.stdAsunto = stdEnrichment.stdAsunto;
        if (stdEnrichment.plazoEjecucion) projectData.plazoEjecucion = stdEnrichment.plazoEjecucion;
      }

      const newProjectId = await createProject(projectData as Parameters<typeof createProject>[0]);

      // Add compiled comment with all emails
      const commentContent = [
        `📧 **Tarjeta compilada desde ${draftIds.length} correos**`,
        `Remitentes: ${senders.join(", ")}`,
        "",
        compiledEmails.slice(0, 3000),
      ].join("\n");

      await addComment(newProjectId, {
        authorEmail: "pladet@usach.cl",
        content: commentContent,
        mentions: [],
        createdAt: new Date().toISOString(),
      });

      // Mark all drafts as approved
      const now = new Date().toISOString();
      for (const id of draftIds) {
        await updateEmailDraft(id, {
          status: "approved",
          approvedProjectId: newProjectId,
          reviewedAt: now,
        });
      }

      return NextResponse.json({
        success: true,
        projectId: newProjectId,
        approvedCount: draftIds.length,
        message: `Grupo aprobado: ${draftIds.length} correos → 1 tarjeta`,
      });
    }

    // ── SINGLE APPROVAL ──
    if (!draftId) {
      return NextResponse.json({ error: "draftId or draftIds required" }, { status: 400 });
    }

    // Check if suggestedDetail contains STD enrichment data
    const stdEnrichment = body.suggestedDetail ? parseSTDDetail(body.suggestedDetail) : null;

    // Create the project in Firestore
    const projectData: Record<string, unknown> = {
      title: title || "Sin título",
      description: description || "",
      status: "recepcion_requerimiento",
      priority: priority || "media",
      memorandumNumber: memorandumNumber || "",
      requestingUnit: requestingUnit || "",
      contactName: contactName || "",
      contactEmail: contactEmail || "",
      budget: stdEnrichment?.budget || "0",
      dueDate: null,
      tipoFinanciamiento: null,
      codigoProyectoUsa: stdEnrichment?.codigoUsa || "",
      tipoDesarrollo: "",
      disciplinaLider: "",
      sector: sector || "",
      categoriaProyecto: categoriaProyecto || "",
      dashboardType: dashboardType || "compras",
      createdAt: new Date().toISOString(),
      commentCount: 1,
    };

    // Add STD-enriched fields if available
    if (stdEnrichment) {
      projectData.dataSource = "std";
      if (stdEnrichment.tipoLicitacion) {
        projectData.tipoLicitacion = stdEnrichment.tipoLicitacion;
      }
      if (stdEnrichment.memos && stdEnrichment.memos.length > 0) {
        projectData.memos = stdEnrichment.memos;
      }
      if (stdEnrichment.stdAsunto) {
        projectData.stdAsunto = stdEnrichment.stdAsunto;
      }
      if (stdEnrichment.plazoEjecucion) {
        projectData.plazoEjecucion = stdEnrichment.plazoEjecucion;
      }
    }

    const newProjectId = await createProject(projectData as Parameters<typeof createProject>[0]);

    // Add the original email as the first comment
    const commentPrefix = stdEnrichment
      ? `📧 **Creado desde STD**`
      : `📧 **Creado desde correo aprobado**`;
    await addComment(newProjectId, {
      authorEmail: "pladet@usach.cl",
      content: `${commentPrefix}\n\nDe: ${contactName || contactEmail}\nAsunto: ${title}\n\n${(description || "").slice(0, 500)}`,
      mentions: [],
      createdAt: new Date().toISOString(),
    });

    // Mark draft as approved
    await updateEmailDraft(draftId, {
      status: "approved",
      approvedProjectId: newProjectId,
      reviewedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      projectId: newProjectId,
      message: "Borrador aprobado y proyecto creado",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const draftId = url.searchParams.get("id");
    const ids = url.searchParams.get("ids"); // comma-separated IDs
    const all = url.searchParams.get("all");

    // Dismiss ALL pending drafts
    if (all === "true") {
      const count = await dismissAllPendingDrafts();
      return NextResponse.json({ success: true, dismissed: count, message: `${count} borradores descartados` });
    }

    // Dismiss multiple by IDs
    if (ids) {
      const idList = ids.split(",").filter(Boolean);
      if (idList.length === 0) {
        return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
      }
      const count = await dismissMultipleDrafts(idList);
      return NextResponse.json({ success: true, dismissed: count, message: `${count} borradores descartados` });
    }

    // Dismiss single
    if (!draftId) {
      return NextResponse.json({ error: "id, ids, or all param required" }, { status: 400 });
    }

    await updateEmailDraft(draftId, {
      status: "dismissed",
      reviewedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: "Borrador descartado" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── Helpers ──

interface STDEnrichment {
  memos?: { key: string; tipo: string; asunto: string; fecha: string }[];
  budget?: string;
  codigoUsa?: string;
  plazoEjecucion?: string;
  tipoLicitacion?: string;
  categoriaProyecto?: string;
  memoTipo?: string;
  dataSource?: string;
  stdAsunto?: string;
  stdCuerpoDoc?: string;
}

/** Parse suggestedDetail JSON for STD enrichment data */
function parseSTDDetail(detail: string): STDEnrichment | null {
  if (!detail) return null;
  try {
    const parsed = JSON.parse(detail);
    if (parsed.dataSource === "std") return parsed as STDEnrichment;
    return null;
  } catch {
    return null;
  }
}
