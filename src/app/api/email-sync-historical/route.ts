/**
 * POST /api/email-sync-historical
 *
 * Processes ALL emails (read and unread) in batches.
 * Called repeatedly by the frontend with increasing offset.
 * Each call processes one batch and returns progress.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchAllEmails } from "@/lib/email-reader";
import { classifyEmail } from "@/lib/email-processor";
import { collection, getDocs, query, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createProject, addComment } from "@/lib/firestore";

const BATCH_SIZE = 30; // keep small to avoid Vercel timeout (60s)

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

    // 2. Get existing memo numbers to avoid duplicates
    const existingMemos = await getExistingMemoNumbers();

    let created = 0;
    let skipped = 0;
    let commented = 0;

    // 3. Process each email in this batch
    for (const email of emails) {
      try {
        const action = classifyEmail(email, existingMemos);

        switch (action.type) {
          case "create_project": {
            // Check if this memo already exists (could have been created in a previous batch)
            if (existingMemos.includes(action.data.memorandumNumber)) {
              skipped++;
              break;
            }

            const projectData = {
              title: action.data.title,
              description: action.data.description,
              status: "recepcion_requerimiento",
              priority: action.data.priority,
              memorandumNumber: action.data.memorandumNumber,
              requestingUnit: action.data.requestingUnit,
              contactName: action.data.contactName,
              contactEmail: action.data.contactEmail,
              budget: "0",
              dueDate: null,
              tipoFinanciamiento: null,
              codigoProyectoUsa: "",
              tipoDesarrollo: "",
              disciplinaLider: "",
              sector: action.data.sector,
              categoriaProyecto: action.data.categoriaProyecto,
              dashboardType: action.data.dashboardType,
              createdAt: email.date ? email.date.toISOString() : new Date().toISOString(),
              commentCount: 1,
            };

            const newId = await createProject(projectData);

            await addComment(newId, {
              authorEmail: "pladet@usach.cl",
              content: `📧 **Creado desde correo histórico**\n\nDe: ${email.fromName || email.from}\nFecha: ${email.date?.toLocaleDateString("es-CL") || "?"}\nAsunto: ${email.subject}\n\n${email.body.slice(0, 500)}`,
              mentions: [],
              createdAt: email.date ? email.date.toISOString() : new Date().toISOString(),
            });

            // Add to existing list to avoid duplicates within the same run
            existingMemos.push(action.data.memorandumNumber);
            created++;
            break;
          }

          case "add_comment": {
            const projectId = await findProjectIdByMemo(action.projectRef);
            if (projectId) {
              await addComment(projectId, {
                authorEmail: action.fromEmail,
                content: action.comment,
                mentions: [],
                createdAt: email.date ? email.date.toISOString() : new Date().toISOString(),
              });
              commented++;
            }
            break;
          }

          case "update_status": {
            const pid = await findProjectIdByMemo(action.projectRef);
            if (pid) {
              await addComment(pid, {
                authorEmail: "pladet@usach.cl",
                content: `🔄 **Cambio de estado detectado (histórico)**\n\n${action.reason}\nEstado sugerido: **${action.newStatus}**`,
                mentions: [],
                createdAt: email.date ? email.date.toISOString() : new Date().toISOString(),
              });
              commented++;
            }
            break;
          }

          case "attach_document": {
            const docPid = await findProjectIdByMemo(action.projectRef);
            if (docPid) {
              await addComment(docPid, {
                authorEmail: "pladet@usach.cl",
                content: `📎 **Documento detectado (histórico)**\nTipo: ${action.docType}\nArchivo: ${action.filename}`,
                mentions: [],
                createdAt: email.date ? email.date.toISOString() : new Date().toISOString(),
              });
              commented++;
            }
            break;
          }

          case "ignore":
            skipped++;
            break;
        }
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
          detail: `Procesamiento histórico: lote ${Math.floor(offset / BATCH_SIZE) + 1} — ${created} creados, ${commented} comentarios, ${skipped} ignorados`,
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
      commented,
      skipped,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("Historical sync error:", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
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

async function findProjectIdByMemo(memoNumber: string): Promise<string | null> {
  try {
    const q = query(collection(db, "projects"));
    const snapshot = await getDocs(q);
    const match = snapshot.docs.find(
      (d) => d.data().memorandumNumber === memoNumber
    );
    return match?.id || null;
  } catch {
    return null;
  }
}
