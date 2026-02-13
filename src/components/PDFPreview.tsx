"use client";

import { X, Download } from "lucide-react";
import {
  STATUSES,
  PROFESSIONALS,
  INSPECTORS,
  fmtDate,
  fmt,
  getStatusObj,
  getStatusIndex,
  getProgress,
} from "@/lib/constants";
import { Project } from "@/types/project";

interface PDFPreviewProps {
  project: Project;
  onClose: () => void;
}

export default function PDFPreview({ project, onClose }: PDFPreviewProps) {
  const handlePrint = () => {
    window.print();
  };

  // Get status info
  const statusObj = getStatusObj(project.status);
  const progress = getProgress(project.status, project.subEtapas);

  // Get priority label
  const priorityLabels: Record<string, string> = {
    alta: "Alta",
    media: "Media",
    baja: "Baja",
  };
  const priLabel = priorityLabels[project.priority] || project.priority;

  // Get project manager name
  const jp = project.jefeProyectoId !== undefined && project.jefeProyectoId >= 0
    ? PROFESSIONALS[project.jefeProyectoId]?.name || "—"
    : "—";

  // Get inspector name
  const insp = project.inspectorId !== undefined && project.inspectorId >= 0
    ? INSPECTORS[project.inspectorId] || "—"
    : "—";

  // Get specialists
  const specs = project.especialidades && project.especialidades.length > 0
    ? project.especialidades.join(", ")
    : "—";

  // Data sections
  const sections = [
    {
      title: "Información del Proyecto",
      rows: [
        ["Memorándum", project.memorandumNumber],
        ["Nombre", project.title],
        ["Unidad Requirente", project.requestingUnit],
        ["Contacto", project.contactName],
        ["Email", project.contactEmail],
        ["Prioridad", priLabel],
        ["Código USACH", project.codigoProyectoUsa],
      ],
    },
    {
      title: "Antecedentes Generales",
      rows: [
        ["Fecha Creación", fmtDate(new Date())],
        ["Fecha Est. Entrega", fmtDate(project.dueDate)],
        [
          "Monto Asignado",
          project.budget ? fmt(Number(project.budget)) : null,
        ],
        ["Tipo Financiamiento", project.tipoFinanciamiento],
      ],
    },
    {
      title: "Equipo del Proyecto",
      rows: [
        ["Jefe de Proyecto", jp],
        ["Inspector Técnico", insp],
        ["Especialistas", specs],
      ],
    },
    {
      title: "Antecedentes de Ejecución",
      rows: [
        ["Inicio de Obra", fmtDate(project.fechaInicioObra)],
        [
          "Plazo Ejecución",
          project.plazoEjecucion ? project.plazoEjecucion + " días" : null,
        ],
        ["Fecha Venc. Garantía", fmtDate(project.fechaVencGarantia)],
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">
            Vista previa del Resumen
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium"
            >
              <Download size={18} />
              Imprimir / Guardar PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 print:overflow-visible print:max-h-full">
          <div className="p-8 space-y-8 print:p-6 bg-white">
            {/* Header with gradient */}
            <div
              className="bg-gradient-to-r from-[#F97316] to-[#C2410C] text-white rounded-lg p-6"
              style={{
                background: "linear-gradient(to right, #F97316, #C2410C)",
              }}
            >
              <h1 className="text-2xl font-bold mb-1">
                Dirección de Planificación y Desarrollo Territorial
              </h1>
              <p className="text-orange-100">
                USACH — Sistema de Seguimiento de Proyectos
              </p>
            </div>

            {/* Title bar with status */}
            <div className="border-b-2 border-orange-600 pb-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {project.title}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Memorándum {project.memorandumNumber} · {project.codigoProyectoUsa}
                  </p>
                </div>
                <div className="text-right">
                  <div
                    className="inline-block px-4 py-2 rounded-full text-white font-semibold text-sm"
                    style={{ backgroundColor: statusObj.color }}
                  >
                    {statusObj.label}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{progress}% completado</p>
                </div>
              </div>
            </div>

            {/* Data sections */}
            {sections.map((section, idx) => (
              <div key={idx}>
                <h3 className="text-lg font-bold text-gray-900 pb-2 border-b-2 border-orange-600 mb-4">
                  {section.title}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {section.rows.map((row, rowIdx) => (
                        row[1] !== null && (
                          <tr key={rowIdx} className="border-b border-gray-200">
                            <td className="py-2 px-4 bg-gray-50 font-semibold text-gray-700 w-1/3">
                              {row[0]}
                            </td>
                            <td className="py-2 px-4 text-gray-600">
                              {row[1]}
                            </td>
                          </tr>
                        )
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Description box */}
            {project.description && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 pb-2 border-b-2 border-orange-600 mb-4">
                  Descripción
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 text-gray-700 whitespace-pre-wrap">
                  {project.description}
                </div>
              </div>
            )}

            {/* Status flow */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 pb-2 border-b-2 border-orange-600 mb-4">
                Flujo de Estado
              </h3>
              <div className="flex flex-wrap gap-2 items-center justify-between">
                {STATUSES.map((status, idx) => {
                  const currentIndex = getStatusIndex(project.status);
                  const isDone = idx < currentIndex;
                  const isCurrent = idx === currentIndex;
                  const isFuture = idx > currentIndex;

                  return (
                    <div
                      key={status.id}
                      className="flex items-center gap-2"
                      style={{ flex: "1 1 auto", minWidth: "120px" }}
                    >
                      <div
                        className={`px-3 py-2 rounded-full text-xs font-semibold text-center transition-all ${
                          isDone
                            ? "text-white"
                            : isCurrent
                              ? "text-white ring-2 ring-offset-2"
                              : "bg-gray-200 text-gray-600"
                        }`}
                        style={{
                          backgroundColor: isDone || isCurrent ? status.color : undefined,
                          boxShadow: isCurrent ? `0 0 0 2px white, 0 0 0 4px ${status.color}` : undefined,
                        }}
                      >
                        {status.short}
                      </div>
                      {idx < STATUSES.length - 1 && (
                        <div
                          className="flex-1 h-1 bg-gray-300"
                          style={{
                            backgroundColor:
                              isDone || isCurrent ? status.color : "#d1d5db",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-sm text-gray-500 pt-6 border-t border-gray-200">
              Generado el {fmtDate(new Date())} · USACH
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .fixed {
            position: static;
            background: white !important;
            z-index: auto;
          }
          .bg-black\\/60 {
            background: white !important;
          }
          .max-h-\\[90vh\\] {
            max-height: 100% !important;
          }
          .overflow-y-auto {
            overflow: visible !important;
          }
          .flex-shrink-0 {
            flex-shrink: 1;
          }
        }
      `}</style>
    </div>
  );
}
