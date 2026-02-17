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

    if (!draftId) {
      return NextResponse.json({ error: "draftId required" }, { status: 400 });
    }

    // Create the project in Firestore
    const projectData = {
      title: title || "Sin título",
      description: description || "",
      status: "recepcion_requerimiento",
      priority: priority || "media",
      memorandumNumber: memorandumNumber || "",
      requestingUnit: requestingUnit || "",
      contactName: contactName || "",
      contactEmail: contactEmail || "",
      budget: "0",
      dueDate: null,
      tipoFinanciamiento: null,
      codigoProyectoUsa: "",
      tipoDesarrollo: "",
      disciplinaLider: "",
      sector: sector || "",
      categoriaProyecto: categoriaProyecto || "",
      dashboardType: dashboardType || "compras",
      createdAt: new Date().toISOString(),
      commentCount: 1,
    };

    const newProjectId = await createProject(projectData);

    // Add the original email as the first comment
    await addComment(newProjectId, {
      authorEmail: "pladet@usach.cl",
      content: `📧 **Creado desde correo aprobado**\n\nDe: ${contactName || contactEmail}\nAsunto: ${title}\n\n${(description || "").slice(0, 500)}`,
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
