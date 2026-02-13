export interface BacklogItem {
  id: string;
  // Identificación
  title: string;
  description: string;
  notes: string; // Free text for thoughts/context
  memorandum: string; // Número de memorándum
  year: string; // Año
  // Clasificación
  tipoDesarrollo: string;
  disciplinaLider: string;
  requestingUnit: string;
  sector: string;
  tipoLicitacion: string; // Tipo de licitación (CA, CM, L1, LIC, MEI)
  // Detalles
  priority: "alta" | "media" | "baja" | "";
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
