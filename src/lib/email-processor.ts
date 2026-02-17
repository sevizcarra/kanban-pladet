/**
 * Email Processor — Classifies emails and determines actions for the Kanban system.
 *
 * Rule engine that pattern-matches email subjects, senders, and content
 * to decide whether to create, update, or comment on projects.
 */

import type { ParsedEmail } from "./email-reader";

// ── Action types ──
export type EmailAction =
  | { type: "create_project"; data: NewProjectFromEmail }
  | { type: "update_status"; projectRef: string; newStatus: string; reason: string }
  | { type: "add_comment"; projectRef: string; comment: string; fromEmail: string }
  | { type: "attach_document"; projectRef: string; docType: string; filename: string }
  | { type: "ignore"; reason: string };

export interface NewProjectFromEmail {
  title: string;
  memorandumNumber: string;
  requestingUnit: string;
  contactName: string;
  contactEmail: string;
  description: string;
  dashboardType: "compras" | "obras";
  priority: "alta" | "media" | "baja";
  categoriaProyecto: string;
  sector: string;
}

// ── Known patterns ──
const MEMO_PATTERNS = [
  /memor[aá]ndum?\s*(?:n[°º.]?\s*)?(\d+)/i,
  /memo\s*(?:n[°º.]?\s*)?(\d+)/i,
  /MEM[-\s]?\d{4}[-\s]?(\d+)/i,
];

const STATUS_KEYWORDS: { pattern: RegExp; status: string; label: string }[] = [
  { pattern: /resoluci[oó]n\s*(de\s*)?adjudicaci[oó]n/i, status: "gestion_compra", label: "Gestión de Compra (Adjudicación)" },
  { pattern: /orden\s*de\s*compra|OC\s*\d+/i, status: "gestion_compra", label: "Gestión de Compra (OC)" },
  { pattern: /acta\s*de\s*inicio/i, status: "en_ejecucion", label: "En Ejecución" },
  { pattern: /recepci[oó]n\s*(provisoria|definitiva)/i, status: "terminada", label: "Terminada" },
  { pattern: /CDP\s*(aprobado|emitido)/i, status: "gestion_compra", label: "Gestión de Compra (CDP)" },
  { pattern: /publicaci[oó]n.*mercado\s*p[uú]blico/i, status: "gestion_compra", label: "Gestión de Compra (Publicación)" },
  { pattern: /bases\s*t[eé]cnicas/i, status: "en_diseno", label: "En Diseño (Bases Técnicas)" },
  { pattern: /licitaci[oó]n/i, status: "gestion_compra", label: "Gestión de Compra (Licitación)" },
];

const DOCUMENT_PATTERNS: { pattern: RegExp; docType: string }[] = [
  { pattern: /plano|planos|planimetr[ií]a/i, docType: "plano" },
  { pattern: /EETT|especificaci[oó]n|especificaciones\s*t[eé]cnicas/i, docType: "eett" },
  { pattern: /itemizado|presupuesto|APU/i, docType: "itemizado" },
  { pattern: /ficha\s*(de\s*)?proyecto/i, docType: "ficha" },
  { pattern: /formulario\s*(de\s*)?compra/i, docType: "formulario_compra" },
  { pattern: /oferta/i, docType: "oferta" },
  { pattern: /acta\s*(de\s*)?visita/i, docType: "acta_visita" },
  { pattern: /informe/i, docType: "informe" },
];

// Known USACH units that send memorándums
const UNIT_PATTERNS: { pattern: RegExp; unit: string }[] = [
  { pattern: /vicerrector[ií]a\s*(de\s*)?administraci[oó]n/i, unit: "Vicerrectoría de Administración y Finanzas" },
  { pattern: /facultad\s*de\s*ingenier[ií]a/i, unit: "Facultad de Ingeniería" },
  { pattern: /facultad\s*de\s*ciencias\s*m[eé]dicas/i, unit: "Facultad de Ciencias Médicas" },
  { pattern: /DOCL|departamento\s*(de\s*)?compras/i, unit: "DOCL" },
  { pattern: /prorrector/i, unit: "Prorrectoría" },
  { pattern: /rector/i, unit: "Rectoría" },
];

// ── Main classifier ──
export function classifyEmail(email: ParsedEmail, existingProjectRefs: string[]): EmailAction {
  const subject = email.subject;
  const body = email.body;
  const fullText = `${subject} ${body}`;

  // 1. Check if it's a memo → Create new project
  const memoMatch = extractMemoNumber(fullText);
  if (memoMatch && isNewMemo(subject)) {
    return {
      type: "create_project",
      data: extractProjectData(email, memoMatch),
    };
  }

  // 2. Try to find which project this email relates to
  const projectRef = findProjectReference(fullText, existingProjectRefs);

  // 3. Check for status-changing keywords
  if (projectRef) {
    for (const sk of STATUS_KEYWORDS) {
      if (sk.pattern.test(fullText)) {
        return {
          type: "update_status",
          projectRef,
          newStatus: sk.status,
          reason: `Correo de ${email.fromName || email.from}: ${subject}`,
        };
      }
    }

    // 4. Check for document attachments
    if (email.attachments.length > 0) {
      for (const att of email.attachments) {
        for (const dp of DOCUMENT_PATTERNS) {
          if (dp.pattern.test(att.filename) || dp.pattern.test(subject)) {
            return {
              type: "attach_document",
              projectRef,
              docType: dp.docType,
              filename: att.filename,
            };
          }
        }
      }
    }

    // 5. If it references a project but no specific action → add as comment
    return {
      type: "add_comment",
      projectRef,
      comment: `📧 **${email.fromName || email.from}** — ${subject}\n\n${truncate(email.body, 500)}`,
      fromEmail: email.from,
    };
  }

  // 6. No project reference found — still try to create if it looks like a request
  if (looksLikeNewRequest(fullText)) {
    const inferredMemo = extractMemoNumber(fullText) || "000";
    return {
      type: "create_project",
      data: extractProjectData(email, inferredMemo),
    };
  }

  // 7. Ignore — doesn't match any rule
  return {
    type: "ignore",
    reason: `No se pudo clasificar: "${truncate(subject, 80)}" de ${email.from}`,
  };
}

// ── Helpers ──

function extractMemoNumber(text: string): string | null {
  for (const pattern of MEMO_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function isNewMemo(subject: string): boolean {
  // Subjects that look like new memorándums (not replies)
  return (
    (/memor[aá]ndum|memo\b/i.test(subject) && !/^re:/i.test(subject)) ||
    /solicitud\s*(de\s*)?(proyecto|obra|trabajo)/i.test(subject) ||
    /requerimiento\s*(de\s*)?(obra|mantenci[oó]n|reparaci[oó]n)/i.test(subject)
  );
}

function looksLikeNewRequest(text: string): boolean {
  return (
    /solicitud\s*(de\s*)?(proyecto|obra|trabajo|mantenci[oó]n|reparaci[oó]n)/i.test(text) ||
    /se\s*solicita.*intervenci[oó]n/i.test(text) ||
    /requerimiento\s*urgente/i.test(text)
  );
}

function extractProjectData(email: ParsedEmail, memoNumber: string): NewProjectFromEmail {
  const fullText = `${email.subject} ${email.body}`;
  const year = new Date().getFullYear().toString();

  // Try to extract requesting unit
  let unit = "";
  for (const up of UNIT_PATTERNS) {
    if (up.pattern.test(fullText)) {
      unit = up.unit;
      break;
    }
  }

  // Determine if it's obras or compras based on keywords
  const isObras =
    /mantenci[oó]n|reparaci[oó]n|cuadrilla|ejecuci[oó]n\s*interna|obra\s*menor/i.test(fullText);

  // Infer priority
  let priority: "alta" | "media" | "baja" = "media";
  if (/urgente|cr[ií]tico|inmediato|emergencia/i.test(fullText)) priority = "alta";
  if (/cuando\s*sea\s*posible|sin\s*urgencia|baja\s*prioridad/i.test(fullText)) priority = "baja";

  // Infer category
  let category = "";
  const categoryPatterns: [RegExp, string][] = [
    [/el[eé]ctric|iluminaci[oó]n|tablero|electricidad/i, "instalaciones_electricas_datos"],
    [/ba[nñ]o|sanitario|agua|alcantarillado/i, "banos_servicios"],
    [/techo|techumbre|cubierta|gotera|filtraci[oó]n/i, "techumbre_cubierta"],
    [/pintura|muro|pared|revestimiento/i, "obras_menores"],
    [/piso|pavimento|baldosa/i, "pisos_pavimentos"],
    [/puerta|ventana|cerradur/i, "carpinteria"],
    [/fachada|exterior/i, "fachadas_elementos"],
    [/clima|aire\s*acondicionado|calefacci[oó]n|ventilaci[oó]n/i, "climatizacion"],
  ];
  for (const [pattern, cat] of categoryPatterns) {
    if (pattern.test(fullText)) {
      category = cat;
      break;
    }
  }

  // Build title from subject (clean up common prefixes)
  const title = email.subject
    .replace(/^(RE:|FWD?:|Memorándum\s*\d+\s*[-–—]\s*)/gi, "")
    .trim() || `Requerimiento MEM-${year}-${memoNumber}`;

  return {
    title,
    memorandumNumber: `MEM-${year}-${memoNumber}`,
    requestingUnit: unit,
    contactName: email.fromName || "",
    contactEmail: email.from,
    description: truncate(email.body, 200),
    dashboardType: isObras ? "obras" : "compras",
    priority,
    categoriaProyecto: category,
    sector: "",
  };
}

function findProjectReference(text: string, existingRefs: string[]): string | null {
  // Try to match memo numbers in the text against existing projects
  for (const ref of existingRefs) {
    // Match by MEM-YYYY-NNNN format
    if (ref && text.includes(ref)) return ref;
    // Match by just the number part
    const parts = ref?.split("-");
    if (parts && parts.length >= 3) {
      const num = parts[2];
      // Only match if the number appears near "memo" or "MEM"
      const pattern = new RegExp(`(?:memo|MEM|memorándum)\\s*[-#]?\\s*${num}\\b`, "i");
      if (pattern.test(text)) return ref;
    }
  }
  return null;
}

function truncate(text: string, maxLen: number): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + "..." : cleaned;
}
