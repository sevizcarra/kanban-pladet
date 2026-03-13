import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Status ID → human-readable label
const STATUS_LABELS: Record<string, string> = {
  recepcion_requerimiento: "Recepción Requerimiento",
  asignacion_profesional: "Asignación Profesional",
  en_diseno: "En Diseño",
  gestion_compra: "Gestión de Compra",
  coordinacion_ejecucion: "Coord. Ejecución",
  en_ejecucion: "En Ejecución",
  terminada: "Terminada",
};

// Short labels for the timeline (compact)
const STATUS_SHORT: Record<string, string> = {
  recepcion_requerimiento: "Recepción",
  asignacion_profesional: "Asignación",
  en_diseno: "Diseño",
  gestion_compra: "Compra",
  coordinacion_ejecucion: "Coord. Ejec.",
  en_ejecucion: "Ejecución",
  terminada: "Terminada",
};

// Unified PLADET palette: orange for completed/current, gray for pending
const ORANGE = "#F97316";
const ORANGE_LIGHT = "#fff7ed";
const GRAY = "#d1d5db";
const GRAY_DARK = "#6b7280";
const GRAY_LIGHT = "#f3f4f6";

// Status flows by project type
const REGULAR_FLOW = [
  "recepcion_requerimiento",
  "asignacion_profesional",
  "en_diseno",
  "gestion_compra",
  "coordinacion_ejecucion",
  "en_ejecucion",
  "terminada",
];

const FTE_FLOW = [
  "recepcion_requerimiento",
  "asignacion_profesional",
  "en_diseno",
  "terminada",
];

const OBRAS_FLOW = [
  "recepcion_requerimiento",
  "asignacion_profesional",
  "coordinacion_ejecucion",
  "en_ejecucion",
  "terminada",
];

function getFlow(tipoDesarrollo?: string, dashboardType?: string): string[] {
  if (dashboardType === "obras") return OBRAS_FLOW;
  if (tipoDesarrollo === "FTE") return FTE_FLOW;
  return REGULAR_FLOW;
}

const statusLabel = (id: string) => STATUS_LABELS[id] || id;

// Build timeline HTML for email — PLADET palette (orange/gray/white)
function buildTimelineHtml(currentStatus: string, tipoDesarrollo?: string, dashboardType?: string): string {
  const flow = getFlow(tipoDesarrollo, dashboardType);
  const currentIdx = flow.indexOf(currentStatus);
  const total = flow.length;

  // Each step is one table cell with: optional left connector + circle + optional right connector + label below
  // We use a single-row table where each step is a <td> with fixed width and connectors use border-based approach
  const stepCells = flow.map((statusId, idx) => {
    const shortLabel = STATUS_SHORT[statusId] || statusId;
    const isPast = idx < currentIdx;
    const isCurrent = idx === currentIdx;

    // Circle
    let circleBg: string, circleBorder: string, circleColor: string, shadow: string;
    if (isCurrent) {
      circleBg = ORANGE;
      circleBorder = `3px solid ${ORANGE}`;
      circleColor = "#ffffff";
      shadow = `box-shadow:0 0 0 4px ${ORANGE}40;`;
    } else if (isPast) {
      circleBg = ORANGE;
      circleBorder = `2px solid ${ORANGE}`;
      circleColor = "#ffffff";
      shadow = "";
    } else {
      circleBg = "#ffffff";
      circleBorder = `2px solid ${GRAY}`;
      circleColor = GRAY;
      shadow = "";
    }

    const content = isPast ? "&#10003;" : `${idx + 1}`;
    const size = 28;
    const lineH = "24px";
    const fontSize = "12px";

    // Label
    let labelColor: string, labelWeight: string;
    if (isCurrent) {
      labelColor = ORANGE;
      labelWeight = "700";
    } else if (isPast) {
      labelColor = GRAY_DARK;
      labelWeight = "600";
    } else {
      labelColor = GRAY;
      labelWeight = "400";
    }

    // Connector lines: left half and right half inside each cell
    const leftLineColor = (isPast || isCurrent) ? ORANGE : GRAY_LIGHT;
    const rightLineColor = isPast ? ORANGE : GRAY_LIGHT;
    const showLeftLine = idx > 0;
    const showRightLine = idx < total - 1;

    return `<td style="padding:0;text-align:center;vertical-align:top;width:${Math.floor(100 / total)}%;">
      <table style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0">
        <tr style="height:${size}px;">
          <td style="padding:0;vertical-align:middle;height:${size}px;">
            ${showLeftLine ? `<div style="height:3px;background:${leftLineColor};"></div>` : ``}
          </td>
          <td style="padding:0;width:${size}px;height:${size}px;text-align:center;vertical-align:middle;">
            <div style="width:${size}px;height:${size}px;border-radius:50%;background:${circleBg};border:${circleBorder};text-align:center;line-height:${lineH};color:${circleColor};font-size:${fontSize};font-weight:700;${shadow}">
              ${content}
            </div>
          </td>
          <td style="padding:0;vertical-align:middle;height:${size}px;">
            ${showRightLine ? `<div style="height:3px;background:${rightLineColor};"></div>` : ``}
          </td>
        </tr>
        <tr>
          <td colspan="3" style="padding:5px 2px 0;text-align:center;">
            <span style="font-size:10px;color:${labelColor};font-weight:${labelWeight};line-height:1.2;">${shortLabel}</span>
          </td>
        </tr>
      </table>
    </td>`;
  }).join("");

  return `
    <div style="margin:20px 0 4px;padding:18px 4px 12px;background:${GRAY_LIGHT};border-radius:10px;border:1px solid #e5e7eb;">
      <p style="margin:0 0 16px;font-size:11px;color:${GRAY_DARK};text-transform:uppercase;letter-spacing:0.05em;font-weight:600;text-align:center;">Progreso del proyecto</p>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;" cellpadding="0" cellspacing="0">
        <tr>${stepCells}</tr>
      </table>
    </div>
  `;
}

// Shared email styles
const baseStyle = `
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
`;

const headerStyle = `
  background: linear-gradient(135deg, #F97316, #ea580c);
  padding: 28px 32px;
  text-align: center;
`;

function buildCreationHtml(data: {
  contactName: string;
  projectName: string;
  projectCode: string;
  status: string;
  tipoDesarrollo?: string;
  tipoLicitacion?: string;
  disciplinaLider?: string;
  jefeProyecto?: string;
  dashboardType?: string;
}) {
  const rows = [
    ["Código", data.projectCode],
    ["Estado", statusLabel(data.status)],
    ["Tipo de Desarrollo", data.tipoDesarrollo || "—"],
    ["Tipo de Licitación", data.tipoLicitacion || "—"],
    ["Disciplina Líder", data.disciplinaLider || "—"],
    ["Jefe de Proyecto", data.jefeProyecto || "Por asignar"],
  ];

  const tableRows = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding: 10px 16px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #f3f4f6; width: 40%;">${label}</td>
        <td style="padding: 10px 16px; font-size: 13px; color: #111827; font-weight: 500; border-bottom: 1px solid #f3f4f6;">${value}</td>
      </tr>`
    )
    .join("");

  const timeline = buildTimelineHtml(data.status, data.tipoDesarrollo, data.dashboardType);

  return `
  <div style="${baseStyle}">
    <div style="${headerStyle}">
      <h1 style="margin:0; color:#fff; font-size:20px; font-weight:700;">PLADET — Nuevo Proyecto</h1>
    </div>
    <div style="padding: 28px 32px;">
      <p style="font-size:14px; color:#374151; margin:0 0 8px;">
        Estimado/a <strong>${data.contactName}</strong>,
      </p>
      <p style="font-size:14px; color:#374151; margin:0 0 20px;">
        Se ha creado un nuevo proyecto en el sistema PLADET:
      </p>
      <div style="background:#fff7ed; border-left:4px solid #F97316; padding:12px 16px; border-radius:0 8px 8px 0; margin-bottom:20px;">
        <p style="margin:0; font-size:15px; font-weight:600; color:#9a3412;">${data.projectName}</p>
      </div>
      <table style="width:100%; border-collapse:collapse; border-radius:8px; overflow:hidden; border:1px solid #f3f4f6;">
        ${tableRows}
      </table>
      ${timeline}
      <p style="font-size:12px; color:#9ca3af; margin:24px 0 0; text-align:center;">
        Este es un mensaje automático del sistema PLADET — Universidad de Santiago de Chile.
      </p>
    </div>
  </div>`;
}

function buildStatusChangeHtml(data: {
  contactName: string;
  projectName: string;
  projectCode: string;
  previousStatus: string;
  newStatus: string;
  tipoDesarrollo?: string;
  dashboardType?: string;
}) {
  const prevLabel = statusLabel(data.previousStatus);
  const newLabel = statusLabel(data.newStatus);
  const timeline = buildTimelineHtml(data.newStatus, data.tipoDesarrollo, data.dashboardType);

  return `
  <div style="${baseStyle}">
    <div style="${headerStyle}">
      <h1 style="margin:0; color:#fff; font-size:20px; font-weight:700;">PLADET — Cambio de Estado</h1>
    </div>
    <div style="padding: 28px 32px;">
      <p style="font-size:14px; color:#374151; margin:0 0 8px;">
        Estimado/a <strong>${data.contactName}</strong>,
      </p>
      <p style="font-size:14px; color:#374151; margin:0 0 20px;">
        Su proyecto ha cambiado de estado:
      </p>
      <div style="background:#fff7ed; border-left:4px solid #F97316; padding:12px 16px; border-radius:0 8px 8px 0; margin-bottom:20px;">
        <p style="margin:0; font-size:15px; font-weight:600; color:#9a3412;">${data.projectName}</p>
        <p style="margin:4px 0 0; font-size:12px; color:#9a3412;">Código: ${data.projectCode}</p>
      </div>
      <table style="width:100%; border-collapse:collapse; border:1px solid #f3f4f6; border-radius:8px; overflow:hidden;">
        <tr>
          <td style="padding:12px 16px; font-size:13px; color:#6b7280; border-bottom:1px solid #f3f4f6; width:40%;">Estado anterior</td>
          <td style="padding:12px 16px; font-size:13px; color:#111827; font-weight:500; border-bottom:1px solid #f3f4f6;">
            <span style="background:#f3f4f6; color:#6b7280; padding:3px 10px; border-radius:9999px; font-size:12px;">${prevLabel}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px; font-size:13px; color:#6b7280; width:40%;">Nuevo estado</td>
          <td style="padding:12px 16px; font-size:13px; color:#111827; font-weight:500;">
            <span style="background:#fff7ed; color:#c2410c; padding:3px 10px; border-radius:9999px; font-size:12px; font-weight:600;">${newLabel}</span>
          </td>
        </tr>
      </table>
      ${timeline}
      <p style="font-size:12px; color:#9ca3af; margin:24px 0 0; text-align:center;">
        Este es un mensaje automático del sistema PLADET — Universidad de Santiago de Chile.
      </p>
    </div>
  </div>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, to, contactName } = body;

    if (!to || !to.includes("@")) {
      return NextResponse.json({ error: "Invalid recipient email" }, { status: 400 });
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.error("SMTP_USER or SMTP_PASS not configured");
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: smtpUser, pass: smtpPass },
    });

    let subject: string;
    let html: string;

    if (type === "creation") {
      subject = `[PLADET] Nuevo Proyecto: ${body.projectName}`;
      html = buildCreationHtml({
        contactName: contactName || "Estimado/a",
        projectName: body.projectName,
        projectCode: body.projectCode,
        status: body.status,
        tipoDesarrollo: body.tipoDesarrollo,
        tipoLicitacion: body.tipoLicitacion,
        disciplinaLider: body.disciplinaLider,
        jefeProyecto: body.jefeProyecto,
        dashboardType: body.dashboardType,
      });
    } else if (type === "status_change") {
      subject = `[PLADET] Cambio de estado: ${body.projectName}`;
      html = buildStatusChangeHtml({
        contactName: contactName || "Estimado/a",
        projectName: body.projectName,
        projectCode: body.projectCode,
        previousStatus: body.previousStatus,
        newStatus: body.newStatus,
        tipoDesarrollo: body.tipoDesarrollo,
        dashboardType: body.dashboardType,
      });
    } else {
      return NextResponse.json({ error: "Invalid email type" }, { status: 400 });
    }

    await transporter.sendMail({
      from: `"PLADET USACH" <${smtpUser}>`,
      to,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
