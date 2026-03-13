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

const STATUS_COLORS: Record<string, string> = {
  recepcion_requerimiento: "#0ea5e9",
  asignacion_profesional: "#8b5cf6",
  en_diseno: "#6B7280",
  gestion_compra: "#F97316",
  coordinacion_ejecucion: "#4B5563",
  en_ejecucion: "#22c55e",
  terminada: "#64748b",
};

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

// Build timeline HTML for email
function buildTimelineHtml(currentStatus: string, tipoDesarrollo?: string, dashboardType?: string): string {
  const flow = getFlow(tipoDesarrollo, dashboardType);
  const currentIdx = flow.indexOf(currentStatus);

  const steps = flow.map((statusId, idx) => {
    const shortLabel = STATUS_SHORT[statusId] || statusId;
    const color = STATUS_COLORS[statusId] || "#9ca3af";
    const isPast = idx < currentIdx;
    const isCurrent = idx === currentIdx;
    const isFuture = idx > currentIdx;

    // Circle styling
    let circleStyle: string;
    let labelStyle: string;

    if (isCurrent) {
      circleStyle = `width:32px;height:32px;border-radius:50%;background:${color};border:3px solid ${color};display:inline-block;text-align:center;line-height:26px;color:#fff;font-size:13px;font-weight:700;box-shadow:0 0 0 4px ${color}33;`;
      labelStyle = `font-size:10px;color:${color};font-weight:700;margin-top:6px;`;
    } else if (isPast) {
      circleStyle = `width:32px;height:32px;border-radius:50%;background:${color};border:2px solid ${color};display:inline-block;text-align:center;line-height:28px;color:#fff;font-size:13px;font-weight:600;`;
      labelStyle = `font-size:10px;color:#6b7280;font-weight:500;margin-top:6px;`;
    } else {
      circleStyle = `width:32px;height:32px;border-radius:50%;background:#f3f4f6;border:2px solid #d1d5db;display:inline-block;text-align:center;line-height:28px;color:#9ca3af;font-size:13px;font-weight:500;`;
      labelStyle = `font-size:10px;color:#9ca3af;font-weight:400;margin-top:6px;`;
    }

    const checkOrNumber = isPast
      ? "&#10003;"
      : `${idx + 1}`;

    return { statusId, shortLabel, circleStyle, labelStyle, checkOrNumber, isPast, isCurrent, isFuture, color };
  });

  // Build the HTML table-based timeline (email-safe, no flexbox)
  const totalSteps = steps.length;
  const circleRow = steps
    .map((s, idx) => {
      // Connector line before the circle (except first)
      const connectorBefore = idx > 0
        ? `<td style="padding:0;height:3px;background:${s.isPast || s.isCurrent ? steps[idx - 1].color : '#e5e7eb'};width:100%;"></td>`
        : "";
      // Connector line after the circle (except last)
      const connectorAfter = idx < totalSteps - 1
        ? `<td style="padding:0;height:3px;background:${s.isPast ? s.color : '#e5e7eb'};width:100%;"></td>`
        : "";

      return `${connectorBefore}<td style="padding:0;text-align:center;width:32px;"><div style="${s.circleStyle}">${s.checkOrNumber}</div></td>${connectorAfter}`;
    })
    .join("");

  const labelRow = steps
    .map((s, idx) => {
      const connectorBefore = idx > 0 ? `<td style="padding:0;"></td>` : "";
      const connectorAfter = idx < totalSteps - 1 ? `<td style="padding:0;"></td>` : "";
      return `${connectorBefore}<td style="padding:0;text-align:center;width:32px;"><div style="${s.labelStyle}">${s.shortLabel}</div></td>${connectorAfter}`;
    })
    .join("");

  return `
    <div style="margin:20px 0 4px; padding:16px 8px; background:#fafafa; border-radius:8px;">
      <p style="margin:0 0 14px; font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; font-weight:600; text-align:center;">Progreso del proyecto</p>
      <table style="width:100%;border-collapse:collapse;table-layout:auto;" cellpadding="0" cellspacing="0">
        <tr style="vertical-align:middle;">${circleRow}</tr>
        <tr style="vertical-align:top;">${labelRow}</tr>
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
            <span style="background:#fee2e2; color:#991b1b; padding:3px 10px; border-radius:9999px; font-size:12px;">${prevLabel}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px; font-size:13px; color:#6b7280; width:40%;">Nuevo estado</td>
          <td style="padding:12px 16px; font-size:13px; color:#111827; font-weight:500;">
            <span style="background:#dcfce7; color:#166534; padding:3px 10px; border-radius:9999px; font-size:12px;">${newLabel}</span>
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
