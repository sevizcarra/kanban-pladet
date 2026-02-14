import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  return new Resend(apiKey);
}

const STATUSES = [
  { id: "recepcion_requerimiento", label: "Recepción Requerimiento", short: "Recepción" },
  { id: "asignacion_profesional", label: "En Asignación de Profesional", short: "Asignación" },
  { id: "en_diseno", label: "En Diseño", short: "Diseño" },
  { id: "gestion_compra", label: "En Gestión de Compra", short: "Gestión Compra" },
  { id: "coordinacion_ejecucion", label: "En Coord. de Ejecución", short: "Coord. Ejec." },
  { id: "en_ejecucion", label: "En Ejecución", short: "Ejecución" },
  { id: "terminada", label: "Terminada", short: "Terminada" },
];

function getStatusIndex(statusId: string): number {
  return STATUSES.findIndex((s) => s.id === statusId);
}

function getStatusLabel(statusId: string): string {
  return STATUSES.find((s) => s.id === statusId)?.label || statusId;
}

function buildProgressSteps(currentStatusId: string): string {
  const currentIdx = getStatusIndex(currentStatusId);
  return STATUSES.map((s, i) => {
    let circleStyle = "";
    let labelStyle = "";
    let content = `${i + 1}`;

    if (i < currentIdx) {
      circleStyle = "background:#22c55e;";
      labelStyle = "color:#22c55e; font-weight:600;";
      content = "✓";
    } else if (i === currentIdx) {
      circleStyle = "background:linear-gradient(135deg, #F97316, #FB923C);";
      labelStyle = "color:#F97316; font-weight:700;";
    } else {
      circleStyle = "background:#e5e7eb;";
      labelStyle = "color:#9ca3af;";
    }

    return `<td width="14.28%" style="text-align:center; padding:8px 2px;">
      <div style="width:22px; height:22px; margin:0 auto 4px; ${circleStyle} border-radius:50%; line-height:22px; font-size:10px; color:#fff; font-weight:700;">${content}</div>
      <div style="font-size:8px; ${labelStyle} line-height:1.2;">${s.short}</div>
    </td>`;
  }).join("");
}

function buildProgressBar(currentStatusId: string): string {
  const idx = getStatusIndex(currentStatusId);
  const pct = Math.round(((idx + 1) / STATUSES.length) * 100);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
    <tr><td style="background:#e5e7eb; border-radius:8px; height:10px; padding:0;">
      <div style="background:linear-gradient(90deg, #F97316, #FB923C); width:${pct}%; height:10px; border-radius:8px;"></div>
    </td></tr>
  </table>`;
}

function emailHeader(): string {
  return `<tr>
    <td style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding:0;">
      <div style="height:4px; background:linear-gradient(90deg, #F97316, #FB923C, #F97316);"></div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:24px 36px;">
          <div style="font-size:16px; font-weight:700; color:#ffffff; line-height:1.3;">Dirección de Planificación<br>y Desarrollo Territorial</div>
          <div style="font-size:11px; color:#9ca3af; letter-spacing:1px; text-transform:uppercase; margin-top:4px;">Universidad de Santiago de Chile</div>
        </td></tr>
      </table>
    </td>
  </tr>`;
}

function emailFooter(): string {
  return `<tr>
    <td style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:24px 36px;">
      <p style="margin:0 0 4px; font-size:12px; color:#9ca3af; text-align:center;">
        Dirección de Planificación y Desarrollo Territorial — USACH
      </p>
      <p style="margin:0; font-size:11px; color:#d1d5db; text-align:center;">
        Este es un correo automático. Por favor no responder a este mensaje.
      </p>
    </td>
  </tr>`;
}

function buildCreationEmail(data: {
  contactName: string;
  projectName: string;
  projectCode: string;
  status: string;
  tipoDesarrollo: string;
  tipoLicitacion: string;
  disciplinaLider: string;
  jefeProyecto: string;
}): string {
  return `<div style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.06);">
          ${emailHeader()}
          <tr><td style="padding:36px;">
            <p style="margin:0 0 20px; font-size:15px; color:#374151; line-height:1.6;">
              Hola <strong style="color:#1f2937;">${data.contactName}</strong>,
            </p>
            <p style="margin:0 0 28px; font-size:15px; color:#374151; line-height:1.6;">
              Se ha creado un nuevo proyecto asociado a tu solicitud. A continuación los detalles:
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; margin-bottom:28px;">
              <tr><td style="padding:20px 24px 0;">
                <div style="display:inline-block; background:linear-gradient(135deg, #F97316, #FB923C); color:#fff; font-size:12px; font-weight:700; padding:4px 12px; border-radius:6px; letter-spacing:0.5px;">
                  ${data.projectCode}
                </div>
              </td></tr>
              <tr><td style="padding:12px 24px 0;">
                <div style="font-size:17px; font-weight:700; color:#1f2937;">${data.projectName}</div>
              </td></tr>
              <tr><td style="padding:16px 24px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="50%" style="padding:6px 0;"><div style="font-size:11px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">Estado actual</div><div style="font-size:14px; color:#1f2937; font-weight:600;">${getStatusLabel(data.status)}</div></td>
                    <td width="50%" style="padding:6px 0;"><div style="font-size:11px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">Tipo</div><div style="font-size:14px; color:#1f2937; font-weight:600;">${data.tipoDesarrollo}</div></td>
                  </tr>
                  <tr>
                    <td width="50%" style="padding:6px 0;"><div style="font-size:11px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">Licitación</div><div style="font-size:14px; color:#1f2937; font-weight:600;">${data.tipoLicitacion}</div></td>
                    <td width="50%" style="padding:6px 0;"><div style="font-size:11px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">Disciplina Líder</div><div style="font-size:14px; color:#1f2937; font-weight:600;">${data.disciplinaLider}</div></td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding:6px 0;"><div style="font-size:11px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">Jefe de Proyecto</div><div style="font-size:14px; color:#1f2937; font-weight:600;">${data.jefeProyecto}</div></td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <p style="margin:0 0 12px; font-size:13px; font-weight:700; color:#1f2937; text-transform:uppercase; letter-spacing:0.5px;">Avance del proyecto</p>
            ${buildProgressBar(data.status)}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>${buildProgressSteps(data.status)}</tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:14px 18px;">
                <p style="margin:0; font-size:13px; color:#92400e; line-height:1.5;">
                  📬 Recibirás una notificación cada vez que tu proyecto avance de etapa. No es necesario que respondas a este correo.
                </p>
              </td></tr>
            </table>
          </td></tr>
          ${emailFooter()}
        </table>
      </td></tr>
    </table>
  </div>`;
}

function buildStatusChangeEmail(data: {
  contactName: string;
  projectName: string;
  projectCode: string;
  previousStatus: string;
  newStatus: string;
}): string {
  return `<div style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.06);">
          ${emailHeader()}
          <tr><td style="padding:36px;">
            <p style="margin:0 0 20px; font-size:15px; color:#374151; line-height:1.6;">
              Hola <strong style="color:#1f2937;">${data.contactName}</strong>,
            </p>
            <p style="margin:0 0 28px; font-size:15px; color:#374151; line-height:1.6;">
              Tu proyecto ha avanzado a una nueva etapa:
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; margin-bottom:28px;">
              <tr><td style="padding:20px 24px 0;">
                <div style="display:inline-block; background:linear-gradient(135deg, #F97316, #FB923C); color:#fff; font-size:12px; font-weight:700; padding:4px 12px; border-radius:6px;">${data.projectCode}</div>
              </td></tr>
              <tr><td style="padding:12px 24px 20px;">
                <div style="font-size:17px; font-weight:700; color:#1f2937;">${data.projectName}</div>
              </td></tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td align="center" style="padding:8px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  <td style="text-align:center; padding:0 12px;">
                    <div style="font-size:10px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Etapa anterior</div>
                    <div style="background:#e5e7eb; color:#6b7280; font-size:13px; font-weight:600; padding:8px 16px; border-radius:8px;">${getStatusLabel(data.previousStatus)}</div>
                  </td>
                  <td style="padding:12px 8px 0; font-size:22px; color:#F97316;">→</td>
                  <td style="text-align:center; padding:0 12px;">
                    <div style="font-size:10px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Nueva etapa</div>
                    <div style="background:linear-gradient(135deg, #F97316, #FB923C); color:#ffffff; font-size:13px; font-weight:600; padding:8px 16px; border-radius:8px;">${getStatusLabel(data.newStatus)}</div>
                  </td>
                </tr></table>
              </td></tr>
            </table>
            <p style="margin:0 0 12px; font-size:13px; font-weight:700; color:#1f2937; text-transform:uppercase; letter-spacing:0.5px;">Avance del proyecto</p>
            ${buildProgressBar(data.newStatus)}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>${buildProgressSteps(data.newStatus)}</tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:14px 18px;">
                <p style="margin:0; font-size:13px; color:#92400e; line-height:1.5;">
                  📬 Seguirás recibiendo notificaciones a medida que tu proyecto avance. No es necesario que respondas a este correo.
                </p>
              </td></tr>
            </table>
          </td></tr>
          ${emailFooter()}
        </table>
      </td></tr>
    </table>
  </div>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, to, ...data } = body;

    if (!to || to === "—") {
      return NextResponse.json(
        { error: "No hay correo de contacto registrado" },
        { status: 400 }
      );
    }

    let subject = "";
    let html = "";

    if (type === "creation") {
      subject = `Nuevo proyecto creado: ${data.projectName}`;
      html = buildCreationEmail(data);
    } else if (type === "status_change") {
      subject = `Tu proyecto "${data.projectName}" avanzó de etapa`;
      html = buildStatusChangeEmail(data);
    } else {
      return NextResponse.json({ error: "Tipo no válido" }, { status: 400 });
    }

    const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    const resend = getResend();
    const result = await resend.emails.send({
      from: `PLADET <${fromAddress}>`,
      to: [to],
      subject,
      html,
    });

    if (result.error) {
      console.error("Resend API error:", JSON.stringify(result.error));
      return NextResponse.json(
        { error: result.error.message || "Error en servicio de correo" },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, id: result.data?.id });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Error al enviar correo" },
      { status: 500 }
    );
  }
}
