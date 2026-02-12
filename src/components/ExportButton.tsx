"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { Project } from "@/types/project";
import {
  STATUSES,
  PROFESSIONALS,
  PRIORITIES,
  fmt,
  fmtDate,
  daysLeft,
  getProgress,
  getStatusObj,
} from "@/lib/constants";

interface ExportButtonProps {
  projects: Project[];
}

export default function ExportButton({ projects }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");

      // ── Sheet 1: All Projects ──
      const projectRows = projects.map((p) => {
        const statusObj = getStatusObj(p.status, p.tipoDesarrollo);
        const prof =
          p.jefeProyectoId !== undefined && p.jefeProyectoId >= 0
            ? PROFESSIONALS[p.jefeProyectoId]?.name || "—"
            : "—";
        const dl = daysLeft(p.dueDate);
        const progress = getProgress(p.status, p.subEtapas, p.tipoDesarrollo);
        const prioLabel = PRIORITIES[p.priority]?.label || p.priority;

        return {
          "Código PLADET": p.codigoProyectoUsa || "—",
          Título: p.title,
          Estado: statusObj.label,
          Prioridad: prioLabel,
          "Avance (%)": progress,
          "Jefe de Proyecto": prof,
          "Unidad Solicitante": p.requestingUnit || "—",
          Presupuesto: Number(p.budget) || 0,
          "Fecha Vencimiento": p.dueDate
            ? new Date(p.dueDate).toLocaleDateString("es-CL")
            : "—",
          "Días Restantes": dl !== null ? dl : "—",
          "Tipo Desarrollo": p.tipoDesarrollo || "—",
          "Disciplina Líder": p.disciplinaLider || "—",
          Sector: p.sector || "—",
          Descripción: p.description || "—",
          "Creado el": p.createdAt
            ? new Date(p.createdAt).toLocaleDateString("es-CL")
            : "—",
        };
      });

      const ws1 = XLSX.utils.json_to_sheet(projectRows);

      // Auto-width columns
      const colWidths = Object.keys(projectRows[0] || {}).map((key) => ({
        wch: Math.max(
          key.length + 2,
          ...projectRows.map((r) =>
            String((r as Record<string, unknown>)[key] || "").length
          ),
          10
        ),
      }));
      ws1["!cols"] = colWidths;

      // ── Sheet 2: Summary by Status ──
      const statusSummary = STATUSES.map((status) => {
        const count = projects.filter((p) => p.status === status.id).length;
        const budget = projects
          .filter((p) => p.status === status.id)
          .reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
        return {
          Estado: status.label,
          "Cant. Proyectos": count,
          "Presupuesto Total": budget,
        };
      });
      statusSummary.push({
        Estado: "TOTAL",
        "Cant. Proyectos": projects.length,
        "Presupuesto Total": projects.reduce(
          (sum, p) => sum + (Number(p.budget) || 0),
          0
        ),
      });
      const ws2 = XLSX.utils.json_to_sheet(statusSummary);
      ws2["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 22 }];

      // ── Sheet 3: Workload by Professional ──
      const profSummary = PROFESSIONALS.map((prof, idx) => {
        const assigned = projects.filter((p) => p.jefeProyectoId === idx);
        const active = assigned.filter((p) => p.status !== "terminada");
        const overdueCount = active.filter((p) => {
          const dl2 = daysLeft(p.dueDate);
          return dl2 !== null && dl2 < 0;
        }).length;
        return {
          Profesional: prof.name,
          Rol: prof.role,
          "Total Asignados": assigned.length,
          Activos: active.length,
          Terminados: assigned.length - active.length,
          Atrasados: overdueCount,
        };
      }).filter((r) => r["Total Asignados"] > 0);
      const ws3 = XLSX.utils.json_to_sheet(profSummary);
      ws3["!cols"] = [
        { wch: 40 },
        { wch: 25 },
        { wch: 16 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
      ];

      // ── Sheet 4: Overdue Projects ──
      const overdueProjects = projects
        .filter((p) => {
          if (p.status === "terminada") return false;
          const dl2 = daysLeft(p.dueDate);
          return dl2 !== null && dl2 < 0;
        })
        .map((p) => {
          const statusObj = getStatusObj(p.status, p.tipoDesarrollo);
          const dl2 = daysLeft(p.dueDate);
          const prof =
            p.jefeProyectoId !== undefined && p.jefeProyectoId >= 0
              ? PROFESSIONALS[p.jefeProyectoId]?.name || "—"
              : "—";
          return {
            "Código PLADET": p.codigoProyectoUsa || "—",
            Título: p.title,
            Estado: statusObj.label,
            "Jefe de Proyecto": prof,
            "Fecha Vencimiento": p.dueDate
              ? new Date(p.dueDate).toLocaleDateString("es-CL")
              : "—",
            "Días de Atraso": dl2 !== null ? Math.abs(dl2) : "—",
            Presupuesto: Number(p.budget) || 0,
          };
        });
      const ws4 = XLSX.utils.json_to_sheet(
        overdueProjects.length > 0
          ? overdueProjects
          : [{ Mensaje: "No hay proyectos atrasados" }]
      );
      ws4["!cols"] = [
        { wch: 18 },
        { wch: 40 },
        { wch: 25 },
        { wch: 35 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
      ];

      // ── Create Workbook ──
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, "Proyectos");
      XLSX.utils.book_append_sheet(wb, ws2, "Resumen por Estado");
      XLSX.utils.book_append_sheet(wb, ws3, "Carga Profesional");
      XLSX.utils.book_append_sheet(wb, ws4, "Proyectos Atrasados");

      // Download
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      XLSX.writeFile(wb, `Reporte_PLADET_${dateStr}.xlsx`);
    } catch (error) {
      console.error("Error exporting Excel:", error);
    }
    setExporting(false);
    setOpen(false);
  };

  const handlePrintReport = () => {
    // Build a printable HTML report
    const total = projects.length;
    const terminados = projects.filter((p) => p.status === "terminada").length;
    const activos = total - terminados;
    const overdue = projects.filter((p) => {
      if (p.status === "terminada") return false;
      const dl2 = daysLeft(p.dueDate);
      return dl2 !== null && dl2 < 0;
    });
    const totalBudget = projects.reduce(
      (sum, p) => sum + (Number(p.budget) || 0),
      0
    );

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const statusRows = STATUSES.map((s) => {
      const count = projects.filter((p) => p.status === s.id).length;
      const budget = projects
        .filter((p) => p.status === s.id)
        .reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
      return `<tr>
        <td style="padding:8px;border:1px solid #ddd;"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${s.color};margin-right:8px;vertical-align:middle;"></span>${s.label}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;font-weight:600;">${count}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">${fmt(budget)}</td>
      </tr>`;
    }).join("");

    const projectTableRows = projects
      .map((p) => {
        const statusObj = getStatusObj(p.status, p.tipoDesarrollo);
        const prof =
          p.jefeProyectoId !== undefined && p.jefeProyectoId >= 0
            ? PROFESSIONALS[p.jefeProyectoId]?.name || "—"
            : "—";
        const dl = daysLeft(p.dueDate);
        const progress = getProgress(p.status, p.subEtapas, p.tipoDesarrollo);
        const isOverdue = dl !== null && dl < 0;

        return `<tr style="${isOverdue ? "background:#fef2f2;" : ""}">
          <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;">${p.codigoProyectoUsa || "—"}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;font-weight:500;">${p.title}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusObj.color};margin-right:6px;"></span>${statusObj.label}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;">${prof}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;text-align:center;">${progress}%</td>
          <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;text-align:right;">${fmt(Number(p.budget) || 0)}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;${isOverdue ? "color:#dc2626;font-weight:600;" : ""}">${fmtDate(p.dueDate)}${isOverdue ? ` (${Math.abs(dl!)}d)` : ""}</td>
        </tr>`;
      })
      .join("");

    const now = new Date();
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte PLADET - ${now.toLocaleDateString("es-CL")}</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #333; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #00A499; padding-bottom: 16px; margin-bottom: 30px; }
    .header h1 { font-size: 22px; color: #00A499; margin: 0; }
    .header .date { font-size: 13px; color: #666; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 30px; }
    .kpi { padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: center; }
    .kpi .value { font-size: 28px; font-weight: 700; }
    .kpi .label { font-size: 11px; color: #666; text-transform: uppercase; margin-top: 4px; }
    h2 { font-size: 15px; color: #00A499; text-transform: uppercase; letter-spacing: 1px; margin-top: 30px; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f8fafc; padding: 8px; border: 1px solid #ddd; text-align: left; font-size: 11px; text-transform: uppercase; color: #555; }
    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Reporte de Gestión PLADET</h1>
      <div style="font-size:13px;color:#666;margin-top:4px;">Dirección de Planificación y Desarrollo Territorial — USACH</div>
    </div>
    <div class="date">${now.toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
  </div>

  <div class="kpi-grid">
    <div class="kpi"><div class="value" style="color:#0ea5e9;">${total}</div><div class="label">Total Proyectos</div></div>
    <div class="kpi"><div class="value" style="color:#22c55e;">${activos}</div><div class="label">Activos</div></div>
    <div class="kpi"><div class="value" style="color:#ef4444;">${overdue.length}</div><div class="label">Atrasados</div></div>
    <div class="kpi"><div class="value" style="color:#14b8a6;">${fmt(totalBudget)}</div><div class="label">Presupuesto Total</div></div>
  </div>

  <h2>Resumen por Estado</h2>
  <table>
    <thead><tr><th>Estado</th><th style="text-align:center;">Cantidad</th><th style="text-align:right;">Presupuesto</th></tr></thead>
    <tbody>${statusRows}
      <tr style="font-weight:700;background:#f0fdfa;">
        <td style="padding:8px;border:1px solid #ddd;">TOTAL</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;">${total}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">${fmt(totalBudget)}</td>
      </tr>
    </tbody>
  </table>

  <h2>Listado de Proyectos</h2>
  <table>
    <thead><tr><th>Código</th><th>Título</th><th>Estado</th><th>Jefe Proyecto</th><th style="text-align:center;">Avance</th><th style="text-align:right;">Presupuesto</th><th>Vencimiento</th></tr></thead>
    <tbody>${projectTableRows}</tbody>
  </table>

  <div class="footer">
    Generado automáticamente por Sistema de Gestión PLADET — ${now.toLocaleDateString("es-CL")} ${now.toLocaleTimeString("es-CL")}
  </div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:shadow-sm transition-all shadow-sm"
      >
        <Download size={16} className="text-[#00A499]" />
        Exportar
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-40 overflow-hidden">
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-teal-50 transition-colors text-left"
            >
              <FileSpreadsheet size={18} className="text-green-600" />
              <div>
                <p className="font-medium">
                  {exporting ? "Exportando..." : "Exportar a Excel"}
                </p>
                <p className="text-[11px] text-gray-400">
                  Descarga .xlsx con 4 hojas
                </p>
              </div>
            </button>
            <div className="border-t border-gray-100" />
            <button
              onClick={handlePrintReport}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-teal-50 transition-colors text-left"
            >
              <Printer size={18} className="text-blue-600" />
              <div>
                <p className="font-medium">Imprimir / PDF</p>
                <p className="text-[11px] text-gray-400">
                  Reporte imprimible con KPIs
                </p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
