/**
 * STD Document Classifier
 *
 * Classifies STD documents to infer Kanban project fields,
 * filters out non-relevant documents, and groups memos by project.
 */

import type { STDDocumentRecord } from "./firestore";

// ── Types ──

export interface STDClassification {
  filteredOut: boolean;
  filterReason?: string;
  tipoLicitacion: string;     // "CA" | "L1" | "CM" | "LIC" | "MEI" | ""
  categoriaProyecto: string;  // banos, climatizacion, etc. | ""
  dashboardType: "compras" | "obras";
  memoTipo: "cdp" | "licitacion" | "cotizacion" | "pago" | "compra_agil" | "resolucion" | "otro";
  normalizedTitle: string;    // For grouping memos by project
  recinto: string;            // Extracted physical location/building name
}

export interface ProjectGroup {
  normalizedTitle: string;
  title: string;              // Best title (from the most descriptive memo)
  recinto: string;            // Extracted physical location/building
  memos: {
    key: string;
    tipo: string;
    asunto: string;
    fecha: string;
  }[];
  classification: STDClassification;
  // Merged data from all memos
  budget: string;
  codigoUsa: string;
  plazoEjecucion: string;
  requestingUnit: string;
  cuerpoDocumento: string;
}

// ── Classification ──

export function classifySTDDocument(doc: STDDocumentRecord): STDClassification {
  const asunto = doc.asunto || "";
  const asuntoLower = asunto.toLowerCase();
  const cuerpo = (doc.cuerpoDocumento || "").toLowerCase();

  // 1. Filter out non-relevant documents
  const filterResult = checkRelevance(asuntoLower, cuerpo, doc.unidadRemitente);
  if (filterResult) {
    return {
      filteredOut: true,
      filterReason: filterResult,
      tipoLicitacion: "",
      categoriaProyecto: "",
      dashboardType: "compras",
      memoTipo: "otro",
      normalizedTitle: "",
      recinto: "",
    };
  }

  // 2. Determine memo type
  const memoTipo = inferMemoTipo(asuntoLower);

  // 3. Infer tipoLicitacion from title
  const tipoLicitacion = inferTipoLicitacion(asuntoLower, cuerpo);

  // 4. Infer categoría from title
  const categoriaProyecto = inferCategoria(asuntoLower);

  // 5. Determine dashboard type
  const dashboardType = determineDashboardType(tipoLicitacion, memoTipo);

  // 6. Normalize title for grouping
  const normalizedTitle = normalizeTitleForGrouping(asunto);

  // 7. Extract recinto (physical location)
  const recinto = extractRecinto(asunto);

  return {
    filteredOut: false,
    tipoLicitacion,
    categoriaProyecto,
    dashboardType,
    memoTipo,
    normalizedTitle,
    recinto,
  };
}

// ── Relevance Filter ──

function checkRelevance(asuntoLower: string, cuerpo: string, unidad: string): string | null {
  // HR / personnel / honorarios
  if (/carga\s*familiar|tramite\s*de\s*carga|honorarios\s*20\d{2}|regularizaci[oó]n\s*honorarios/i.test(asuntoLower)) {
    return "personal_hr";
  }
  if (/autorizaci[oó]n\s*de\s*recursos.*honorarios|renovaci[oó]n\s*honorarios/i.test(asuntoLower)) {
    return "personal_hr";
  }

  // Room/space assignments
  if (/asignaci[oó]n\s*(sala|oficina|espacio)|solicitud\s*de\s*(asignaci|sala\s*taller)/i.test(asuntoLower)) {
    return "asignacion_espacio";
  }

  // Attendance/admin
  if (/informe\s*de\s*asistencia|planilla\s*de\s*asistencia/i.test(asuntoLower)) {
    return "asistencia";
  }

  // Concessions/permits
  if (/concesionarios|patentes\s*municipales|resoluci[oó]n\s*sanitaria/i.test(asuntoLower)) {
    return "concesiones";
  }

  // Committee/governance
  if (/convocatoria.*comit[eé]|modificaci[oó]n.*comit[eé]|comit[eé]\s*de\s*bajas/i.test(asuntoLower)) {
    return "gobernanza";
  }

  // Visitas en terreno (without a clear project context)
  if (/solicitud\s*de\s*visita\s*en\s*terreno/i.test(asuntoLower) && !/(obra|proyecto|construcci)/i.test(asuntoLower)) {
    return "visita_sin_proyecto";
  }

  // Contract renewals / borrador contrato arriendo / regularización contrato
  if (/borrador\s*(de\s*)?(regularizaci[oó]n\s*)?contrato\s*arriendo|renovaci[oó]n\s*contrato\s*arriendo/i.test(asuntoLower)) {
    return "contrato_arriendo";
  }
  if (/regularizaci[oó]n\s*contrato\s*arriendo/i.test(asuntoLower)) {
    return "contrato_arriendo";
  }

  // EDP — Estado de Pago (payment milestones for existing projects, not new projects)
  if (/^edp\s/i.test(asuntoLower) || /estado\s*de\s*pago\s*\d/i.test(asuntoLower)) {
    return "estado_pago";
  }

  // NDC — Nota de Crédito (financial adjustments)
  if (/^ndc\s/i.test(asuntoLower) || /nota\s*de\s*cr[eé]dito/i.test(asuntoLower)) {
    return "nota_credito";
  }

  // Devolución de retenciones (financial — relates to existing project)
  if (/devoluci[oó]n\s*de\s*retenciones/i.test(asuntoLower)) {
    return "devolucion_financiera";
  }

  // Regularización de pago (payment adjustments)
  if (/regularizaci[oó]n\s*de\s*pago/i.test(asuntoLower)) {
    return "regularizacion_pago";
  }

  // Envío de presupuesto / traslado DOMO (budget transfers, not projects)
  if (/env[ií]o\s*de\s*presupuesto/i.test(asuntoLower) && !/obra|proyecto|construcci/i.test(asuntoLower)) {
    return "presupuesto_admin";
  }

  // Clasificación de gastos (accounting)
  if (/clasificaci[oó]n\s*de\s*gastos/i.test(asuntoLower)) {
    return "contabilidad";
  }

  // Resoluciones without obra/proyecto context
  if (/^resoluci[oó]n\s*(para|de|que)/i.test(asuntoLower) && !/obra|proyecto|construcci|licitaci/i.test(asuntoLower)) {
    return "resolucion_admin";
  }

  // Situación/estado reports without actionable items
  if (/^situaci[oó]n\s*de\s*/i.test(asuntoLower) && !/cdp|licitaci|obra|compra/i.test(asuntoLower)) {
    return "informe_situacion";
  }

  return null; // Relevant
}

// ── Memo Type Inference ──

function inferMemoTipo(asuntoLower: string): STDClassification["memoTipo"] {
  if (/solicita\s*cdp|cdp\s*para|^cdp\s/i.test(asuntoLower)) return "cdp";
  if (/licitaci[oó]n/i.test(asuntoLower)) return "licitacion";
  if (/cotizaci[oó]n/i.test(asuntoLower)) return "cotizacion";
  if (/pago\s*(de\s*la\s*)?(factura|cotizaci)|factura\s*\d+|pago\s*final|remite\s*pago/i.test(asuntoLower)) return "pago";
  if (/compra\s*[aá]gil/i.test(asuntoLower)) return "compra_agil";
  if (/resoluci[oó]n/i.test(asuntoLower)) return "resolucion";
  return "otro";
}

// ── Tipo Licitación Inference ──

function inferTipoLicitacion(asuntoLower: string, cuerpo: string): string {
  if (/compra\s*[aá]gil/i.test(asuntoLower)) return "CA";
  if (/licitaci[oó]n\s*l1/i.test(asuntoLower)) return "L1";
  if (/convenio\s*marco/i.test(asuntoLower)) return "CM";
  if (/licitaci[oó]n\s*p[uú]blica/i.test(asuntoLower)) return "LIC";
  if (/materiales.*ejecuci[oó]n\s*interna/i.test(asuntoLower + " " + cuerpo)) return "MEI";
  // Fallback: check body for clues
  if (/compra\s*[aá]gil/i.test(cuerpo)) return "CA";
  if (/convenio\s*marco/i.test(cuerpo)) return "CM";
  return "";
}

// ── Categoría Inference ──

function inferCategoria(asuntoLower: string): string {
  if (/ba[ñn]o/i.test(asuntoLower)) return "banos";
  if (/climatizaci/i.test(asuntoLower)) return "climatizacion";
  if (/cubierta|techumbre/i.test(asuntoLower)) return "techumbre";
  if (/luminaria|el[eé]ctric|alumbrado/i.test(asuntoLower)) return "electrico";
  if (/laboratorio/i.test(asuntoLower)) return "laboratorio";
  if (/paisaj/i.test(asuntoLower)) return "paisajismo";
  if (/patrimonio/i.test(asuntoLower)) return "patrimonio";
  if (/sala\s*de\s*clase/i.test(asuntoLower)) return "salas";
  if (/fachada/i.test(asuntoLower)) return "fachada";
  if (/tabique|oficina/i.test(asuntoLower)) return "oficinas";
  return "";
}

// ── Dashboard Type ──

function determineDashboardType(tipoLicitacion: string, memoTipo: string): "compras" | "obras" {
  // All bidding processes go through "compras" (the full 7-step workflow)
  if (["CA", "CM", "L1", "LIC"].includes(tipoLicitacion)) return "compras";
  // MEI (materials for internal execution) goes to "obras"
  if (tipoLicitacion === "MEI") return "obras";
  // Default based on memo type
  if (memoTipo === "pago") return "compras";
  return "compras";
}

// ── Title Normalization for Grouping ──

export function normalizeTitleForGrouping(asunto: string): string {
  let normalized = asunto;

  // Remove common prefixes
  const prefixes = [
    /^solicita\s*cdp\s*(para\s*)?[""]?/i,
    /^solicita\s*compra\s*[aá]gil\s*(de\s*)?[""]?/i,
    /^solicita\s*/i,
    /^licitaci[oó]n\s*l1\s*[""]?/i,
    /^licitaci[oó]n\s*p[uú]blica\s*[""]?/i,
    /^licitaci[oó]n\s*[""]?/i,
    /^cotizaci[oó]n\s*convenio\s*marco\s*(para\s*)?[""]?/i,
    /^cotizaci[oó]n\s*(por\s*)?[""]?/i,
    /^pago\s*(final\s*)?(de\s*la\s*)?(factura\s*\d+\s*)?(correspondiente\s*(al?\s*)?)?/i,
    /^pago\s*(por\s*)?cotizaci[oó]n\s*(por\s*)?convenio\s*marco\s*[""]?/i,
    /^pago\s*(por\s*)?compra\s*[aá]gil\s*(por\s*)?[""]?/i,
    /^remite\s*pago\s*de\s*la\s*factura\s*[nN]?°?\s*\d+\s*(correspondiente\s*(al?\s*)?)?/i,
    /^edp\s*(n°?\s*\d+\s*)?[""]?/i,
    /^ndc\s*\d*\s*/i,
    /^cdp\s*(para\s*)?[""]?/i,
  ];

  for (const prefix of prefixes) {
    normalized = normalized.replace(prefix, "");
  }

  // Remove trailing quotes
  normalized = normalized.replace(/[""]$/g, "").trim();

  // Remove leading/trailing whitespace and normalize spaces
  normalized = normalized.replace(/\s+/g, " ").trim();

  // Uppercase for comparison
  return normalized.toUpperCase();
}

// ── Recinto Extraction ──

/**
 * Extract the physical location (recinto) from an STD document title.
 * Uses location marker keywords (edificio, sector, planta, sala, etc.)
 * to find the building/area name within the title.
 *
 * Returns empty string if no clear location can be identified.
 * The field is editable in the UI, so admins can correct/set it manually.
 *
 * Examples:
 *   "... muro cortina del edificio Rector Eduardo Morales Santos" → "EDIFICIO RECTOR EDUARDO MORALES SANTOS"
 *   "26-NE-AC-INSTALACION FIBRA OPTICA SECTOR 08 - PRORRECTORIA" → "SECTOR 08"
 *   "... climatización planta de nitrógeno, Fac. Química" → "PLANTA DE NITRÓGENO"
 *   "... normalización eléctrica sala de clases 788-FAE" → "SALA DE CLASES 788-FAE"
 */
export function extractRecinto(asunto: string): string {
  const text = asunto;

  // Location marker patterns — ordered by specificity.
  // Each captures the marker keyword + what follows (the location name).
  const locationPatterns: { pattern: RegExp; group: number }[] = [
    // "EDIFICIO X" — captures edificio + name (up to comma, period, or end)
    { pattern: /\b(edificio\s+[^,.\n"]+)/i, group: 1 },
    // "SECTOR XX" — captures sector + number/name
    { pattern: /\b(sector\s+\d+[\w\s|-]*?)(?:\s*[-–,.]|\s+(?:de\s+)?prorr|\s*$)/i, group: 1 },
    // "PLANTA (DE) X" — captures planta + name
    { pattern: /\b(planta\s+(?:de\s+)?[^,.\n"]+?)(?:\s*[,"]|\s+facul|\s*$)/i, group: 1 },
    // "LABORATORIO (DE) X"
    { pattern: /\b(laboratorio\s+(?:de\s+)?[^,.\n"]+)/i, group: 1 },
    // "HOSPITAL X"
    { pattern: /\b(hospital\s+[^,.\n"]+)/i, group: 1 },
    // "CASA CENTRAL"
    { pattern: /\b(casa\s+central)/i, group: 1 },
    // "GIMNASIO X"
    { pattern: /\b(gimnasio\s+[^,.\n"]*)/i, group: 1 },
    // "SALA DE X" — sala de clases, sala de consejo, etc.
    { pattern: /\b(sala\s+(?:de\s+)?[^,.\n"]+)/i, group: 1 },
    // "PATIO X"
    { pattern: /\b(patio\s+[^,.\n"]+)/i, group: 1 },
    // "ESCUELA DE X"
    { pattern: /\b(escuela\s+de\s+[^,.\n"]+)/i, group: 1 },
    // "PLAZA (SECTOR) X"
    { pattern: /\b(plaza\s+(?:sector\s+)?[^,.\n"]+)/i, group: 1 },
  ];

  for (const { pattern, group } of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[group]) {
      let recinto = match[group]
        .replace(/[""\s]+$/g, "")  // trim trailing quotes/spaces
        .replace(/\s+/g, " ")
        .trim();
      if (recinto.length >= 6) {
        return recinto.toUpperCase();
      }
    }
  }

  // Fallback: look for known USACH building/faculty abbreviations at end of title
  const facultyMatch = text.match(/[-–,]\s*(FAE|FAHU|FACIMED|FING|FARAC|FACCM|FADER|FACTEC|FQYB|BACH|CIBAP|DVE|VIME)\b/i);
  if (facultyMatch) {
    return facultyMatch[1].toUpperCase();
  }

  return "";
}

// ── Group Memos by Project ──

// Types of memos that initiate a project (vs payment/follow-up memos)
const PROJECT_INITIATING_TYPES = new Set(["cdp", "licitacion", "cotizacion", "compra_agil"]);

export function groupMemosByProject(docs: STDDocumentRecord[]): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>();

  for (const doc of docs) {
    const classification = classifySTDDocument(doc);
    if (classification.filteredOut) continue;

    const normalized = classification.normalizedTitle;
    if (!normalized) continue;

    const memoKey = doc.memoKey || `MEM-${doc.periodo}-${doc.numero}`;

    if (groups.has(normalized)) {
      const group = groups.get(normalized)!;
      group.memos.push({
        key: memoKey,
        tipo: classification.memoTipo,
        asunto: doc.asunto,
        fecha: doc.scrapedAt || "",
      });
      // Merge data: prefer non-empty values
      if (!group.budget && doc.budget) group.budget = doc.budget;
      if (!group.codigoUsa && doc.codigoUsa) group.codigoUsa = doc.codigoUsa;
      if (!group.plazoEjecucion && doc.plazoEjecucion) group.plazoEjecucion = doc.plazoEjecucion;
      // Promote classification if this memo is project-initiating
      if (PROJECT_INITIATING_TYPES.has(classification.memoTipo)) {
        group.classification = classification;
      }
      // Use the longest title as the "best" title
      if (doc.asunto.length > group.title.length) {
        group.title = doc.asunto;
      }
    } else {
      groups.set(normalized, {
        normalizedTitle: normalized,
        title: doc.asunto,
        recinto: classification.recinto,
        memos: [{
          key: memoKey,
          tipo: classification.memoTipo,
          asunto: doc.asunto,
          fecha: doc.scrapedAt || "",
        }],
        classification,
        budget: doc.budget || "",
        codigoUsa: doc.codigoUsa || "",
        plazoEjecucion: doc.plazoEjecucion || "",
        requestingUnit: doc.unidadRemitente || doc.unidadCreadora || "",
        cuerpoDocumento: doc.cuerpoDocumento || "",
      });
    }
  }

  // Post-filter: only keep groups that have at least one project-initiating memo
  // OR are "otro" type with clear project indicators in the title
  const result: ProjectGroup[] = [];
  for (const group of groups.values()) {
    const hasInitiating = group.memos.some(m => PROJECT_INITIATING_TYPES.has(m.tipo));
    const hasProjectKeywords = /obra|proyecto|construcci|instalaci|reparaci|remodelaci|habilitaci|suministro|adquisici|normalizaci|implementaci/i.test(group.title);

    if (hasInitiating || hasProjectKeywords) {
      result.push(group);
    }
    // Groups with only pago/resolucion/otro memos and no project keywords → skip
  }

  return result;
}
