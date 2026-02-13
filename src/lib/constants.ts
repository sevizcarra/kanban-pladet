export const STATUSES = [
  { id: "recepcion_requerimiento", label: "Recepción Requerimiento", short: "REC", color: "#0ea5e9" },
  { id: "asignacion_profesional", label: "En Asignación de Profesional", short: "ASI", color: "#8b5cf6" },
  { id: "en_diseno", label: "En Diseño", short: "DIS", color: "#6B7280" },
  { id: "gestion_compra", label: "En Gestión de Compra", short: "COM", color: "#F97316" },
  { id: "coordinacion_ejecucion", label: "En Coord. de Ejecución", short: "COE", color: "#4B5563" },
  { id: "en_ejecucion", label: "En Ejecución", short: "EJE", color: "#22c55e" },
  { id: "terminada", label: "Terminada", short: "TER", color: "#64748b" },
];

export const PRIORITIES: Record<string, { label: string; color: string; bg: string }> = {
  alta: { label: "Alta", color: "#ef4444", bg: "#fef2f2" },
  media: { label: "Media", color: "#6B7280", bg: "#F3F4F6" },
  baja: { label: "Baja", color: "#22c55e", bg: "#f0fdf4" },
};

// Todos los profesionales del equipo (para desplegable Jefe de Proyecto y Profesional Asignado)
export const PROFESSIONALS = [
  { name: "Estefanía Tamara Contreras Hernández", role: "Coordinadora de Obras" },
  { name: "Rodrigo Armijo Henríquez", role: "Coordinador de Cuadrilla / Ing. Civil ME" },
  { name: "Dixon Vásquez Fernández", role: "Coordinador de Diseño" },
  { name: "Christian Amaro Valencia", role: "Arquitecto" },
  { name: "Cristian Romero Serrano", role: "Arquitecto" },
  { name: "Francisca Bustamante Labarca", role: "Arquitecta" },
  { name: "Eloisa Barra Mora", role: "Arquitecta" },
  { name: "Cristóbal Ríos Larraín", role: "Arquitecto" },
  { name: "Héctor Olguín Quiroz", role: "Arquitecto" },
  { name: "Richard Adriazola Castro", role: "Ing. en Climatización" },
  { name: "Fabricio Ignacio Díaz San Martín", role: "Ing. en Climatización" },
  { name: "Francisco Antonio Orellana Fernández", role: "Ing. Civil ST" },
  { name: "Rodolfo Molina Molina", role: "Especialista Eléctrico" },
  { name: "Pablo Lepe Almendares", role: "Especialista Eléctrico" },
  { name: "Aitor Xabier Alexander Oyarzún Merino", role: "Tecnólogo en Construcción" },
];

export const INSPECTORS = [
  "Lucía Eluardo Leon",
  "Rodrigo Farías Godoy",
  "Jorge Peralta Boysen",
  "Ginger Puente Z.",
  "Vicente Tolentino Carvajal",
];

export const SPECIALISTS = [
  { name: "Christian Amaro Valencia", discipline: "Apoyo Sanitario" },
  { name: "Rodrigo Armijo Henríquez", discipline: "Apoyo Mecánico" },
  { name: "Richard Adriazola Castro", discipline: "Ing. en Climatización" },
  { name: "Fabricio Ignacio Díaz San Martín", discipline: "Ing. en Climatización" },
  { name: "Francisco Antonio Orellana Fernández", discipline: "Ing. Civil" },
  { name: "Rodolfo Molina Molina", discipline: "Especialista Eléctrico" },
  { name: "Pablo Lepe Almendares", discipline: "Especialista Eléctrico" },
];

// Colaboradores del sistema (usuarios que pueden ser mencionados con @)
export const COLLABORATORS = [
  { name: "Sebastián", role: "Administrador" },
  { name: "Rodimar", role: "Colaborador" },
  { name: "Daniela", role: "Colaboradora" },
];

export const WORK_TYPES = [
  { value: "REM", label: "REM - Remodelación" },
  { value: "ONV", label: "ONV - Obra Nueva" },
  { value: "NOR", label: "NOR - Normalización" },
  { value: "FTE", label: "FTE - Factibilidad Técnica" },
  { value: "PAI", label: "PAI - Paisajismo" },
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

export const BIDDING_TYPES = [
  { value: "CA", label: "CA - Compra Ágil" },
  { value: "CM", label: "CM - Convenio Marco" },
  { value: "L1", label: "L1 - Licitación de menor cuantía" },
  { value: "LIC", label: "LIC - Licitación Pública" },
  { value: "MEI", label: "MEI - Materiales ejecución interna" },
];

// Map old tipoLicitacion values to new abbreviations
const BIDDING_LEGACY_MAP: Record<string, string> = {
  compra_agil: "CA",
  convenio_marco: "CM",
  licitacion: "LIC",
  materiales_ejecucion: "MEI",
};

export const normalizeTipoLicitacion = (value: string): string => {
  if (!value) return "";
  return BIDDING_LEGACY_MAP[value] || value;
};

export const SECTORS = [
  { value: "1", label: "Sector 1" }, { value: "2", label: "Sector 2" },
  { value: "3", label: "Sector 3" }, { value: "4", label: "Sector 4" },
  { value: "5", label: "Sector 5" }, { value: "6", label: "Sector 6" },
  { value: "7", label: "Sector 7" }, { value: "8", label: "Sector 8" },
  { value: "EDOC", label: "EDOC" }, { value: "RT", label: "RT" },
  { value: "CEPEC", label: "CEPEC" }, { value: "PROPEXT", label: "PROPEXT" },
];

// Flujo reducido para Factibilidad Técnica (FTE)
export const FTE_STATUSES = [
  { id: "recepcion_requerimiento", label: "Recepción Requerimiento", short: "REC", color: "#0ea5e9" },
  { id: "asignacion_profesional", label: "En Asignación de Profesional", short: "ASI", color: "#8b5cf6" },
  { id: "en_diseno", label: "En Diseño", short: "DIS", color: "#6B7280" },
  { id: "terminada", label: "Terminada", short: "TER", color: "#64748b" },
];

export const FTE_STATUS_IDS = new Set(FTE_STATUSES.map((s) => s.id));

export const isFTE = (tipoDesarrollo: string | undefined) => tipoDesarrollo === "FTE";

export const getStatusesForProject = (tipoDesarrollo: string | undefined) =>
  isFTE(tipoDesarrollo) ? FTE_STATUSES : STATUSES;

// Helpers
export const fmt = (n: number | string) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(n));

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const daysLeft = (d: string | null | undefined) => {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - new Date().getTime()) / 86400000);
};

export const getStatusObj = (id: string, tipoDesarrollo?: string) => {
  const list = getStatusesForProject(tipoDesarrollo);
  return list.find((s) => s.id === id) || list[0];
};
export const getStatusIndex = (id: string, tipoDesarrollo?: string) => {
  const list = getStatusesForProject(tipoDesarrollo);
  return list.findIndex((s) => s.id === id);
};
// Verifica si los Antecedentes Generales de un proyecto están incompletos
export const getAntecedentesIncompletos = (p: {
  fechaRecepcionMemo?: string;
  dueDate?: string | null;
  fechaLicitacion?: string;
  fechaPublicacion?: string;
  budget?: string;
  tipoFinanciamiento?: string | null;
  idLicitacion?: string;
}) => {
  const campos: { campo: string; valor: unknown }[] = [
    { campo: "Fecha Recepción Memorándum", valor: p.fechaRecepcionMemo },
    { campo: "Fecha Est. Entrega", valor: p.dueDate },
    { campo: "Fecha Licitación", valor: p.fechaLicitacion },
    { campo: "Fecha Publicación", valor: p.fechaPublicacion },
    { campo: "Monto Asignado", valor: p.budget && p.budget !== "0" ? p.budget : null },
    { campo: "Tipo Financiamiento", valor: p.tipoFinanciamiento },
    { campo: "ID Licitación", valor: p.idLicitacion },
  ];
  const faltantes = campos.filter(c => !c.valor).map(c => c.campo);
  return { incompleto: faltantes.length > 0, faltantes, total: campos.length, completados: campos.length - faltantes.length };
};

export const getProgress = (
  id: string,
  subEtapas?: { disenoArquitectura?: boolean; disenoEspecialidades?: boolean; compraCDP?: boolean; compraEnProceso?: boolean; compraEvaluacionAdj?: boolean },
  tipoDesarrollo?: string
) => {
  if (id === "terminada") return 100;

  const list = getStatusesForProject(tipoDesarrollo);
  const mainIdx = list.findIndex((s) => s.id === id);

  if (isFTE(tipoDesarrollo)) {
    // FTE: 4 etapas, sin sub-etapas
    return Math.min(100, Math.round(((mainIdx + 1) / list.length) * 100));
  }

  // Normal: 7 etapas principales + 5 sub-etapas = 12 checkpoints
  let completed = mainIdx + 1;
  const totalCheckpoints = list.length + 5;

  if (subEtapas) {
    if (subEtapas.disenoArquitectura) completed++;
    if (subEtapas.disenoEspecialidades) completed++;
    if (subEtapas.compraCDP) completed++;
    if (subEtapas.compraEnProceso) completed++;
    if (subEtapas.compraEvaluacionAdj) completed++;
  }

  return Math.min(100, Math.round((completed / totalCheckpoints) * 100));
};
