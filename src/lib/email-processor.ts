/**
 * Email Processor — Multi-signal classifier that matches emails to existing projects.
 *
 * Uses 5 independent signals (codes, contact, subject, unit, content) to score
 * how likely an email relates to each existing project. When score >= 60,
 * the email is linked to that project with a suggested action.
 */

import type { ParsedEmail } from "./email-reader";

// ── Types ──

export interface ProjectMatchData {
  id: string;
  memorandumNumber: string;
  title: string;
  requestingUnit: string;
  contactEmail: string;
  contactName: string;
  sector: string;
  idLicitacion?: string;
  codigoProyectoDCI?: string;
  codigoProyectoUsa?: string;
}

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

// ── Known patterns (kept from original) ──

const MEMO_PATTERNS = [
  /memor[aá]ndum?\s*(?:n[°º.]?\s*)?(\d+)/i,
  /memo\s*(?:n[°º.]?\s*)?(\d+)/i,
  /MEM[-\s]?\d{4}[-\s]?(\d+)/i,
];

const STATUS_KEYWORDS: { pattern: RegExp; status: string; label: string }[] = [
  { pattern: /resoluci[oó]n\s*(de\s*)?adjudicaci[oó]n/i, status: "gestion_compra", label: "Adjudicación" },
  { pattern: /orden\s*de\s*compra|OC\s*\d+/i, status: "gestion_compra", label: "OC" },
  { pattern: /acta\s*de\s*inicio/i, status: "en_ejecucion", label: "Acta de Inicio" },
  { pattern: /recepci[oó]n\s*(provisoria|definitiva)/i, status: "terminada", label: "Recepción" },
  { pattern: /CDP\s*(aprobado|emitido)/i, status: "gestion_compra", label: "CDP" },
  { pattern: /publicaci[oó]n.*mercado\s*p[uú]blico/i, status: "gestion_compra", label: "Publicación" },
  { pattern: /bases\s*t[eé]cnicas/i, status: "en_diseno", label: "Bases Técnicas" },
  { pattern: /licitaci[oó]n/i, status: "gestion_compra", label: "Licitación" },
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

const UNIT_PATTERNS: { pattern: RegExp; unit: string }[] = [
  { pattern: /vicerrector[ií]a\s*(de\s*)?administraci[oó]n/i, unit: "Vicerrectoría de Administración y Finanzas" },
  { pattern: /facultad\s*de\s*ingenier[ií]a/i, unit: "Facultad de Ingeniería" },
  { pattern: /facultad\s*de\s*ciencias\s*m[eé]dicas/i, unit: "Facultad de Ciencias Médicas" },
  { pattern: /DOCL|departamento\s*(de\s*)?compras/i, unit: "DOCL" },
  { pattern: /prorrector/i, unit: "Prorrectoría" },
  { pattern: /rector/i, unit: "Rectoría" },
  { pattern: /facultad\s*de\s*humanidades/i, unit: "Facultad de Humanidades" },
  { pattern: /facultad\s*de\s*ciencias/i, unit: "Facultad de Ciencias" },
  { pattern: /facultad\s*de\s*qu[ií]mica/i, unit: "Facultad de Química y Biología" },
  { pattern: /facultad\s*de\s*derecho/i, unit: "Facultad de Derecho" },
  { pattern: /DGTEC|direcci[oó]n\s*general\s*t[eé]cnica/i, unit: "DGTEC" },
  { pattern: /VRAE|vicerrector[ií]a\s*acad[eé]mica/i, unit: "VRAE" },
];

// Stop words for subject matching
const STOP_WORDS = new Set([
  "de", "del", "la", "el", "los", "las", "en", "a", "y", "e", "o", "u",
  "por", "para", "con", "sin", "un", "una", "unos", "unas", "al", "se",
  "su", "sus", "es", "que", "re", "fwd", "fw", "no", "si", "más", "como",
  "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas",
  "hay", "ser", "ha", "han", "fue", "son", "está", "le", "lo",
]);

// Institutional/spam patterns to ignore
const IGNORE_PATTERNS = [
  /^(no[_-]?reply|noreply|mailer[_-]?daemon|postmaster)/i,
  /out\s*of\s*office|fuera\s*de\s*oficina|auto[_-]?reply|respuesta\s*autom[aá]tica/i,
  /unsubscribe|darse\s*de\s*baja/i,
  /newsletter|bolet[ií]n\s*informativo/i,
  /^\[?SPAM\]?/i,
];

// ════════════════════════════════════════════
// MAIN CLASSIFIER
// ════════════════════════════════════════════

export function classifyEmail(
  email: ParsedEmail,
  existingProjects: ProjectMatchData[]
): EmailAction {
  const subject = email.subject || "";
  const body = email.body || "";
  const fullText = `${subject} ${body}`;

  // 0. Quick ignore: institutional spam, auto-replies, etc.
  if (shouldIgnore(email)) {
    return { type: "ignore", reason: `Correo institucional/auto: "${truncate(subject, 80)}"` };
  }

  // 1. Find the best matching project using multi-signal scoring
  const match = findBestProjectMatch(email, existingProjects);

  // 2. If we found a match (score >= 60), determine the action
  if (match) {
    const project = existingProjects.find(p => p.id === match.projectId);

    // Detect STD (Sistema de Trazabilidad Documental) notifications
    // These are informational comments only — they should NEVER trigger status changes
    const isSTDNotification = /nuevo\s+comentario|notificaci[oó]n\s*(std|sistema)/i.test(subject)
      || /std@usach|trazabilidad/i.test(email.from);

    // Check for status-changing keywords — but NOT for STD notifications
    if (!isSTDNotification) {
      for (const sk of STATUS_KEYWORDS) {
        if (sk.pattern.test(fullText)) {
          return {
            type: "update_status",
            projectRef: match.projectId,
            newStatus: sk.status,
            reason: `${sk.label} — de ${email.fromName || email.from}: "${truncate(subject, 60)}" (score: ${match.score})`,
          };
        }
      }
    }

    // Check for document attachments
    if (email.attachments.length > 0) {
      for (const att of email.attachments) {
        for (const dp of DOCUMENT_PATTERNS) {
          if (dp.pattern.test(att.filename) || dp.pattern.test(subject)) {
            return {
              type: "attach_document",
              projectRef: match.projectId,
              docType: dp.docType,
              filename: att.filename,
            };
          }
        }
      }
    }

    // Default: add as comment
    return {
      type: "add_comment",
      projectRef: match.projectId,
      comment: `📧 **${email.fromName || email.from}** — ${subject}\n\n${truncate(body, 500)}`,
      fromEmail: email.from,
    };
  }

  // 3. No match found — check if it looks like a new project request
  if (looksLikeNewRequest(fullText, email)) {
    const memoNumber = extractMemoNumber(fullText) || "000";
    return {
      type: "create_project",
      data: extractProjectData(email, memoNumber),
    };
  }

  // 4. Ignore
  return {
    type: "ignore",
    reason: `Sin match (score < 60): "${truncate(subject, 80)}" de ${email.from}`,
  };
}

// ════════════════════════════════════════════
// MULTI-SIGNAL MATCHING
// ════════════════════════════════════════════

interface ProjectScore {
  projectId: string;
  score: number;
  reasons: string[];
}

function findBestProjectMatch(
  email: ParsedEmail,
  projects: ProjectMatchData[]
): ProjectScore | null {
  if (projects.length === 0) return null;

  const scores: ProjectScore[] = [];

  for (const project of projects) {
    const result: ProjectScore = { projectId: project.id, score: 0, reasons: [] };

    // Signal 1: Code/ID matching (max 95)
    const codeScore = scoreByCodes(email, project);
    if (codeScore > 0) {
      result.score += codeScore;
      result.reasons.push(`codes:${codeScore}`);
    }

    // Signal 2: Contact email matching (max 90)
    const contactScore = scoreByContact(email, project);
    if (contactScore > 0) {
      result.score += contactScore;
      result.reasons.push(`contact:${contactScore}`);
    }

    // Signal 3: Subject line similarity (max 75)
    const subjectScore = scoreBySubject(email, project);
    if (subjectScore > 0) {
      result.score += subjectScore;
      result.reasons.push(`subject:${subjectScore}`);
    }

    // Signal 4: Unit matching (max 65)
    const unitScore = scoreByUnit(email, project);
    if (unitScore > 0) {
      result.score += unitScore;
      result.reasons.push(`unit:${unitScore}`);
    }

    // Signal 5: Body content keywords (max 50)
    const contentScore = scoreByContent(email, project);
    if (contentScore > 0) {
      result.score += contentScore;
      result.reasons.push(`content:${contentScore}`);
    }

    // Cap at 100
    result.score = Math.min(result.score, 100);

    if (result.score > 0) {
      scores.push(result);
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Return best match if it passes threshold
  const best = scores[0];
  if (best && best.score >= 60) {
    return best;
  }

  return null;
}

// ── Signal 1: Code/ID Matching ──

function scoreByCodes(email: ParsedEmail, project: ProjectMatchData): number {
  const fullText = `${email.subject} ${email.body}`;
  let score = 0;

  // Memo number match
  if (project.memorandumNumber) {
    const memoNum = project.memorandumNumber.replace(/^MEM[-\s]?\d{4}[-\s]?/, "");
    if (memoNum && fullText.includes(project.memorandumNumber)) {
      score = Math.max(score, 95);
    } else if (memoNum) {
      // Check if just the number part appears near memo keywords
      const pattern = new RegExp(`(?:memo|MEM|memorándum|memorandum)\\s*[-#:nN°º.]*\\s*${escapeRegex(memoNum)}\\b`, "i");
      if (pattern.test(fullText)) {
        score = Math.max(score, 90);
      }
    }
  }

  // Licitación ID match
  if (project.idLicitacion) {
    const pattern = new RegExp(`(?:licitaci[oó]n|lic)\\s*[-#:nN°º.]*\\s*${escapeRegex(project.idLicitacion)}\\b`, "i");
    if (pattern.test(fullText) || fullText.includes(project.idLicitacion)) {
      score = Math.max(score, 90);
    }
  }

  // DCI code match
  if (project.codigoProyectoDCI) {
    if (fullText.includes(project.codigoProyectoDCI)) {
      score = Math.max(score, 90);
    }
  }

  // USA code match
  if (project.codigoProyectoUsa) {
    if (fullText.includes(project.codigoProyectoUsa)) {
      score = Math.max(score, 90);
    }
  }

  return score;
}

// ── Signal 2: Contact Email Matching ──

function scoreByContact(email: ParsedEmail, project: ProjectMatchData): number {
  if (!project.contactEmail) return 0;

  const senderEmail = email.from.toLowerCase().trim();
  const projectEmail = project.contactEmail.toLowerCase().trim();

  // Exact email match
  if (senderEmail === projectEmail) return 90;

  // Same email in CC list
  if (email.cc?.some(cc => cc.toLowerCase().trim() === projectEmail)) return 70;

  // Same domain (e.g. both @usach.cl — less useful since many people share domain)
  const senderDomain = senderEmail.split("@")[1];
  const projectDomain = projectEmail.split("@")[1];
  if (senderDomain && projectDomain && senderDomain === projectDomain && senderDomain !== "usach.cl" && senderDomain !== "gmail.com") {
    return 30; // Low score for same domain (only useful as secondary signal)
  }

  return 0;
}

// ── Signal 3: Subject Line Similarity ──

function scoreBySubject(email: ParsedEmail, project: ProjectMatchData): number {
  if (!project.title) return 0;

  const subjectClean = cleanText(email.subject);
  const titleClean = cleanText(project.title);

  if (!subjectClean || !titleClean) return 0;

  // Extract significant words (>= 4 chars, not stop words)
  const titleWords = extractKeywords(titleClean);
  const subjectWords = extractKeywords(subjectClean);

  if (titleWords.length === 0) return 0;

  // Count how many title keywords appear in the subject
  let matchCount = 0;
  for (const tw of titleWords) {
    if (subjectWords.some(sw => sw.includes(tw) || tw.includes(sw))) {
      matchCount++;
    }
  }

  if (matchCount === 0) return 0;

  const matchRatio = matchCount / titleWords.length;

  // 3+ keywords matching → high confidence
  if (matchCount >= 3) return 75;
  // 2 keywords → medium
  if (matchCount >= 2) return 60;
  // 1 keyword with high ratio → low-medium
  if (matchRatio >= 0.5) return 45;
  // 1 keyword → very low (needs other signals)
  return 25;
}

// ── Signal 4: Unit Matching ──

function scoreByUnit(email: ParsedEmail, project: ProjectMatchData): number {
  if (!project.requestingUnit) return 0;

  const fullText = `${email.fromName} ${email.from} ${email.subject} ${email.body.slice(0, 500)}`;

  // Check if sender info matches the project's requesting unit
  for (const up of UNIT_PATTERNS) {
    if (up.pattern.test(fullText)) {
      const normalizedUnit = up.unit.toLowerCase();
      const projectUnit = project.requestingUnit.toLowerCase();
      if (projectUnit.includes(normalizedUnit) || normalizedUnit.includes(projectUnit)) {
        return 65;
      }
    }
  }

  // Direct text match of unit name
  const projectUnitLower = project.requestingUnit.toLowerCase();
  if (projectUnitLower.length > 4 && fullText.toLowerCase().includes(projectUnitLower)) {
    return 55;
  }

  return 0;
}

// ── Signal 5: Body Content Keywords ──

function scoreByContent(email: ParsedEmail, project: ProjectMatchData): number {
  if (!project.title) return 0;

  const bodyClean = cleanText(email.body.slice(0, 2000));
  const titleWords = extractKeywords(cleanText(project.title));

  if (titleWords.length === 0 || !bodyClean) return 0;

  let matchCount = 0;
  const bodyWords = new Set(bodyClean.split(/\s+/));

  for (const tw of titleWords) {
    for (const bw of bodyWords) {
      if (bw.includes(tw) || tw.includes(bw)) {
        matchCount++;
        break;
      }
    }
  }

  if (matchCount === 0) return 0;

  // Body matching is weaker than subject (more noise)
  if (matchCount >= 4) return 50;
  if (matchCount >= 3) return 40;
  if (matchCount >= 2) return 25;
  return 10;
}

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

function shouldIgnore(email: ParsedEmail): boolean {
  const fullText = `${email.from} ${email.subject} ${email.body.slice(0, 200)}`;
  return IGNORE_PATTERNS.some(p => p.test(fullText));
}

function looksLikeNewRequest(text: string, email: ParsedEmail): boolean {
  // Original strict patterns
  if (/solicitud\s*(de\s*)?(proyecto|obra|trabajo|mantenci[oó]n|reparaci[oó]n)/i.test(text)) return true;
  if (/se\s*solicita.*intervenci[oó]n/i.test(text)) return true;
  if (/requerimiento\s*(urgente|de\s*obra|de\s*mantenci[oó]n)?/i.test(text)) return true;

  // Broader patterns — catch more real requests
  if (/memor[aá]ndum/i.test(text) && !/^re:/i.test(email.subject)) return true;
  if (/presupuesto\s*(para|de)\s/i.test(text)) return true;
  if (/cotizaci[oó]n\s*(para|de)\s/i.test(text)) return true;
  if (/se\s*requiere/i.test(text)) return true;
  if (/necesidad\s*(de|para)\s/i.test(text)) return true;

  // Has attachments with project-like names
  if (email.attachments.length > 0) {
    const attNames = email.attachments.map(a => a.filename).join(" ");
    if (/presupuesto|itemizado|EETT|bases|plano|ficha/i.test(attNames)) return true;
  }

  return false;
}

function extractMemoNumber(text: string): string | null {
  for (const pattern of MEMO_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractProjectData(email: ParsedEmail, memoNumber: string): NewProjectFromEmail {
  const fullText = `${email.subject} ${email.body}`;
  const year = new Date().getFullYear().toString();

  // Extract requesting unit
  let unit = "";
  for (const up of UNIT_PATTERNS) {
    if (up.pattern.test(fullText)) {
      unit = up.unit;
      break;
    }
  }

  // Determine obras vs compras
  const isObras = /mantenci[oó]n|reparaci[oó]n|cuadrilla|ejecuci[oó]n\s*interna|obra\s*menor/i.test(fullText);

  // Infer priority
  let priority: "alta" | "media" | "baja" = "media";
  if (/urgente|cr[ií]tico|inmediato|emergencia/i.test(fullText)) priority = "alta";
  if (/cuando\s*sea\s*posible|sin\s*urgencia|baja\s*prioridad/i.test(fullText)) priority = "baja";

  // Infer category
  let category = "";
  const categoryPatterns: [RegExp, string][] = [
    [/el[eé]ctric|iluminaci[oó]n|tablero|electricidad/i, "electrico"],
    [/ba[nñ]o|sanitario|agua|alcantarillado/i, "banos"],
    [/techo|techumbre|cubierta|gotera|filtraci[oó]n/i, "techumbre"],
    [/pintura|muro|pared|revestimiento/i, "obras_menores"],
    [/piso|pavimento|baldosa/i, "pisos_pavimentos"],
    [/puerta|ventana|cerradur/i, "carpinteria"],
    [/fachada|exterior/i, "fachada"],
    [/clima|aire\s*acondicionado|calefacci[oó]n|ventilaci[oó]n/i, "climatizacion"],
  ];
  for (const [pattern, cat] of categoryPatterns) {
    if (pattern.test(fullText)) {
      category = cat;
      break;
    }
  }

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

function cleanText(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(cleanedText: string): string[] {
  return cleanedText
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOP_WORDS.has(w));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncate(text: string, maxLen: number): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + "..." : cleaned;
}
