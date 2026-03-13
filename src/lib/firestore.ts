import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDoc,
  getDocs,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Project, Comment } from "@/types/project";
import type { BacklogItem } from "@/types/backlog";

const COLLECTION = "projects";

export function subscribeProjects(callback: (projects: Project[]) => void): Unsubscribe {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
    callback(projects);
  });
}

export async function createProject(project: Omit<Project, "id">): Promise<string> {
  // Strip undefined values — Firestore rejects undefined
  const cleanData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(project)) {
    if (value !== undefined) {
      cleanData[key] = value;
    }
  }
  const now = new Date().toISOString();
  cleanData.createdAt = now;

  // Record initial fieldTimestamps for all tracked fields that have values
  const initialTimestamps: Record<string, string> = {};
  for (const key of Object.keys(cleanData)) {
    if (TRACKED_FIELDS.has(key) && !isEmptyValue(cleanData[key])) {
      initialTimestamps[key] = now;
    }
  }
  if (Object.keys(initialTimestamps).length > 0) {
    cleanData.fieldTimestamps = initialTimestamps;
  }

  const docRef = await addDoc(collection(db, COLLECTION), cleanData);
  return docRef.id;
}

// Fields to track timestamps for in the Indicador
const TRACKED_FIELDS = new Set([
  "title", "memorandumNumber", "requestingUnit", "tipoLicitacion", "recinto", "status",
  "jefeProyectoId", "disciplinaLider", "dueDate", "subEtapas", "fechaVisitaTerreno",
  "budget", "tipoFinanciamiento", "fechaLicitacion", "idLicitacion",
  "inspectorId", "fechaInicioObra", "plazoEjecucion", "fechaEstimadaTermino",
  "fechaRecProviso", "fechaRecDefinitiva",
]);

// Check if a value is "empty" (null, undefined, empty string, 0, -1 for IDs)
function isEmptyValue(val: unknown): boolean {
  if (val === undefined || val === null || val === "" || val === -1) return true;
  if (typeof val === "number" && val < 0) return true;
  return false;
}

export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
  const ref = doc(db, COLLECTION, id);

  // Get current doc to detect newly-filled fields
  const currentSnap = await getDoc(ref);
  const currentData = currentSnap.exists() ? currentSnap.data() : {};
  const existingTimestamps: Record<string, string> = currentData?.fieldTimestamps || {};

  // Strip undefined values and 'id' field — Firestore rejects undefined
  const cleanData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== "id" && value !== undefined) {
      cleanData[key] = value;
    }
  }

  // Detect fields that are being set/changed and record timestamps
  const now = new Date().toISOString();
  const newTimestamps: Record<string, string> = { ...existingTimestamps };
  let tsChanged = false;

  for (const key of Object.keys(cleanData)) {
    if (!TRACKED_FIELDS.has(key)) continue;
    if (key === "fieldTimestamps") continue;

    const oldVal = currentData?.[key];
    const newVal = cleanData[key];

    // Record timestamp if: field was empty and now has a value, or value changed
    if (isEmptyValue(oldVal) && !isEmptyValue(newVal)) {
      newTimestamps[key] = now;
      tsChanged = true;
    } else if (!isEmptyValue(newVal) && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      newTimestamps[key] = now;
      tsChanged = true;
    }
  }

  if (tsChanged) {
    cleanData.fieldTimestamps = newTimestamps;
  }

  await updateDoc(ref, cleanData);
}

export async function deleteProject(id: string): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  await deleteDoc(ref);
}

// Batch update sortOrder for multiple projects at once
export async function batchUpdateSortOrder(updates: { id: string; sortOrder: number }[]): Promise<void> {
  const batch = writeBatch(db);
  for (const { id, sortOrder } of updates) {
    batch.update(doc(db, COLLECTION, id), { sortOrder });
  }
  await batch.commit();
}

// ── Comments (subcollection: projects/{id}/comments) ──

export function subscribeComments(
  projectId: string,
  callback: (comments: Comment[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION, projectId, "comments"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as Comment)
    );
    callback(comments);
  });
}

export async function addComment(
  projectId: string,
  comment: Omit<Comment, "id">
): Promise<string> {
  const docRef = await addDoc(
    collection(db, COLLECTION, projectId, "comments"),
    comment
  );
  // Update comment count on the project
  const projectRef = doc(db, COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);
  const currentCount = projectSnap.data()?.commentCount || 0;
  await updateDoc(projectRef, { commentCount: currentCount + 1 });
  return docRef.id;
}

export async function deleteComment(
  projectId: string,
  commentId: string
): Promise<void> {
  const ref = doc(db, COLLECTION, projectId, "comments", commentId);
  await deleteDoc(ref);
  // Decrement comment count
  const projectRef = doc(db, COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);
  const currentCount = projectSnap.data()?.commentCount || 0;
  await updateDoc(projectRef, { commentCount: Math.max(0, currentCount - 1) });
}

// ── Backlog (collection: backlog) ──
const BACKLOG_COLLECTION = "backlog";

export function subscribeBacklog(callback: (items: BacklogItem[]) => void): Unsubscribe {
  const q = query(collection(db, BACKLOG_COLLECTION), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as BacklogItem));
    callback(items);
  });
}

export async function createBacklogItem(item: Omit<BacklogItem, "id">): Promise<string> {
  const docRef = await addDoc(collection(db, BACKLOG_COLLECTION), item);
  return docRef.id;
}

export async function updateBacklogItem(id: string, data: Partial<BacklogItem>): Promise<void> {
  const ref = doc(db, BACKLOG_COLLECTION, id);
  const cleanData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== "id" && value !== undefined) {
      cleanData[key] = value;
    }
  }
  cleanData.updatedAt = new Date().toISOString();
  await updateDoc(ref, cleanData);
}

export async function deleteBacklogItem(id: string): Promise<void> {
  const ref = doc(db, BACKLOG_COLLECTION, id);
  await deleteDoc(ref);
}

// ── Email Drafts (collection: email-drafts) ──
const DRAFTS_COLLECTION = "email-drafts";

export interface EmailDraft {
  id: string;
  // Email data
  from: string;
  fromName: string;
  subject: string;
  body: string;
  emailDate: string;
  attachments: { filename: string; contentType: string; size: number }[];
  // Suggested fields from classifier
  suggestedAction: "create_project" | "add_comment" | "update_status" | "attach_document" | "ignore";
  suggestedTitle: string;
  suggestedMemo: string;
  suggestedUnit: string;
  suggestedPriority: "alta" | "media" | "baja";
  suggestedDashboardType: "compras" | "obras";
  suggestedCategory: string;
  suggestedSector: string;
  suggestedProjectRef: string;  // for comment/status actions
  suggestedDetail: string;      // extra info (comment text, status reason, etc.)
  // Draft status
  status: "pending" | "approved" | "dismissed";
  approvedProjectId?: string;
  createdAt: string;
  reviewedAt?: string;
}

export async function createEmailDraft(draft: Omit<EmailDraft, "id">): Promise<string> {
  const cleanData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(draft)) {
    if (value !== undefined) {
      cleanData[key] = value;
    }
  }
  const docRef = await addDoc(collection(db, DRAFTS_COLLECTION), cleanData);
  return docRef.id;
}

export async function getPendingDrafts(): Promise<EmailDraft[]> {
  // Simple query with only where (no orderBy) to avoid needing composite index
  const q = query(
    collection(db, DRAFTS_COLLECTION),
    where("status", "==", "pending")
  );
  const snapshot = await getDocs(q);
  const drafts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as EmailDraft));
  // Sort in memory by emailDate descending
  drafts.sort((a, b) => {
    const dateA = a.emailDate ? new Date(a.emailDate).getTime() : 0;
    const dateB = b.emailDate ? new Date(b.emailDate).getTime() : 0;
    return dateB - dateA;
  });
  return drafts;
}

export async function getAllDrafts(limitCount = 100): Promise<EmailDraft[]> {
  // Simple query without orderBy to avoid index requirements
  const snapshot = await getDocs(collection(db, DRAFTS_COLLECTION));
  const drafts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as EmailDraft));
  // Sort in memory by createdAt descending
  drafts.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });
  return drafts.slice(0, limitCount);
}

export async function countDrafts(): Promise<{ total: number; pending: number }> {
  const snapshot = await getDocs(collection(db, DRAFTS_COLLECTION));
  const total = snapshot.size;
  const pending = snapshot.docs.filter(d => d.data().status === "pending").length;
  return { total, pending };
}

export async function updateEmailDraft(id: string, data: Partial<EmailDraft>): Promise<void> {
  const ref = doc(db, DRAFTS_COLLECTION, id);
  const cleanData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== "id" && value !== undefined) {
      cleanData[key] = value;
    }
  }
  await updateDoc(ref, cleanData);
}

export async function dismissMultipleDrafts(ids: string[]): Promise<number> {
  const now = new Date().toISOString();
  let dismissed = 0;
  // Firestore writeBatch limited to 500 ops
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.update(doc(db, DRAFTS_COLLECTION, id), { status: "dismissed", reviewedAt: now });
    }
    await batch.commit();
    dismissed += chunk.length;
  }
  return dismissed;
}

export async function dismissAllPendingDrafts(): Promise<number> {
  const q = query(
    collection(db, DRAFTS_COLLECTION),
    where("status", "==", "pending")
  );
  const snapshot = await getDocs(q);
  const ids = snapshot.docs.map(d => d.id);
  if (ids.length === 0) return 0;
  return dismissMultipleDrafts(ids);
}

export async function checkDuplicateDraft(subject: string, from: string, emailDate: string): Promise<boolean> {
  const q = query(
    collection(db, DRAFTS_COLLECTION),
    where("subject", "==", subject),
    where("from", "==", from),
    where("emailDate", "==", emailDate)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}


// ── STD Links (collection: std-links) ──
const STD_LINKS_COLLECTION = "std-links";

export interface STDLink {
  id: string;
  url: string;
  memoNumber: string;
  memoPeriod: string;
  memoKey: string;
  emailSubject: string;
  emailFrom: string;
  emailDate: string;
  emailUid: number;
  emailType: "despacho" | "comentario" | "recepcion" | "otro";
  scrapedAt: string | null;
  createdAt: string;
}

export async function saveSTDLinks(links: Omit<STDLink, "id">[]): Promise<number> {
  let saved = 0;
  for (let i = 0; i < links.length; i += 500) {
    const chunk = links.slice(i, i + 500);
    const batch = writeBatch(db);
    for (const link of chunk) {
      // Use memoKey as document ID for deduplication
      const docId = link.memoKey + "_" + link.emailUid;
      const ref = doc(db, STD_LINKS_COLLECTION, docId);
      const cleanData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(link)) {
        if (value !== undefined) cleanData[key] = value;
      }
      batch.set(ref, cleanData, { merge: true });
    }
    await batch.commit();
    saved += chunk.length;
  }
  return saved;
}

export async function getUnscrapedMemoKeys(): Promise<{ memoKey: string; url: string }[]> {
  const q = query(
    collection(db, STD_LINKS_COLLECTION),
    where("scrapedAt", "==", null)
  );
  const snapshot = await getDocs(q);
  // Deduplicate by memoKey — only need one URL per memo
  const memoMap = new Map<string, string>();
  snapshot.docs.forEach(d => {
    const data = d.data();
    if (data.memoKey && data.url && !memoMap.has(data.memoKey)) {
      memoMap.set(data.memoKey, data.url);
    }
  });
  return Array.from(memoMap.entries()).map(([memoKey, url]) => ({ memoKey, url }));
}

export async function markLinksScraped(memoKey: string): Promise<void> {
  const q = query(
    collection(db, STD_LINKS_COLLECTION),
    where("memoKey", "==", memoKey)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  snapshot.docs.forEach(d => {
    batch.update(d.ref, { scrapedAt: now });
  });
  await batch.commit();
}

export async function getSTDLinkStats(): Promise<{ total: number; scraped: number; pending: number; uniqueMemos: number }> {
  const snapshot = await getDocs(collection(db, STD_LINKS_COLLECTION));
  const memoKeys = new Set<string>();
  let scraped = 0;
  snapshot.docs.forEach(d => {
    const data = d.data();
    if (data.memoKey) memoKeys.add(data.memoKey);
    if (data.scrapedAt) scraped++;
  });
  return {
    total: snapshot.size,
    scraped,
    pending: snapshot.size - scraped,
    uniqueMemos: memoKeys.size,
  };
}

// ── STD Documents (collection: std-documents) ──
const STD_DOCS_COLLECTION = "std-documents";

export interface STDDocumentRecord {
  id: string;
  numero: string;
  periodo: string;
  memoKey: string;
  asunto: string;
  unidadRemitente: string;
  unidadCreadora: string;
  motivos: string[];
  cuerpoDocumento: string;
  budget: string;
  codigoUsa: string;
  plazoEjecucion: string;
  historialExterno: { origen: string; movimiento: string; destino: string; estado: string; comentario: string; fecha: string }[];
  archivos: string[];
  sourceUrl: string;
  scrapedAt: string;
  emailCount: number;
}

export async function saveSTDDocument(memoKey: string, data: Omit<STDDocumentRecord, "id">): Promise<void> {
  const ref = doc(db, STD_DOCS_COLLECTION, memoKey);
  const cleanData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) cleanData[key] = value;
  }
  // Use set with merge so we can update emailCount later
  const { setDoc } = await import("firebase/firestore");
  await setDoc(ref, cleanData, { merge: true });
}

export async function getSTDDocumentCount(): Promise<number> {
  const snapshot = await getDocs(collection(db, STD_DOCS_COLLECTION));
  return snapshot.size;
}

export async function getSTDDocuments(): Promise<STDDocumentRecord[]> {
  const snapshot = await getDocs(collection(db, STD_DOCS_COLLECTION));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as STDDocumentRecord));
}
