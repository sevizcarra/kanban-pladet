"use client";

import React, { useMemo, useRef, useState } from "react";
import { Project } from "@/types/project";
import {
  PROFESSIONALS,
  INSPECTORS,
  getStatusObj,
  getProgress,
  fmtDate,
  fmt,
} from "@/lib/constants";
import { ChevronLeft, ChevronRight, Download, Filter, Search } from "lucide-react";

interface IndicadorViewProps {
  projects: Project[];
  onProjectClick: (p: Project) => void;
}

// Column definition for each phase
interface ColDef {
  key: string;
  label: string;
  width: number;
  trackedField?: string; // field name to look up in fieldTimestamps (if different from key)
  render: (p: Project) => React.ReactNode;
}

// Phase grouping
interface PhaseGroup {
  id: string;
  label: string;
  color: string;    // header bg
  textColor: string; // header text
  borderColor: string;
  columns: ColDef[];
}

const shortName = (fullName: string) => {
  const parts = fullName.split(" ");
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return fullName;
};

const getJefeNombre = (id?: number) => {
  if (id === undefined || id < 0 || !PROFESSIONALS[id]) return "—";
  return shortName(PROFESSIONALS[id].name);
};

const getInspectorNombre = (id?: number) => {
  if (id === undefined || id < 0 || !INSPECTORS[id]) return "—";
  return shortName(INSPECTORS[id]);
};

const subEtapaLabels: Record<string, string> = {
  disenoArquitectura: "Diseño Arq.",
  disenoEspecialidades: "Diseño Esp.",
  compraCDP: "CDP",
  compraEnProceso: "Compra",
  compraEvaluacionAdj: "Evaluación",
  compraAceptacionOC: "OC Aceptada",
};

const renderSubEtapas = (p: Project) => {
  if (!p.subEtapas) return "—";
  const entries = Object.entries(p.subEtapas);
  if (entries.length === 0) return "—";
  const done = entries.filter(([, v]) => v).length;
  const total = entries.length;
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {entries.map(([key, val]) => (
          <div
            key={key}
            title={subEtapaLabels[key] || key}
            className={`w-2.5 h-2.5 rounded-sm ${
              val ? "bg-emerald-500" : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <span className="text-[10px] text-gray-500 ml-1">{done}/{total}</span>
    </div>
  );
};

const PHASES: PhaseGroup[] = [
  {
    id: "identificacion",
    label: "Identificación",
    color: "bg-slate-600",
    textColor: "text-white",
    borderColor: "border-slate-400",
    columns: [
      { key: "title", label: "Proyecto", width: 220, trackedField: "title", render: (p) => (
        <span className="font-semibold text-gray-900 leading-tight" title={p.title}>
          {p.title.length > 40 ? p.title.slice(0, 40) + "…" : p.title}
        </span>
      )},
      { key: "year", label: "Año", width: 50, render: (p) => p.createdAt ? new Date(p.createdAt).getFullYear() : "—" },
      { key: "memo", label: "Memorándum", width: 120, trackedField: "memorandumNumber", render: (p) => {
        if (p.memos && p.memos.length > 0) return p.memos.map(m => m.key).join(", ");
        return p.memorandumNumber || "—";
      }},
      { key: "fechaIngreso", label: "Fecha Ingreso", width: 95, render: (p) => fmtDate(p.createdAt) },
      { key: "unit", label: "Unidad", width: 100, trackedField: "requestingUnit", render: (p) => p.requestingUnit || "—" },
      { key: "tipo", label: "Tipo", width: 80, trackedField: "tipoLicitacion", render: (p) => p.tipoLicitacion || "—" },
      { key: "recinto", label: "Recinto", width: 110, trackedField: "recinto", render: (p) => p.recinto || "—" },
      { key: "status", label: "Estado", width: 130, trackedField: "status", render: (p) => {
        const s = getStatusObj(p.status, p.tipoDesarrollo, p.dashboardType);
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: `${s.color}22`, color: s.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        );
      }},
    ],
  },
  {
    id: "diseno",
    label: "Diseño",
    color: "bg-blue-600",
    textColor: "text-white",
    borderColor: "border-blue-400",
    columns: [
      { key: "visitaTerreno", label: "Visita Terreno", width: 95, trackedField: "fechaVisitaTerreno", render: (p) => fmtDate(p.fechaVisitaTerreno) },
      { key: "jefe", label: "Jefe Proyecto", width: 120, trackedField: "jefeProyectoId", render: (p) => getJefeNombre(p.jefeProyectoId) },
      { key: "disciplina", label: "Disciplina Líder", width: 90, trackedField: "disciplinaLider", render: (p) => p.disciplinaLider || "—" },
      { key: "subetapas", label: "Sub-Etapas", width: 100, trackedField: "subEtapas", render: renderSubEtapas },
      { key: "avance", label: "Avance", width: 70, render: (p) => {
        const pct = getProgress(p.status, p.subEtapas, p.tipoDesarrollo, p.dashboardType);
        const color = pct >= 80 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-gray-500";
        return <span className={`font-bold ${color}`}>{pct}%</span>;
      }},
      { key: "dueDate", label: "Fecha Entrega", width: 95, trackedField: "dueDate", render: (p) => fmtDate(p.dueDate) },
    ],
  },
  {
    id: "compra",
    label: "Compra",
    color: "bg-amber-600",
    textColor: "text-white",
    borderColor: "border-amber-400",
    columns: [
      { key: "budget", label: "Presupuesto", width: 100, trackedField: "budget", render: (p) => p.budget && Number(p.budget) > 0 ? fmt(Number(p.budget)) : "—" },
      { key: "tipoFin", label: "Financiamiento", width: 95, trackedField: "tipoFinanciamiento", render: (p) => p.tipoFinanciamiento || "—" },
      { key: "tipoLic", label: "Licitación", width: 80, trackedField: "tipoLicitacion", render: (p) => p.tipoLicitacion || "—" },
      { key: "fechaLic", label: "Fecha Licitación", width: 95, trackedField: "fechaLicitacion", render: (p) => fmtDate(p.fechaLicitacion) },
      { key: "idLic", label: "ID Licitación", width: 95, trackedField: "idLicitacion", render: (p) => p.idLicitacion || "—" },
    ],
  },
  {
    id: "ejecucion",
    label: "Ejecución",
    color: "bg-emerald-600",
    textColor: "text-white",
    borderColor: "border-emerald-400",
    columns: [
      { key: "inspector", label: "ITO", width: 120, trackedField: "inspectorId", render: (p) => getInspectorNombre(p.inspectorId) },
      { key: "fechaInicio", label: "Inicio Obra", width: 95, trackedField: "fechaInicioObra", render: (p) => fmtDate(p.fechaInicioObra) },
      { key: "plazo", label: "Plazo Ejec.", width: 75, trackedField: "plazoEjecucion", render: (p) => p.plazoEjecucion ? `${p.plazoEjecucion} días` : "—" },
      { key: "fechaTermino", label: "Término Est.", width: 95, trackedField: "fechaEstimadaTermino", render: (p) => fmtDate(p.fechaEstimadaTermino) },
      { key: "recProv", label: "Rec. Provisoria", width: 95, trackedField: "fechaRecProviso", render: (p) => fmtDate(p.fechaRecProviso) },
      { key: "recDef", label: "Rec. Definitiva", width: 95, trackedField: "fechaRecDefinitiva", render: (p) => fmtDate(p.fechaRecDefinitiva) },
    ],
  },
];

export default function IndicadorView({ projects, onProjectClick }: IndicadorViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [filterDashboard, setFilterDashboard] = useState<"all" | "compras" | "obras">("all");

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (filterDashboard === "compras" && p.dashboardType === "obras") return false;
      if (filterDashboard === "obras" && p.dashboardType !== "obras") return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          p.title.toLowerCase().includes(s) ||
          (p.memorandumNumber && p.memorandumNumber.toLowerCase().includes(s)) ||
          (p.recinto && p.recinto.toLowerCase().includes(s)) ||
          (p.requestingUnit && p.requestingUnit.toLowerCase().includes(s))
        );
      }
      return true;
    });
  }, [projects, search, filterDashboard]);

  // Stats
  const stats = useMemo(() => {
    const total = filtered.length;
    const terminados = filtered.filter((p) => p.status === "terminada").length;
    const enDiseno = filtered.filter((p) =>
      ["recepcion_requerimiento", "asignacion_profesional", "en_diseno"].includes(p.status)
    ).length;
    const enCompra = filtered.filter((p) => p.status === "gestion_compra").length;
    const enEjecucion = filtered.filter((p) =>
      ["coordinacion_ejecucion", "en_ejecucion"].includes(p.status)
    ).length;
    const withBudget = filtered.filter((p) => p.budget && Number(p.budget) > 0);
    const totalBudget = withBudget.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    return { total, terminados, enDiseno, enCompra, enEjecucion, totalBudget };
  }, [filtered]);

  const allCols = PHASES.flatMap((ph) => ph.columns);
  const ROW_HEIGHT = 52;
  const HEADER_HEIGHT = 28;
  const PHASE_HEADER_HEIGHT = 28;

  // Helper to get field timestamp for a project
  const getFieldTs = (p: Project, fieldName?: string): string | null => {
    if (!fieldName || !p.fieldTimestamps) return null;
    return p.fieldTimestamps[fieldName] || null;
  };

  const fmtShortDate = (iso: string) => {
    const d = new Date(iso);
    const dd = d.getDate().toString().padStart(2, "0");
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const yy = d.getFullYear().toString().slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  // Row number column
  const ROW_NUM_WIDTH = 32;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/50">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
            Indicador de Proyectos 2026
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Consolidado automático del ciclo de vida de proyectos
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
            {(["all", "compras", "obras"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFilterDashboard(opt)}
                className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  filterDashboard === opt
                    ? "bg-[#F97316] text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {opt === "all" ? "Todos" : opt === "compras" ? "Compras" : "Obras"}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-1 focus:ring-[#F97316] focus:border-[#F97316] outline-none w-40"
            />
          </div>
          <span className="text-[10px] text-gray-400">{filtered.length} proyectos</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-6 gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/30">
        {[
          { label: "Total", value: stats.total, color: "text-gray-900", bg: "bg-gray-100" },
          { label: "En Diseño", value: stats.enDiseno, color: "text-blue-700", bg: "bg-blue-50" },
          { label: "En Compra", value: stats.enCompra, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "En Ejecución", value: stats.enEjecucion, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Terminados", value: stats.terminados, color: "text-gray-500", bg: "bg-gray-50" },
          { label: "Inversión", value: stats.totalBudget > 0 ? fmt(stats.totalBudget) : "—", color: "text-indigo-700", bg: "bg-indigo-50", isText: true },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-lg px-3 py-2`}>
            <div className={`text-lg font-bold ${s.color}`}>
              {'isText' in s ? s.value : s.value}
            </div>
            <div className="text-[10px] text-gray-500 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">
          No hay proyectos que coincidan con el filtro.
        </div>
      ) : (
        <div className="overflow-x-auto" ref={scrollRef}>
          <table className="border-collapse" style={{ minWidth: allCols.reduce((s, c) => s + c.width, 0) + ROW_NUM_WIDTH }}>
            {/* Phase headers */}
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-20 bg-gray-800 text-white text-[9px] font-bold text-center border-r border-gray-600"
                  style={{ width: ROW_NUM_WIDTH, height: PHASE_HEADER_HEIGHT }}
                  rowSpan={2}
                >
                  #
                </th>
                {PHASES.map((ph) => (
                  <th
                    key={ph.id}
                    colSpan={ph.columns.length}
                    className={`${ph.color} ${ph.textColor} text-[11px] font-bold text-center border-r border-white/30 tracking-wide`}
                    style={{ height: PHASE_HEADER_HEIGHT }}
                  >
                    {ph.label.toUpperCase()}
                  </th>
                ))}
              </tr>
              {/* Column headers */}
              <tr>
                {PHASES.map((ph) =>
                  ph.columns.map((col) => (
                    <th
                      key={col.key}
                      className={`bg-gray-100 text-[10px] font-semibold text-gray-600 text-left px-2 border-r border-gray-200 border-b-2 ${ph.borderColor} whitespace-nowrap`}
                      style={{ width: col.width, height: HEADER_HEIGHT }}
                    >
                      {col.label}
                    </th>
                  ))
                )}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {filtered.map((p, idx) => {
                const isDone = p.status === "terminada";
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-gray-100 cursor-pointer hover:bg-orange-50/40 transition-colors ${
                      isDone ? "bg-gray-50/50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                    }`}
                    onClick={() => onProjectClick(p)}
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Row number */}
                    <td className="sticky left-0 z-10 bg-inherit text-center text-[10px] text-gray-400 font-mono border-r border-gray-200">
                      {idx + 1}
                    </td>
                    {PHASES.map((ph) =>
                      ph.columns.map((col) => {
                        const ts = getFieldTs(p, col.trackedField);
                        return (
                          <td
                            key={`${p.id}-${col.key}`}
                            className={`px-2 text-[11px] text-gray-700 border-r border-gray-100 ${
                              isDone ? "text-gray-400" : ""
                            }`}
                            style={{ maxWidth: col.width }}
                          >
                            <div className="truncate leading-tight">{col.render(p)}</div>
                            {ts && (
                              <div className="text-[8px] text-gray-400 leading-none mt-0.5" title={`Registrado: ${new Date(ts).toLocaleString("es-CL")}`}>
                                {fmtShortDate(ts)}
                              </div>
                            )}
                          </td>
                        );
                      })
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50/50 flex items-center gap-4 text-[10px] text-gray-500">
        <span className="font-semibold uppercase">Fases:</span>
        {PHASES.map((ph) => (
          <span key={ph.id} className="flex items-center gap-1.5">
            <span className={`w-3 h-2 rounded-sm ${ph.color}`} />
            <span>{ph.label} ({ph.columns.length} campos)</span>
          </span>
        ))}
        <span className="ml-auto text-gray-400">Los datos se actualizan automáticamente desde las tarjetas del Kanban</span>
      </div>
    </div>
  );
}
