import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  deleteUser as firebaseDeleteUser,
  User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  orderBy,
} from "firebase/firestore";
import { getFirebaseAuth, db } from "./firebase";
import { AppUser, ADMIN_EMAIL } from "@/types/user";

const USERS_COLLECTION = "users";

// Login
export async function login(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  return cred.user;
}

// Logout
export async function logout(): Promise<void> {
  await signOut(getFirebaseAuth());
}

// Listen to auth state
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

// Get user profile from Firestore
export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as AppUser;
}

// Check if user is admin
export function isAdmin(email: string | null | undefined): boolean {
  return email === ADMIN_EMAIL;
}

// Create a new collaborator (admin only)
// Uses a secondary Firebase Auth instance so the admin stays logged in
export async function createCollaborator(
  email: string,
  password: string,
  name: string
): Promise<AppUser> {
  if (!email.endsWith("@usach.cl")) {
    throw new Error("Solo se permiten correos @usach.cl");
  }

  // We need to use a workaround: create the user with a secondary app
  // so the admin's session isn't replaced
  const { initializeApp, deleteApp } = await import("firebase/app");
  const { getAuth: getSecondaryAuth, createUserWithEmailAndPassword: createUser } = await import("firebase/auth");

  const secondaryApp = initializeApp(
    {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    },
    "secondary-" + Date.now()
  );

  try {
    const secondaryAuth = getSecondaryAuth(secondaryApp);
    const cred = await createUser(secondaryAuth, email, password);

    const role = email === ADMIN_EMAIL ? "admin" : "collaborator";
    const newUser: Omit<AppUser, "uid"> = {
      email,
      name,
      role,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, USERS_COLLECTION, cred.user.uid), newUser);

    await secondaryAuth.signOut();
    await deleteApp(secondaryApp);

    return { uid: cred.user.uid, ...newUser };
  } catch (error) {
    await deleteApp(secondaryApp).catch(() => {});
    throw error;
  }
}

// List all collaborators (admin only)
export async function listUsers(): Promise<AppUser[]> {
  const q = query(collection(db, USERS_COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser));
}

// Remove user from Firestore (admin only)
// Note: this removes Firestore profile only. Firebase Auth user persists
// until they try to log in and get rejected, or admin removes via Firebase Console.
export async function removeUser(uid: string): Promise<void> {
  await deleteDoc(doc(db, USERS_COLLECTION, uid));
}

// Seed admin user profile if not exists
export async function ensureAdminProfile(user: User): Promise<AppUser> {
  const existing = await getUserProfile(user.uid);
  if (existing) return existing;

  const profile: Omit<AppUser, "uid"> = {
    email: user.email || ADMIN_EMAIL,
    name: "Sebastián Vizcarra",
    role: "admin",
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(db, USERS_COLLECTION, user.uid), profile);
  return { uid: user.uid, ...profile };
}
