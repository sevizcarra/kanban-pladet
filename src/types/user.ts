export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: "admin" | "collaborator";
  createdAt?: string;
}

export const ADMIN_EMAIL = "sebastian.vizcarra@usach.cl";
