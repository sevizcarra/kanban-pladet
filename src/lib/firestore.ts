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
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Project, Comment } from "@/types/project";

const COLLECTION = "projects";

export function subscribeProjects(callback: (projects: Project[]) => void): Unsubscribe {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
    callback(projects);
  });
}

export async function createProject(project: Omit<Project, "id">): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...project,
    createdAt: new Date().toISOString(),
  });
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

