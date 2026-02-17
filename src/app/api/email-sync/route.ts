/**
 * POST /api/email-sync
 *
 * Cron endpoint: reads unread emails from pladet@usach.cl,
 * classifies them, and creates/updates projects in Firestore.
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
import { createProject, addComment } from "@/lib/firestore";

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
  // Check Vercel cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // Check manual trigger secret via query param
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (cronSecret && secret === cronSecret) return true;

  // Allow in development
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

    // 2. Get existing project memo numbers for reference matching
    const existingMemos = await getExistingMemoNumbers();

    // 3. Process each email
    for (const email of emails) {
      const action = classifyEmail(email, existingMemos);

      try {
        switch (action.type) {
          case "create_project": {
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
              createdAt: new Date().toISOString(),
              commentCount: 1, // the source email comment
            };

            const newId = await createProject(projectData);

            // Add the source email as the first comment
            await addComment(newId, {
              authorEmail: "pladet@usach.cl",
              content: `📧 **Creado automáticamente desde correo**\n\nDe: ${email.fromName || email.from}\nAsunto: ${email.subject}\n\n${email.body.slice(0, 500)}`,
              mentions: [],
              createdAt: new Date().toISOString(),
            });

            actions.push({
              type: "create_project",
              detail: `Proyecto creado: "${action.data.title}" (${action.data.dashboardType}) — MEM: ${action.data.memorandumNumber}`,
              success: true,
            });
            break;
          }

          case "add_comment": {
            // Find project ID by memo number
            const projectId = await findProjectIdByMemo(action.projectRef);
            if (projectId) {
              await addComment(projectId, {
                authorEmail: action.fromEmail,
                content: action.comment,
                mentions: [],
                createdAt: new Date().toISOString(),
              });
              actions.push({
                type: "add_comment",
                detail: `Comentario agregado a ${action.projectRef}: "${email.subject}"`,
                success: true,
              });
            } else {
              actions.push({
                type: "add_comment",
                detail: `No se encontró proyecto para ${action.projectRef}`,
                success: false,
                error: "Proyecto no encontrado",
              });
            }
            break;
          }

          case "update_status": {
            // For now, log the suggested change but don't auto-move
            // (status changes should be reviewed by the team)
            actions.push({
              type: "update_status",
              detail: `⚠️ Cambio de estado sugerido para ${action.projectRef}: → ${action.newStatus}. Razón: ${action.reason}`,
              success: true,
            });

            // Add as comment instead of moving
            const pid = await findProjectIdByMemo(action.projectRef);
            if (pid) {
              await addComment(pid, {
                authorEmail: "pladet@usach.cl",
                content: `🔄 **Posible cambio de estado detectado**\n\n${action.reason}\n\nEstado sugerido: **${action.newStatus}**\n\n_Revise y actualice manualmente si corresponde._`,
                mentions: [],
                createdAt: new Date().toISOString(),
              });
            }
            break;
          }

          case "attach_document": {
            actions.push({
              type: "attach_document",
              detail: `Documento detectado para ${action.projectRef}: ${action.docType} (${action.filename})`,
              success: true,
            });

            const docPid = await findProjectIdByMemo(action.projectRef);
            if (docPid) {
              await addComment(docPid, {
                authorEmail: "pladet@usach.cl",
                content: `📎 **Documento recibido por correo**\n\nTipo: ${action.docType}\nArchivo: ${action.filename}\nDe: ${email.fromName || email.from}`,
                mentions: [],
                createdAt: new Date().toISOString(),
              });
            }
            break;
          }

          case "ignore": {
            actions.push({
              type: "ignore",
              detail: action.reason,
              success: true,
            });
            break;
          }
        }
      } catch (err) {
        actions.push({
          type: action.type,
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
      message: "Sync completed",
      emailsRead: emails.length,
      actions: actions.length,
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

// ── Firestore helpers ──

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
