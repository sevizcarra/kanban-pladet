import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Project } from "@/types/project";

const COLLECTION = "projects";

export async function getProjects(): Promise<Project[]> {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
}

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
  await updateDoc(ref, data);
}

export async function deleteProject(id: string): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  await deleteDoc(ref);
}

// Seed initial data if collection is empty
export async function seedIfEmpty(): Promise<void> {
  const snapshot = await getDocs(collection(db, COLLECTION));
  if (snapshot.size > 0) return;

  const seed: Omit<Project, "id">[] = [
    { title: "Reparación Aula Magna - USACH", description: "Reparación integral del techo y estructura del Aula Magna Andrés Bello", status: "recepcion_requerimiento", priority: "alta", memorandumNumber: "MEM-2026-001", requestingUnit: "FING", contactName: "Dr. Felipe Vera", contactEmail: "fvera@usach.cl", budget: "45000000", dueDate: "2026-06-15", tipoFinanciamiento: "Capital", codigoProyectoUsa: "USACH-2024-001", tipoDesarrollo: "REM", disciplinaLider: "AR", sector: "1", createdAt: new Date().toISOString() },
    { title: "Adecuación Laboratorio Computacional", description: "Instalación de sistemas de climatización y equipamiento en laboratorio de informática", status: "asignacion_profesional", priority: "media", memorandumNumber: "MEM-2026-002", requestingUnit: "FQYB", contactName: "Dra. Sofía Álvarez", contactEmail: "salvarez@usach.cl", budget: "28500000", dueDate: "2026-08-20", tipoFinanciamiento: "DCI", codigoProyectoUsa: "USACH-2024-002", tipoDesarrollo: "REM", disciplinaLider: "HVAC", sector: "3", createdAt: new Date().toISOString() },
    { title: "Construcción Biblioteca Viviente", description: "Nuevo espacio de estudio integrado con áreas verdes y tecnología sustentable", status: "en_diseno", priority: "alta", memorandumNumber: "MEM-2026-003", requestingUnit: "VRAE", contactName: "Prof. Marcela Riquelme", contactEmail: "mriquelme@usach.cl", budget: "82000000", dueDate: "2026-12-01", tipoFinanciamiento: "Capital", codigoProyectoUsa: "USACH-2024-003", tipoDesarrollo: "ONV", disciplinaLider: "AR", sector: "2", createdAt: new Date().toISOString() },
    { title: "Sistema de Agua Potable - Residencias", description: "Renovación del sistema de agua potable en las residencias estudiantiles", status: "en_diseno", priority: "media", memorandumNumber: "MEM-2026-004", requestingUnit: "PRO", contactName: "Ing. Rodrigo Muñoz", contactEmail: "rmunoz@usach.cl", budget: "35200000", dueDate: "2026-07-30", tipoFinanciamiento: "Corriente", codigoProyectoUsa: "USACH-2024-004", tipoDesarrollo: "NOR", disciplinaLider: "ME", sector: "5", createdAt: new Date().toISOString() },
    { title: "Accesibilidad Campus Centro - Fase 1", description: "Instalación de rampas, ascensores y señalética inclusiva en edificios principales", status: "gestion_compra", priority: "alta", memorandumNumber: "MEM-2026-005", requestingUnit: "VIPO", contactName: "Arq. Carolina Fuentes", contactEmail: "cfuentes@usach.cl", budget: "67500000", dueDate: "2026-09-15", tipoFinanciamiento: "Capital", codigoProyectoUsa: "USACH-2024-005", tipoDesarrollo: "ONV", disciplinaLider: "AR", sector: "1", createdAt: new Date().toISOString() },
    { title: "Mejoramiento Cancha Sintética", description: "Reemplazo de superficie sintética y mejoras en iluminación del complejo deportivo", status: "coordinacion_ejecucion", priority: "baja", memorandumNumber: "MEM-2026-006", requestingUnit: "FACIMED", contactName: "Prof. Diego Soto", contactEmail: "dsoto@usach.cl", budget: "42000000", dueDate: "2026-10-01", tipoFinanciamiento: "VRIIC", codigoProyectoUsa: "USACH-2024-006", tipoDesarrollo: "REM", disciplinaLider: "ST", sector: "7", createdAt: new Date().toISOString() },
    { title: "Renovación Sistema Eléctrico - Edificio Central", description: "Actualización completa del sistema eléctrico incluyendo tableros y cableado", status: "en_ejecucion", priority: "alta", memorandumNumber: "MEM-2026-007", requestingUnit: "FING", contactName: "Ing. Andrés Bravo", contactEmail: "abravo@usach.cl", budget: "55800000", dueDate: "2026-05-01", tipoFinanciamiento: "Capital", codigoProyectoUsa: "USACH-2024-007", tipoDesarrollo: "NOR", disciplinaLider: "EL", sector: "1", createdAt: new Date().toISOString() },
    { title: "Cierre Proyecto Edificio Multidisciplinario", description: "Recepción final y cierre administrativo del edificio multidisciplinario nuevo", status: "terminada", priority: "media", memorandumNumber: "MEM-2026-008", requestingUnit: "REC", contactName: "Arq. Valentina Rojas", contactEmail: "vrojas@usach.cl", budget: "150000000", dueDate: "2026-03-30", tipoFinanciamiento: "Capital", codigoProyectoUsa: "USACH-2024-008", tipoDesarrollo: "ONV", disciplinaLider: "AR", sector: "2", createdAt: new Date().toISOString() },
  ];

  for (const p of seed) {
    await addDoc(collection(db, COLLECTION), p);
  }
}
