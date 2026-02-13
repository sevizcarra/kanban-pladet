export interface BacklogItem {
  id: string;
  // Básicos
  title: string;
  description: string;
  notes: string; // Free text for thoughts/context
  priority: "alta" | "media" | "baja" | "";
  // Clasificación
  tipoDesarrollo: string;
  disciplinaLider: string;
  requestingUnit: string;
  sector: string;
  // Contacto
  contactName: string;
  contactEmail: string;
  // Fechas y montos
  dueDate: string | null;
  budget: string;
  tipoFinanciamiento: string | null;
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string; // email del creador
}
