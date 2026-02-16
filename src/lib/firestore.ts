import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDoc,
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
  cleanData.createdAt = new Date().toISOString();
  const docRef = await addDoc(collection(db, COLLECTION), cleanData);
  return docRef.id;
}

export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  // Strip undefined values and 'id' field — Firestore rejects undefined
  const cleanData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== "id" && value !== undefined) {
      cleanData[key] = value;
    }
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

