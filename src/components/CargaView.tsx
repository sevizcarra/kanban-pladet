"use client";

import { Fragment, useMemo, useState } from "react";
import { Project } from "@/types/project";
import { STATUSES, PROFESSIONALS, PRIORITIES } from "@/lib/constants";
import {
  ChevronDown,
  ChevronRight,
  Inbox,
  CalendarClock,
  Snowflake,
  AlertTriangle,
} from "lucide-react";

/* ============================================================
   Helpers de semanas (lunes como inicio de semana)
   ============================================================ */

function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/* ============================================================
   Datos derivados
   ============================================================ */

// Estados activos (todos menos "terminada")
const ACTIVE_STATUSES = STATUSES.filter((s) => s.id !== "terminada");

function professionalName(p: Project): string | null {
  if (
    p.jefeProyectoId !== undefined &&
    p.jefeProyectoId >= 0 &&
    PROFESSIONALS[p.jefeProyectoId]
  ) {
    return PROFESSIONALS[p.jefeProyectoId].name;
  }
  if (p.profesionalAsignado && p.profesionalAsignado.trim() !== "") {
    return p.profesionalAsignado.trim();
  }
  return null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const ASSIGNED_UNITS = [
  { value: "UOM", label: "UOM — Obras Menores" },
  { value: "UPT", label: "UPT — Planificación Territorial" },
  { value: "UGO", label: "UGO — Grandes Obras" },
];

interface CargaViewProps {
  projects: Project[];
  onProjectClick: (project: Project) => void;
  onSetWeek: (projectId: string, week: string | null) => Promise<void>;
  onAssign: (projectId: string, data: Partial<Project>) => Promise<void>;
}

export default function CargaView({
  projects,
  onProjectClick,
  onSetWeek,
  onAssign,
}: CargaViewProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Solo flujo de proyectos/requerimientos (excluye dashboard de obras/cuadrilla)
  const active = useMemo(
    () =>
      projects.filter(
        (p) => p.dashboardType !== "obras" && p.status !== "terminada"
      ),
    [projects]
  );

  const monday0 = useMemo(() => getMonday(new Date()), []);
  const weeks = useMemo(
    () => [0, 1, 2, 3].map((i) => toISO(addDays(monday0, i * 7))),
    [monday0]
  );

  /* ---------- carga por profesional ---------- */
  const rows = useMemo(() => {
    const map = new Map<string, Project[]>();
    // Semilla: todos los profesionales del equipo (aunque tengan 0 proyectos)
    PROFESSIONALS.forEach((prof) => map.set(prof.name, []));
    active.forEach((p) => {
      const name = professionalName(p);
      if (!name) return;
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(p);
    });
    return Array.from(map.entries())
      .map(([name, projs]) => {
        const byStatus: Record<string, number> = {};
        ACTIVE_STATUSES.forEach((s) => (byStatus[s.id] = 0));
        let frozen = 0;
        projs.forEach((p) => {
          if (p.frozen) frozen += 1;
          else if (byStatus[p.status] !== undefined) byStatus[p.status] += 1;
        });
        const activos = projs.length - frozen;
        return { name, projs, byStatus, frozen, activos };
      })
      .sort((a, b) => b.activos - a.activos || a.name.localeCompare(b.name));
  }, [active]);

  const maxActivos = useMemo(
    () => Math.max(...rows.map((r) => r.activos), 1),
    [rows]
  );

  /* ---------- bandeja sin asignar ---------- */
  const unassigned = useMemo(
    () =>
      active
        .filter((p) => !professionalName(p))
        .sort((a, b) => {
          const prio = { alta: 0, media: 1, baja: 2 } as Record<string, number>;
          return (
            (prio[a.priority] ?? 3) - (prio[b.priority] ?? 3) ||
            (a.createdAt || "").localeCompare(b.createdAt || "")
          );
        }),
    [active]
  );

  /* ---------- programación semanal ---------- */
  const programmed = useMemo(() => {
    const byWeek: Record<string, Project[]> = {};
    weeks.forEach((w) => (byWeek[w] = []));
    const overdue: Project[] = [];
    active.forEach((p) => {
      if (!p.semanaProgramada) return;
      if (byWeek[p.semanaProgramada]) byWeek[p.semanaProgramada].push(p);
      else if (p.semanaProgramada < weeks[0]) overdue.push(p);
    });
    return { byWeek, overdue };
  }, [active, weeks]);

  const handleWeekChange = async (projectId: string, value: string) => {
    setSaving(projectId);
    try {
      await onSetWeek(projectId, value === "" ? null : value);
    } finally {
      setSaving(null);
    }
  };

  const handleAssignProfessional = async (projectId: string, idx: string) => {
    if (idx === "") return;
    setSaving(projectId);
    try {
      await onAssign(projectId, { jefeProyectoId: Number(idx) });
    } finally {
      setSaving(null);
    }
  };

  const handleAssignUnit = async (projectId: string, unit: string) => {
    setSaving(projectId);
    try {
      await onAssign(projectId, {
        unidadAsignada: unit,
        ...(unit
          ? { fechaAsignacionUnidad: toISO(new Date()) }
          : {}),
      });
    } finally {
      setSaving(null);
    }
  };

  const totalActivos = active.filter((p) => !p.frozen).length;
  const totalCongelados = active.filter((p) => p.frozen).length;
  const programadosSemana = programmed.byWeek[weeks[0]]?.length || 0;

  /* ============================================================ */

  const kpi = (label: string, value: number, accent?: string) => (
    <div
      key={label}
      className="bg-white rounded-xl border border-gray-200/80 px-5 py-3.5 flex-1 min-w-[150px]"
    >
      <p className="text-[11px] uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="text-2xl font-bold" style={{ color: accent || "#111827" }}>
        {value}
      </p>
    </div>
  );

  const projectChip = (p: Project, showProf = true) => {
    const st = STATUSES.find((s) => s.id === p.status);
    const name = professionalName(p);
    return (
      <button
        key={p.id}
        onClick={() => onProjectClick(p)}
        className="w-full text-left bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-orange-400 hover:shadow-sm transition-all"
      >
        <div className="flex items-center gap-2">
          {p.flagged && (
            <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
          )}
          {p.frozen && (
            <Snowflake size={12} className="text-sky-500 flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-gray-800 truncate flex-1">
            {p.title}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {st && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ color: st.color, backgroundColor: `${st.color}18` }}
            >
              {st.short}
            </span>
          )}
          {p.memorandumNumber && (
            <span className="text-[10px] text-gray-400">
              Memo {p.memorandumNumber}
            </span>
          )}
          {showProf && name && (
            <span
              className="ml-auto w-4 h-4 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[8px] font-bold"
              title={name}
            >
              {getInitials(name)}
            </span>
          )}
        </div>
      </button>
    );
  };

  const weekSelect = (p: Project) => (
    <select
      value={p.semanaProgramada || ""}
      disabled={saving === p.id}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => handleWeekChange(p.id, e.target.value)}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-orange-400 disabled:opacity-50"
    >
      <option value="">Sin programar</option>
      {weeks.map((w) => (
        <option key={w} value={w}>
          Semana del {fmtShort(w)}
        </option>
      ))}
    </select>
  );

  return (
    <div className="p-5 space-y-6">
      {/* KPIs */}
      <div className="flex flex-wrap gap-3">
        {kpi("Proyectos activos", totalActivos)}
        {kpi("Sin asignar", unassigned.length, "#F97316")}
        {kpi(
          `Programados sem. del ${fmtShort(weeks[0])}`,
          programadosSemana,
          "#8b5cf6"
        )}
        {kpi("Congelados", totalCongelados, "#0ea5e9")}
      </div>

      {/* ==================== CARGA POR PROFESIONAL ==================== */}
      <section className="bg-white rounded-xl border border-gray-200/80 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-gray-800">
            Carga por profesional
          </h2>
          <span className="text-xs text-gray-400">
            proyectos y requerimientos activos · excluye obras de cuadrilla
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left font-medium px-5 py-2 text-xs min-w-[220px]">
                  Profesional
                </th>
                {ACTIVE_STATUSES.map((s) => (
                  <th
                    key={s.id}
                    className="font-medium px-2 py-2 text-xs text-center"
                    title={s.label}
                  >
                    <span style={{ color: s.color }}>{s.short}</span>
                  </th>
                ))}
                <th
                  className="font-medium px-2 py-2 text-xs text-center text-sky-500"
                  title="Congelados"
                >
                  <Snowflake size={13} className="inline" />
                </th>
                <th className="font-semibold px-4 py-2 text-xs text-center">
                  Activos
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isOpen = expanded === row.name;
                return (
                  <Fragment key={row.name}>
                    <tr
                      className="border-t border-gray-100 hover:bg-orange-50/40 cursor-pointer transition-colors"
                      onClick={() => setExpanded(isOpen ? null : row.name)}
                    >
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <ChevronDown size={14} className="text-gray-400" />
                          ) : (
                            <ChevronRight size={14} className="text-gray-400" />
                          )}
                          <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                            {getInitials(row.name)}
                          </span>
                          <span className="text-xs font-medium text-gray-800">
                            {row.name}
                          </span>
                        </div>
                        {/* barra de carga relativa */}
                        <div className="ml-12 mt-1 h-1 rounded-full bg-gray-100 max-w-[180px]">
                          <div
                            className="h-1 rounded-full bg-orange-400"
                            style={{
                              width: `${(row.activos / maxActivos) * 100}%`,
                            }}
                          />
                        </div>
                      </td>
                      {ACTIVE_STATUSES.map((s) => (
                        <td key={s.id} className="px-2 py-2.5 text-center">
                          {row.byStatus[s.id] > 0 ? (
                            <span
                              className="inline-block min-w-[22px] text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{
                                color: s.color,
                                backgroundColor: `${s.color}18`,
                              }}
                            >
                              {row.byStatus[s.id]}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-[11px]">·</span>
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2.5 text-center">
                        {row.frozen > 0 ? (
                          <span className="inline-block min-w-[22px] text-[11px] font-bold px-1.5 py-0.5 rounded-full text-sky-600 bg-sky-50">
                            {row.frozen}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-[11px]">·</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-sm font-bold text-gray-800">
                          {row.activos}
                        </span>
                      </td>
                    </tr>
                    {isOpen && row.projs.length > 0 && (
                      <tr className="bg-gray-50/60">
                        <td
                          colSpan={ACTIVE_STATUSES.length + 3}
                          className="px-5 py-3"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 ml-8">
                            {row.projs.map((p) => projectChip(p, false))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ==================== BANDEJA SIN ASIGNAR ==================== */}
      <section className="bg-white rounded-xl border border-gray-200/80 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <Inbox size={16} className="text-orange-500" />
          <h2 className="text-sm font-bold text-gray-800">
            Bandeja — sin profesional asignado
          </h2>
          <span className="text-xs text-gray-400">
            asigna unidad y profesional, o programa la semana de asignación
          </span>
          <span className="ml-auto text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
            {unassigned.length}
          </span>
        </div>
        {unassigned.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">
            Nada pendiente de asignación. Bandeja limpia.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {unassigned.map((p) => {
              const prioInfo = PRIORITIES[p.priority];
              const st = STATUSES.find((s) => s.id === p.status);
              return (
                <div
                  key={p.id}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-orange-50/40 transition-colors"
                >
                  <button
                    onClick={() => onProjectClick(p)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      {p.flagged && (
                        <AlertTriangle
                          size={12}
                          className="text-red-500 flex-shrink-0"
                        />
                      )}
                      <span className="text-xs font-medium text-gray-800 truncate">
                        {p.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {st && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{
                            color: st.color,
                            backgroundColor: `${st.color}18`,
                          }}
                        >
                          {st.short}
                        </span>
                      )}
                      {prioInfo && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{
                            color: prioInfo.color,
                            backgroundColor: prioInfo.bg,
                          }}
                        >
                          {prioInfo.label}
                        </span>
                      )}
                      {p.memorandumNumber && (
                        <span className="text-[10px] text-gray-400">
                          Memo {p.memorandumNumber}
                        </span>
                      )}
                      {p.requestingUnit && (
                        <span className="text-[10px] text-gray-400">
                          · {p.requestingUnit}
                        </span>
                      )}
                      {p.unidadAsignada && (
                        <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                          {p.unidadAsignada}
                        </span>
                      )}
                    </div>
                  </button>
                  {/* Triaje inline: unidad → profesional → semana */}
                  <select
                    value={p.unidadAsignada || ""}
                    disabled={saving === p.id}
                    onChange={(e) => handleAssignUnit(p.id, e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-violet-400 disabled:opacity-50 max-w-[90px]"
                    title="Unidad asignada"
                  >
                    <option value="">Unidad…</option>
                    {ASSIGNED_UNITS.map((u) => (
                      <option key={u.value} value={u.value} title={u.label}>
                        {u.value}
                      </option>
                    ))}
                  </select>
                  <select
                    value=""
                    disabled={saving === p.id}
                    onChange={(e) =>
                      handleAssignProfessional(p.id, e.target.value)
                    }
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-orange-400 disabled:opacity-50 max-w-[150px]"
                    title="Asignar profesional"
                  >
                    <option value="">Asignar a…</option>
                    {PROFESSIONALS.map((prof, idx) => (
                      <option key={prof.name} value={idx}>
                        {prof.name}
                      </option>
                    ))}
                  </select>
                  {weekSelect(p)}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ==================== PROGRAMACIÓN SEMANAL ==================== */}
      <section className="bg-white rounded-xl border border-gray-200/80 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <CalendarClock size={16} className="text-violet-500" />
          <h2 className="text-sm font-bold text-gray-800">
            Programación — próximas 4 semanas
          </h2>
          <span className="text-xs text-gray-400">
            proyectos con semana comprometida
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          {weeks.map((w, i) => (
            <div key={w} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-700">
                  Semana del {fmtShort(w)}
                  {i === 0 && (
                    <span className="ml-1.5 text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">
                      actual
                    </span>
                  )}
                </p>
                <span className="text-xs font-bold text-gray-400">
                  {programmed.byWeek[w].length}
                </span>
              </div>
              <div className="space-y-2">
                {programmed.byWeek[w].length === 0 ? (
                  <p className="text-[11px] text-gray-300">—</p>
                ) : (
                  programmed.byWeek[w].map((p) => (
                    <div key={p.id} className="space-y-1">
                      {projectChip(p)}
                      <div className="flex justify-end">{weekSelect(p)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
        {programmed.overdue.length > 0 && (
          <div className="border-t border-red-100 bg-red-50/50 p-4">
            <p className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1.5">
              <AlertTriangle size={13} />
              Programados en semanas ya pasadas ({programmed.overdue.length}) —
              reprograma o asigna
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {programmed.overdue.map((p) => (
                <div key={p.id} className="space-y-1">
                  {projectChip(p)}
                  <div className="flex justify-end">{weekSelect(p)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
