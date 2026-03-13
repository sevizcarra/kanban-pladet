"use client";

import React, { useMemo, useRef, useState, useCallback } from "react";
import { Project } from "@/types/project";
import {
  PROFESSIONALS,
  INSPECTORS,
  STATUSES,
  OBRAS_STATUSES,
  PRIORITIES,
  REQUESTING_UNITS,
  getStatusObj,
  getProgress,
  fmtDate,
  fmt,
} from "@/lib/constants";
import { updateProject } from "@/lib/firestore";
import { Filter, Search, X, Snowflake } from "lucide-react";

interface IndicadorViewProps {
  projects: Project[];
  onProjectClick: (p: Project) => void;
  onUpdateProject?: (p: Project) => void;
}

// Column definition for each phase
interface ColDef {
  key: string;
  label: string;
  width: number;
  trackedField?: string;
  editable?: "date" | "text" | "select";
  editField?: string; // field name on Project to edit
  selectOptions?: { value: string; label: string }[];
  render: (p: Project) => React.ReactNode;
}

// Phase grouping
interface PhaseGroup {
  id: string;
  label: string;
  color: string;
  textColor: string;
  borderColor: string;
  columns: ColDef[];
}

const shortName = (fullName: string) => {
  const parts = fullName.split(" ");
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return fullName;
};

const getJefeNombre = (id?: number) => {
  if (id === undefined || id <= 0 || !PROFESSIONALS[id]) return "—";
  return shortName(PROFESSIONALS[id].name);
};

const getInspectorNombre = (id?: number) => {
  if (id === undefined || id <= 0 || !INSPECTORS[id]) return "—";
  return shortName(INSPECTORS[id]);
};

// Helper: get field timestamp as formatted date
const fmtFieldTs = (p: Project, field: string): string => {
  if (!p.fieldTimestamps || !p.fieldTimestamps[field]) return "—";
  const d = new Date(p.fieldTimestamps[field]);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const fmtDateShort = (d: string | null | undefined): string => {
  if (!d) return "—";
  const date = new Date(d);
  const dd = date.getDate().toString().padStart(2, "0");
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const UNIDAD_OPTIONS = [
  { value: "", label: "—" },
  { value: "UOM", label: "UOM" },
  { value: "UPT", label: "UPT" },
  { value: "UGO", label: "UGO" },
];

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
      { key: "frozen", label: "❄️", width: 30, render: (p) => p.frozen ? (
        <span title="Congelado" className="text-blue-500 font-bold"><Snowflake className="w-3.5 h-3.5" /></span>
      ) : null },
      { key: "year", label: "Año", width: 50, render: (p) => p.createdAt ? new Date(p.createdAt).getFullYear() : "—" },
      { key: "memo", label: "Memorándum", width: 120, trackedField: "memorandumNumber", render: (p) => {
        if (p.memos && p.memos.length > 0) return p.memos.map(m => m.key).join(", ");
        return p.memorandumNumber || "—";
      }},
      { key: "fechaIngreso", label: "Fecha Ingreso", width: 95, editable: "date", editField: "fechaRecepcionMemo", render: (p) => fmtDateShort(p.fechaRecepcionMemo || p.createdAt) },
      { key: "unit", label: "Unidad Req.", width: 90, trackedField: "requestingUnit", render: (p) => p.requestingUnit || "—" },
      { key: "unidadAsig", label: "Unidad Asig.", width: 65, editable: "select", editField: "unidadAsignada", selectOptions: UNIDAD_OPTIONS, render: (p) => p.unidadAsignada || "—" },
      { key: "fechaAsigUnidad", label: "F. Asig. Unidad", width: 95, editable: "date", editField: "fechaAsignacionUnidad", render: (p) => fmtDateShort(p.fechaAsignacionUnidad) },
      { key: "disciplina", label: "Disc. Líder", width: 90, trackedField: "disciplinaLider", render: (p) => p.disciplinaLider || "—" },
      { key: "tipo", label: "Tipo", width: 70, trackedField: "tipoLicitacion", render: (p) => p.tipoLicitacion || "—" },
      { key: "recinto", label: "Recinto", width: 100, trackedField: "recinto", render: (p) => p.recinto || "—" },
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
      { key: "jefe", label: "Jefe Proyecto", width: 110, trackedField: "jefeProyectoId", render: (p) => getJefeNombre(p.jefeProyectoId) },
      { key: "jefeAsignacion", label: "F. Asig. Prof.", width: 90, render: (p) => fmtFieldTs(p, "jefeProyectoId") },
      { key: "visitaTerreno", label: "Visita Terreno", width: 90, editable: "date", editField: "fechaVisitaTerreno", trackedField: "fechaVisitaTerreno", render: (p) => fmtDateShort(p.fechaVisitaTerreno) },
      { key: "fechaInicioDis", label: "Inicio Diseño", width: 90, editable: "date", editField: "fechaInicioDis", trackedField: "fechaInicioDis", render: (p) => fmtDateShort(p.fechaInicioDis) },
      { key: "avance", label: "Avance", width: 60, render: (p) => {
        const pct = getProgress(p.status, p.subEtapas, p.tipoDesarrollo, p.dashboardType);
        const color = pct >= 80 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-gray-500";
        return <span className={`font-bold ${color}`}>{pct}%</span>;
      }},
      { key: "dueDate", label: "F. Entrega", width: 90, editable: "date", editField: "dueDate", trackedField: "dueDate", render: (p) => fmtDateShort(p.dueDate) },
    ],
  },
  {
    id: "compra",
    label: "Compra",
    color: "bg-amber-600",
    textColor: "text-white",
    borderColor: "border-amber-400",
    columns: [
      { key: "budget", label: "Presupuesto", width: 95, trackedField: "budget", render: (p) => p.budget && Number(p.budget) > 0 ? fmt(Number(p.budget)) : "—" },
      { key: "envioDOCL", label: "Envío DOCL", width: 90, editable: "date", editField: "fechaLicitacion", trackedField: "fechaLicitacion", render: (p) => fmtDateShort(p.fechaLicitacion) },
      { key: "tipoLic", label: "Licitación", width: 75, trackedField: "tipoLicitacion", render: (p) => p.tipoLicitacion || "—" },
      { key: "idLic", label: "ID Licit.", width: 85, trackedField: "idLicitacion", render: (p) => p.idLicitacion || "—" },
      { key: "envioTramitados", label: "Envío Tramit.", width: 90, editable: "date", editField: "fechaEnvioTramitados", trackedField: "fechaEnvioTramitados", render: (p) => fmtDateShort(p.fechaEnvioTramitados) },
    ],
  },
  {
    id: "ejecucion",
    label: "Ejecución",
    color: "bg-emerald-600",
    textColor: "text-white",
    borderColor: "border-emerald-400",
    columns: [
      { key: "memoITO", label: "Memo ITO", width: 90, editable: "date", editField: "fechaDerivacionMemoITO", trackedField: "fechaDerivacionMemoITO", render: (p) => fmtDateShort(p.fechaDerivacionMemoITO) },
      { key: "inspector", label: "ITO", width: 110, trackedField: "inspectorId", render: (p) => getInspectorNombre(p.inspectorId) },
      { key: "itoAsignacion", label: "F. Asig. ITO", width: 90, render: (p) => fmtFieldTs(p, "inspectorId") },
      { key: "fechaInicio", label: "Inicio Obra", width: 90, editable: "date", editField: "fechaInicioObra", trackedField: "fechaInicioObra", render: (p) => fmtDateShort(p.fechaInicioObra) },
      { key: "plazo", label: "Plazo", width: 60, trackedField: "plazoEjecucion", render: (p) => p.plazoEjecucion ? `${p.plazoEjecucion}d` : "—" },
      { key: "fechaTerminoEst", label: "Término Est.", width: 90, trackedField: "fechaEstimadaTermino", render: (p) => fmtDateShort(p.fechaEstimadaTermino) },
      { key: "fechaTerminoReal", label: "Término Real", width: 90, editable: "date", editField: "fechaRealTerminoObra", trackedField: "fechaRealTerminoObra", render: (p) => fmtDateShort(p.fechaRealTerminoObra) },
      { key: "recProv", label: "Rec. Prov.", width: 90, editable: "date", editField: "fechaRecProviso", trackedField: "fechaRecProviso", render: (p) => fmtDateShort(p.fechaRecProviso) },
      { key: "recDef", label: "Rec. Def.", width: 90, editable: "date", editField: "fechaRecDefinitiva", trackedField: "fechaRecDefinitiva", render: (p) => fmtDateShort(p.fechaRecDefinitiva) },
      { key: "recDefProg", label: "Rec. Def. Prog.", width: 90, editable: "date", editField: "fechaProgramadaRecDef", trackedField: "fechaProgramadaRecDef", render: (p) => fmtDateShort(p.fechaProgramadaRecDef) },
    ],
  },
];

// Build unique status list from both dashboards
const ALL_STATUSES = [...STATUSES, ...OBRAS_STATUSES.filter(os => !STATUSES.find(s => s.id === os.id))];

export default function IndicadorView({ projects, onProjectClick, onUpdateProject }: IndicadorViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [filterDashboard, setFilterDashboard] = useState<"all" | "compras" | "obras">("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ projectId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleInlineEdit = useCallback((p: Project, field: string, currentValue: string) => {
    setEditingCell({ projectId: p.id, field });
    setEditValue(currentValue || "");
  }, []);

  const handleInlineSave = useCallback(async (p: Project) => {
    if (!editingCell) return;
    const field = editingCell.field;
    const newVal = editValue;
    setEditingCell(null);
    // Only save if value actually changed
    const oldVal = ((p as unknown) as Record<string, unknown>)[field] as string || "";
    if (newVal === oldVal) return;
    try {
      const partial: Partial<Project> = { [field]: newVal };
      await updateProject(p.id, partial as Partial<Project>);
      if (onUpdateProject) {
        onUpdateProject({ ...p, [field]: newVal });
      }
    } catch (e) {
      console.error("Error updating field inline:", e);
    }
  }, [editingCell, editValue, onUpdateProject]);

  const handleInlineCancel = useCallback(() => {
    setEditingCell(null);
    setEditValue("");
  }, []);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (filterDashboard === "compras" && p.dashboardType === "obras") return false;
      if (filterDashboard === "obras" && p.dashboardType !== "obras") return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (filterUnit !== "all" && p.requestingUnit !== filterUnit) return false;
      if (filterPriority !== "all" && p.priority !== filterPriority) return false;
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
  }, [projects, search, filterDashboard, filterStatus, filterUnit, filterPriority]);

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
    const congelados = filtered.filter((p) => p.frozen).length;
    const withBudget = filtered.filter((p) => p.budget && Number(p.budget) > 0);
    const totalBudget = withBudget.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    return { total, terminados, enDiseno, enCompra, enEjecucion, congelados, totalBudget };
  }, [filtered]);

  const allCols = PHASES.flatMap((ph) => ph.columns);
  const ROW_HEIGHT = 44;
  const HEADER_HEIGHT = 26;
  const PHASE_HEADER_HEIGHT = 26;

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

  const ROW_NUM_WIDTH = 30;

  const hasActiveFilters = filterStatus !== "all" || filterUnit !== "all" || filterPriority !== "all";

  const clearFilters = () => {
    setFilterStatus("all");
    setFilterUnit("all");
    setFilterPriority("all");
    setSearch("");
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50/50">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
            Indicador de Proyectos 2026
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Consolidado automático — Haz doble clic en celdas de fecha para editar
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Dashboard type */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
            {(["all", "compras", "obras"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFilterDashboard(opt)}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  filterDashboard === opt
                    ? "bg-[#F97316] text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {opt === "all" ? "Todos" : opt === "compras" ? "Compras" : "Obras"}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-gray-400">{filtered.length} proyectos</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-1.5 border-b border-gray-100 bg-gray-50/30">
        <Filter size={12} className="text-gray-400 flex-shrink-0" />

        {/* Status */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-2 py-1 text-[11px] border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#F97316]"
        >
          <option value="all">Todos los Estados</option>
          {ALL_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

        {/* Unit */}
        <select
          value={filterUnit}
          onChange={(e) => setFilterUnit(e.target.value)}
          className="px-2 py-1 text-[11px] border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#F97316]"
        >
          <option value="all">Todas las Unidades</option>
          {REQUESTING_UNITS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        {/* Priority */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-2 py-1 text-[11px] border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#F97316]"
        >
          <option value="all">Todas las Prioridades</option>
          {Object.entries(PRIORITIES).map(([id, p]) => (
            <option key={id} value={id}>{p.label}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative ml-auto">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="pl-7 pr-3 py-1 text-[11px] border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-[#F97316] focus:border-[#F97316] outline-none w-40"
          />
        </div>

        {/* Clear */}
        {hasActiveFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1 text-[10px] text-red-600 hover:bg-red-50 rounded-md transition-colors">
            <X size={11} /> Limpiar
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-7 gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50/30">
        {[
          { label: "Total", value: stats.total, color: "text-gray-900", bg: "bg-gray-100" },
          { label: "En Diseño", value: stats.enDiseno, color: "text-blue-700", bg: "bg-blue-50" },
          { label: "En Compra", value: stats.enCompra, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "En Ejecución", value: stats.enEjecucion, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Terminados", value: stats.terminados, color: "text-gray-500", bg: "bg-gray-50" },
          { label: "Congelados", value: stats.congelados, color: "text-blue-500", bg: "bg-blue-50" },
          { label: "Inversión", value: stats.totalBudget > 0 ? fmt(stats.totalBudget) : "—", color: "text-indigo-700", bg: "bg-indigo-50" },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-lg px-2.5 py-1.5`}>
            <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-gray-500 font-medium">{s.label}</div>
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
                    className={`${ph.color} ${ph.textColor} text-[10px] font-bold text-center border-r border-white/30 tracking-wide`}
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
                      className={`bg-gray-100 text-[9px] font-semibold text-gray-600 text-left px-1.5 border-r border-gray-200 border-b-2 ${ph.borderColor} whitespace-nowrap`}
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
                const isFrozen = !!p.frozen;
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                      isFrozen ? "bg-blue-50/60" :
                      isDone ? "bg-gray-50/50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                    } hover:bg-orange-50/40`}
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Row number */}
                    <td className="sticky left-0 z-10 bg-inherit text-center text-[10px] text-gray-400 font-mono border-r border-gray-200">
                      {idx + 1}
                    </td>
                    {PHASES.map((ph) =>
                      ph.columns.map((col) => {
                        const ts = getFieldTs(p, col.trackedField);
                        const isEditing = editingCell?.projectId === p.id && editingCell?.field === col.editField;
                        return (
                          <td
                            key={`${p.id}-${col.key}`}
                            className={`px-1.5 text-[10px] text-gray-700 border-r border-gray-100 ${
                              isDone ? "text-gray-400" : ""
                            } ${col.editable ? "cursor-cell" : ""}`}
                            style={{ maxWidth: col.width }}
                            onDoubleClick={() => {
                              if (col.editable && col.editField) {
                                const currentVal = ((p as unknown) as Record<string, unknown>)[col.editField] as string || "";
                                handleInlineEdit(p, col.editField, currentVal);
                              }
                            }}
                            onClick={() => {
                              if (!col.editable) onProjectClick(p);
                            }}
                          >
                            {isEditing && col.editable === "date" ? (
                              <input
                                type="date"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleInlineSave(p)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleInlineSave(p);
                                  if (e.key === "Escape") handleInlineCancel();
                                }}
                                className="w-full text-[10px] border border-[#F97316] rounded px-1 py-0.5 outline-none bg-orange-50"
                                autoFocus
                              />
                            ) : isEditing && col.editable === "select" ? (
                              <select
                                value={editValue}
                                onChange={(e) => { setEditValue(e.target.value); }}
                                onBlur={() => handleInlineSave(p)}
                                className="w-full text-[10px] border border-[#F97316] rounded px-1 py-0.5 outline-none bg-orange-50"
                                autoFocus
                              >
                                {col.selectOptions?.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            ) : (
                              <>
                                <div className="truncate leading-tight">{col.render(p)}</div>
                                {ts && (
                                  <div className="text-[8px] text-gray-400 leading-none mt-0.5" title={`Registrado: ${new Date(ts).toLocaleString("es-CL")}`}>
                                    {fmtShortDate(ts)}
                                  </div>
                                )}
                              </>
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
      <div className="px-4 py-1.5 border-t border-gray-200 bg-gray-50/50 flex items-center gap-4 text-[9px] text-gray-500">
        <span className="font-semibold uppercase">Fases:</span>
        {PHASES.map((ph) => (
          <span key={ph.id} className="flex items-center gap-1">
            <span className={`w-3 h-2 rounded-sm ${ph.color}`} />
            <span>{ph.label} ({ph.columns.length})</span>
          </span>
        ))}
        <span className="ml-auto text-gray-400">Doble clic en fechas para editar inline • Los datos se sincronizan automáticamente</span>
      </div>
    </div>
  );
}
