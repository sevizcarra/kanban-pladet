/**
 * STD Scraper — Logs into USACH's Sistema de Trazabilidad Documental (std.usach.cl),
 * extracts document details from "Visualizar Documento" links found in emails.
 *
 * Flow:
 * 1. Extract STD links from email HTML body
 * 2. Login to STD with session cookies
 * 3. Fetch each document page and parse structured data
 */

import * as cheerio from "cheerio";

// ── Types ──

export interface STDDocumentData {
  /** Document number (e.g., "3899") */
  numero: string;
  /** Period/year (e.g., "2026") */
  periodo: string;
  /** Sending unit */
  unidadRemitente: string;
  /** Previous unit status (e.g., "Aprobado") */
  estadoUnidadAnterior: string;
  /** Reasons for sending */
  motivos: string[];
  /** Document subject — THE CLEAN PROJECT TITLE */
  asunto: string;
  /** Unit that created the document */
  unidadCreadora: string;
  /** Creation date */
  fechaCreado: string;
  /** Last modification date */
  ultimaModificacion: string;
  /** Reference to parent document */
  tramiteOrigen: string;
  /** Document body text — contains budget, timeline, codes */
  cuerpoDocumento: string;
  /** Attached files */
  archivos: string[];
  /** External history: movement between units */
  historialExterno: STDHistoryEntry[];
  /** The original STD URL */
  sourceUrl: string;
}

export interface STDHistoryEntry {
  origen: string;
  movimiento: string;
  destino: string;
  estado: string;
  comentario: string;
  fecha: string;
}

export interface STDLinkInfo {
  /** Full URL to the document on STD */
  url: string;
  /** Email subject that contained this link */
  emailSubject: string;
  /** Email sender */
  emailFrom: string;
  /** Email date */
  emailDate: string;
}

// ── STD Link Extraction ──

/**
 * Extract all std.usach.cl links from an email's HTML body.
 * Looks for "memorandum/ver/" URLs which are the document detail pages.
 */
export function extractSTDLinks(htmlBody: string, textBody: string): string[] {
  const links: Set<string> = new Set();

  // Pattern: any URL containing std.usach.cl/memorandum/ver/
  const urlPattern = /https?:\/\/std\.usach\.cl\/memorandum\/ver\/[^\s"'<>]+/gi;

  // Search in HTML body
  if (htmlBody) {
    const htmlMatches = htmlBody.match(urlPattern);
    if (htmlMatches) {
      htmlMatches.forEach((url) => links.add(decodeHTMLEntities(url.trim())));
    }

    // Also extract from href attributes using cheerio
    try {
      const $ = cheerio.load(htmlBody);
      $("a[href*='std.usach.cl']").each((_, el) => {
        const href = $(el).attr("href");
        if (href && href.includes("memorandum/ver/")) {
          links.add(href.trim());
        }
      });
    } catch {
      // If cheerio fails, we still have regex matches
    }
  }

  // Search in text body
  if (textBody) {
    const textMatches = textBody.match(urlPattern);
    if (textMatches) {
      textMatches.forEach((url) => links.add(url.trim()));
    }
  }

  return Array.from(links);
}

// ── STD Session Management ──

interface STDSession {
  cookies: string;
  csrfToken: string;
}

/**
 * Login to STD and get session cookies.
 * The login flow:
 * 1. GET /login → get CSRF token from the form
 * 2. POST /login → authenticate and get session cookie
 */
export async function loginToSTD(): Promise<STDSession> {
  const STD_URL = "https://std.usach.cl";
  const STD_FULL_EMAIL = process.env.STD_USER || "pladet@usach.cl";
  const STD_PASS_VAL = process.env.STD_PASS || process.env.STD_PASSWORD || "";

  if (!STD_PASS_VAL) {
    throw new Error("STD_PASS not configured");
  }

  // Parse email into user + subdomain (STD form uses separate fields)
  // e.g. "pladet@usach.cl" → email="pladet", subdomain="usach.cl"
  const atIndex = STD_FULL_EMAIL.indexOf("@");
  const emailUser = atIndex > 0 ? STD_FULL_EMAIL.slice(0, atIndex) : STD_FULL_EMAIL;
  const subdomain = atIndex > 0 ? STD_FULL_EMAIL.slice(atIndex + 1) : "usach.cl";

  // Step 1: GET login page to get CSRF token + cookies
  const loginPageRes = await fetch(`${STD_URL}/login`, {
    redirect: "manual",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  const loginPageHTML = await loginPageRes.text();
  const cookies = extractCookies(loginPageRes);

  // Extract CSRF token and web_version from the form
  const $ = cheerio.load(loginPageHTML);
  const csrfToken =
    $('input[name="_token"]').val()?.toString() ||
    $('meta[name="csrf-token"]').attr("content") ||
    "";
  const webVersion = $('input[name="web_version"]').val()?.toString() || "";

  if (!csrfToken) {
    console.warn("No CSRF token found — login might fail");
  }

  // Step 2: POST login with correct form fields
  // STD form: _token, web_version, email (user part only), subdomain, password
  const formData = new URLSearchParams();
  formData.append("_token", csrfToken);
  if (webVersion) formData.append("web_version", webVersion);
  formData.append("email", emailUser);
  formData.append("subdomain", subdomain);
  formData.append("password", STD_PASS_VAL);

  const loginRes = await fetch(`${STD_URL}/login`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml",
      Cookie: cookies,
      Referer: `${STD_URL}/login`,
    },
    body: formData.toString(),
  });

  // After login, STD redirects to /home. Collect the session cookies.
  const sessionCookies = mergeCookies(cookies, extractCookies(loginRes));

  // Verify login worked by checking redirect location
  const location = loginRes.headers.get("location") || "";
  if (location.includes("login")) {
    throw new Error(`STD login failed — redirected to: ${location}`);
  }

  return {
    cookies: sessionCookies,
    csrfToken,
  };
}

/**
 * Fetch and parse an STD document page.
 */
export async function fetchSTDDocument(
  url: string,
  session: STDSession
): Promise<STDDocumentData | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PladetBot/1.0)",
        Accept: "text/html",
        Cookie: session.cookies,
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.error(`STD fetch failed for ${url}: ${res.status}`);
      return null;
    }

    const html = await res.text();

    // Check if we got redirected to login (session expired)
    if (html.includes('name="password"') && html.includes("/login")) {
      console.error("STD session expired — needs re-login");
      return null;
    }

    return parseSTDDocument(html, url);
  } catch (err) {
    console.error(`Error fetching STD document: ${url}`, err);
    return null;
  }
}

// ── HTML Parsing ──

function parseSTDDocument(html: string, sourceUrl: string): STDDocumentData {
  const $ = cheerio.load(html);

  // Helper to find label→value pairs in the detail section
  const getFieldValue = (label: string): string => {
    // Try multiple strategies to find field values
    // Strategy 1: Look for text content matching the label
    let value = "";

    $("td, th, dt, div, span, label").each((_, el) => {
      const text = $(el).text().trim();
      if (text.toLowerCase().startsWith(label.toLowerCase())) {
        // The value is in the next sibling or a nearby element
        const next = $(el).next();
        if (next.length) {
          value = next.text().trim();
        }
      }
    });

    if (value) return value;

    // Strategy 2: Look in table rows
    $("tr").each((_, row) => {
      const cells = $(row).find("td, th");
      cells.each((i, cell) => {
        if ($(cell).text().trim().toLowerCase().includes(label.toLowerCase())) {
          const nextCell = cells.eq(i + 1);
          if (nextCell.length) {
            value = nextCell.text().trim();
          }
        }
      });
    });

    return value;
  };

  // Extract main document fields
  const numero = getFieldValue("Número") || getFieldValue("Numero") || "";
  const periodo = getFieldValue("Periodo") || getFieldValue("Período") || "";
  const unidadRemitente = getFieldValue("Unidad Remitente") || "";
  const estadoUnidadAnterior = getFieldValue("Estado Unidad Anterior") || getFieldValue("Estado") || "";
  const asunto = getFieldValue("Asunto") || "";
  const unidadCreadora = getFieldValue("Unidad Creadora") || "";
  const fechaCreado = getFieldValue("Fecha Creado") || getFieldValue("Fecha Creación") || "";
  const ultimaModificacion = getFieldValue("Última Modificación") || getFieldValue("Ultima Modificacion") || "";
  const tramiteOrigen = getFieldValue("Trámite Origen") || getFieldValue("Tramite Origen") || "";

  // Extract motivos (may be a list)
  const motivos: string[] = [];
  const motivoSection = getFieldValue("Motivo");
  if (motivoSection) {
    motivoSection.split(/[,\n]/).forEach((m) => {
      const cleaned = m.trim();
      if (cleaned) motivos.push(cleaned);
    });
  }

  // Extract "Cuerpo del Documento" — the main body text
  let cuerpoDocumento = "";
  const bodyHeader = $("*").filter((_, el) =>
    $(el).text().trim() === "Cuerpo del Documento" ||
    $(el).text().trim() === "Cuerpo del documento"
  );
  if (bodyHeader.length) {
    // Get all text after the header until the next section
    let nextEl = bodyHeader.first().parent().next();
    const bodyParts: string[] = [];
    let count = 0;
    while (nextEl.length && count < 20) {
      const text = nextEl.text().trim();
      // Stop at section headers like "Archivos", "Historial", etc.
      if (/^(Archivos|Comentarios|Historial|Trámites|Compartidos)/i.test(text)) break;
      if (text) bodyParts.push(text);
      nextEl = nextEl.next();
      count++;
    }
    cuerpoDocumento = bodyParts.join("\n");
  }

  // Fallback: try to get body from a specific div/section
  if (!cuerpoDocumento) {
    // Look for any large text block that could be the body
    $("div, p").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 100 && text.includes("solicita") || text.includes("Estimad")) {
        if (!cuerpoDocumento || text.length > cuerpoDocumento.length) {
          cuerpoDocumento = text;
        }
      }
    });
  }

  // Extract archivos (file attachments)
  const archivos: string[] = [];
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();
    if (href.includes("archivo") || href.includes("download") || href.includes("file")) {
      if (text) archivos.push(text);
    }
  });

  // Extract Historial Externo table
  const historialExterno: STDHistoryEntry[] = [];
  // Find the table after "Historial Externo" heading
  const tables = $("table");
  tables.each((_, table) => {
    const headers = $(table).find("th").map((_, th) => $(th).text().trim().toLowerCase()).get();
    if (headers.some((h) => h.includes("origen")) && headers.some((h) => h.includes("destino"))) {
      $(table)
        .find("tbody tr, tr")
        .each((_, row) => {
          const cells = $(row).find("td");
          if (cells.length >= 5) {
            historialExterno.push({
              origen: cells.eq(0).text().trim(),
              movimiento: cells.eq(1).text().trim(),
              destino: cells.eq(2).text().trim(),
              estado: cells.eq(3).text().trim(),
              comentario: cells.eq(4).text().trim(),
              fecha: cells.eq(5)?.text()?.trim() || "",
            });
          }
        });
    }
  });

  return {
    numero,
    periodo,
    unidadRemitente,
    estadoUnidadAnterior,
    motivos,
    asunto,
    unidadCreadora,
    fechaCreado,
    ultimaModificacion,
    tramiteOrigen,
    cuerpoDocumento: cuerpoDocumento.slice(0, 3000),
    archivos,
    historialExterno,
    sourceUrl,
  };
}

// ── Utility Functions ──

function extractCookies(response: Response): string {
  const setCookie = response.headers.getSetCookie?.() || [];
  return setCookie
    .map((c) => c.split(";")[0])
    .join("; ");
}

function mergeCookies(existing: string, newCookies: string): string {
  const cookieMap = new Map<string, string>();

  // Parse existing
  existing.split("; ").forEach((c) => {
    const [key, ...rest] = c.split("=");
    if (key) cookieMap.set(key.trim(), rest.join("="));
  });

  // Parse new (overwrite)
  newCookies.split("; ").forEach((c) => {
    const [key, ...rest] = c.split("=");
    if (key) cookieMap.set(key.trim(), rest.join("="));
  });

  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// ── Data Extraction from STD Document ──

/**
 * Extract structured project data from an STD document.
 * This converts raw STD data into fields useful for the Kanban.
 */
export function extractProjectFromSTD(doc: STDDocumentData): {
  title: string;
  memorandumNumber: string;
  requestingUnit: string;
  description: string;
  budget: string;
  codigoUsa: string;
  plazoEjecucion: string;
  status: string;
} {
  const body = doc.cuerpoDocumento;

  // Extract budget: $X.XXX.XXX or $ X.XXX
  const budgetMatch = body.match(/\$\s*[\d.,]+/);
  const budget = budgetMatch ? budgetMatch[0].replace(/\s/g, "") : "";

  // Extract código USA: USA\d+_... pattern
  const usaMatch = body.match(/USA\d+[_\w.]*/i);
  const codigoUsa = usaMatch ? usaMatch[0] : "";

  // Extract plazo de ejecución
  const plazoMatch = body.match(/plazo\s*(?:de\s*)?(?:ejecuci[oó]n\s*)?(?:de\s*)?(?:entre\s*)?(\d+(?:\s*(?:y|a)\s*\d+)?\s*d[ií]as?\s*(?:corridos|h[aá]biles)?)/i);
  const plazoEjecucion = plazoMatch ? plazoMatch[1] || plazoMatch[0] : "";

  // Determine status from historial
  let status = "recepcion_requerimiento";
  const latestHistory = doc.historialExterno[0]; // Assuming newest first
  if (latestHistory) {
    const estadoLower = latestHistory.estado.toLowerCase();
    const comentarioLower = latestHistory.comentario.toLowerCase();
    if (/aprobado/i.test(estadoLower)) {
      status = "gestion_compra";
    }
    if (/cdp.*emitido|orden\s*de\s*compra/i.test(comentarioLower)) {
      status = "gestion_compra";
    }
    if (/adjudicad/i.test(comentarioLower)) {
      status = "coordinacion_ejecucion";
    }
    if (/acta\s*de\s*inicio/i.test(comentarioLower)) {
      status = "en_ejecucion";
    }
  }

  // Clean title from asunto
  const title = doc.asunto
    .replace(/^solicita?\s*(CDP\s*para\s*)?[""]?/i, "")
    .replace(/[""]$/g, "")
    .trim() || `Memorándum ${doc.numero}/${doc.periodo}`;

  return {
    title,
    memorandumNumber: `MEM-${doc.periodo}-${doc.numero}`,
    requestingUnit: doc.unidadRemitente || doc.unidadCreadora,
    description: doc.cuerpoDocumento.slice(0, 500),
    budget,
    codigoUsa,
    plazoEjecucion,
    status,
  };
}
