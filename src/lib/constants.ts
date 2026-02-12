export const STATUSES = [
  { id: "recepcion_requerimiento", label: "Recepción Requerimiento", short: "REC", color: "#0ea5e9" },
  { id: "asignacion_profesional", label: "En Asignación de Profesional", short: "ASI", color: "#8b5cf6" },
  { id: "en_diseno", label: "En Diseño", short: "DIS", color: "#f59e0b" },
  { id: "gestion_compra", label: "En Gestión de Compra", short: "COM", color: "#14b8a6" },
  { id: "coordinacion_ejecucion", label: "En Coord. de Ejecución", short: "COE", color: "#f97316" },
  { id: "en_ejecucion", label: "En Ejecución", short: "EJE", color: "#22c55e" },
  { id: "terminada", label: "Terminada", short: "TER", color: "#64748b" },
];

export const PRIORITIES: Record<string, { label: string; color: string; bg: string }> = {
  alta: { label: "Alta", color: "#ef4444", bg: "#fef2f2" },
  media: { label: "Media", color: "#f59e0b", bg: "#fffbeb" },
  baja: { label: "Baja", color: "#22c55e", bg: "#f0fdf4" },
};

export const MANAGERS = ["Dixon Vasquez", "Cristián Romero", "Francisca Bustamante"];
export const INSPECTORS = ["Estefanía Contreras", "Rodrigo Farías"];
export const SPECIALISTS = [
  { name: "Fabricio Diaz", discipline: "HVAC", unit: "UOM" },
  { name: "Richard Adriazola", discipline: "HVAC", unit: "UPLA" },
  { name: "Rodolfo Molina", discipline: "EL", unit: "UOM" },
  { name: "Pablo Lepe", discipline: "EL", unit: "UOM" },
  { name: "Francisco Orellana", discipline: "ST", unit: "UOM" },
];

export const WORK_TYPES = [
  { value: "REM", label: "REM - Remodelación" },
  { value: "ONV", label: "ONV - Obra Nueva" },
  { value: "NOR", label: "NOR - Normalización" },
  { value: "FTE", label: "FTE - Factibilidad Técnica" },
];

export const LEADING_DISCIPLINE = [
  { value: "AR", label: "AR - Arquitectura" },
  { value: "ST", label: "ST - Estructura" },
  { value: "EL", label: "EL - Electricidad" },
  { value: "ME", label: "ME - Mecánico Sanitario" },
  { value: "HVAC", label: "HVAC - Climatización" },
];

export const REQUESTING_UNITS = [
  "REC", "PRO", "VRA", "VRIFYL", "VIME", "VRIIC", "VICAVIGED", "VRAE", "VIPO",
  "SECGEN", "CU", "FARAC", "FING", "FACIMED", "FACCM", "FADER", "FAHU", "FAE", "FACTEC", "FQYB", "BACH",
];

export const SECTORS = [
  { value: "1", label: "Sector 1" }, { value: "2", label: "Sector 2" },
  { value: "3", label: "Sector 3" }, { value: "4", label: "Sector 4" },
  { value: "5", label: "Sector 5" }, { value: "6", label: "Sector 6" },
  { value: "7", label: "Sector 7" }, { value: "8", label: "Sector 8" },
  { value: "EDOC", label: "EDOC" }, { value: "RT", label: "RT" },
  { value: "CEPEC", label: "CEPEC" }, { value: "PROPEXT", label: "PROPEXT" },
];

// Helpers
export const fmt = (n: number | string) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(n));

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const daysLeft = (d: string | null | undefined) => {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - new Date().getTime()) / 86400000);
};

export const getStatusObj = (id: string) => STATUSES.find((s) => s.id === id) || STATUSES[0];
export const getStatusIndex = (id: string) => STATUSES.findIndex((s) => s.id === id);
export const getProgress = (id: string) => Math.round(((getStatusIndex(id) + 1) / STATUSES.length) * 100);
