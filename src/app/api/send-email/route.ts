import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Status ID → human-readable label
const STATUS_LABELS: Record<string, string> = {
  recepcion_requerimiento: "Recepción Requerimiento",
  asignacion_profesional: "En Asignación de Profesional",
  en_diseno: "En Diseño",
  gestion_compra: "En Gestión de Compra",
  coordinacion_ejecucion: "En Coord. de Ejecución",
  en_ejecucion: "En Ejecución",
  terminada: "Terminada",
};

const statusLabel = (id: string) => STATUS_LABELS[id] || id;

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
}) {
  const prevLabel = statusLabel(data.previousStatus);
  const newLabel = statusLabel(data.newStatus);

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
      });
    } else if (type === "status_change") {
      subject = `[PLADET] Cambio de estado: ${body.projectName}`;
      html = buildStatusChangeHtml({
        contactName: contactName || "Estimado/a",
        projectName: body.projectName,
        projectCode: body.projectCode,
        previousStatus: body.previousStatus,
        newStatus: body.newStatus,
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
