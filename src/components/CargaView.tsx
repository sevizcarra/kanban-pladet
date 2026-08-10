"use client";

import { useMemo, useState } from "react";
import { Project } from "@/types/project";
import { STATUSES, PROFESSIONALS, PRIORITIES } from "@/lib/constants";
import {
  Inbox,
  Snowflake,
  AlertTriangle,
} from "lucide-react";

/* ============================================================
   Helpers de fechas (semanas de lunes a viernes)
   ============================================================ */

const WEEKS_SHOWN = 4;
const DAYS_PER_WEEK = 5; // días hábiles
const TOTAL_DAYS = WEEKS_SHOWN * DAYS_PER_WEEK;
const DEFAULT_SPAN_DAYS = 13; // 2 semanas corridas cuando no hay fecha de término

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

function parseISO(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
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

const DAY_LETTERS = ["L", "M", "X", "J", "V"];

/* ============================================================
   Datos derivados
   ============================================================ */

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

function shortName(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length <= 2) return name;
  // Primer nombre + primer apellido (asumiendo formato Nombre [Nombre2] Apellido1 Apellido2)
  return `${parts[0]} ${parts[parts.length - 2]}`;
}

/** Rango de trabajo de un proyecto: [inicio, fin] + si el fin es estimado */
function projectSpan(p: Project): {
  start: Date;
  end: Date;
  estimated: boolean;
} {
  const startIso =
    p.fechaInicioDis ||
    p.fechaAsignacionUnidad ||
    p.semanaProgramada ||
    p.fechaRecepcionMemo ||
    (p.createdAt ? p.createdAt.slice(0, 10) : toISO(new Date()));
  const endIso = p.dueDate || p.fechaEstimadaTermino || null;
  const start = parseISO(startIso);
  if (endIso) {
    const end = parseISO(endIso);
    return { start, end: end >= start ? end : start, estimated: false };
  }
  return { start, end: addDays(start, DEFAULT_SPAN_DAYS), estimated: true };
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
    () =>
      Array.from({ length: WEEKS_SHOWN }, (_, i) =>
        toISO(addDays(monday0, i * 7))
      ),
    [monday0]
  );

  // Días hábiles visibles (L-V de cada semana)
  const days = useMemo(() => {
    const list: Date[] = [];
    for (let w = 0; w < WEEKS_SHOWN; w++) {
      for (let d = 0; d < DAYS_PER_WEEK; d++) {
        list.push(addDays(monday0, w * 7 + d));
      }
    }
    return list;
  }, [monday0]);

  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const todayIso = toISO(new Date());
  const todayIdx = days.findIndex((d) => toISO(d) === todayIso);

  /** Índice de columna (0..TOTAL_DAYS-1) para una fecha, redondeando a día hábil */
  const colOf = (date: Date, roundUp: boolean): number => {
    if (date <= firstDay) return 0;
    if (date >= lastDay) return TOTAL_DAYS - 1;
    for (let i = 0; i < days.length; i++) {
      const iso = toISO(days[i]);
      const dIso = toISO(date);
      if (iso === dIso) return i;
      if (toISO(days[i]) > dIso) return roundUp ? i : Math.max(0, i - 1);
    }
    return TOTAL_DAYS - 1;
  };

  /** Barra visible de un proyecto, o null si cae completamente fuera de rango */
  const barOf = (p: Project) => {
    const { start, end, estimated } = projectSpan(p);
    if (end < firstDay) {
      // Vencido antes del rango: barra mínima al inicio, marcada
      return { startCol: 0, endCol: 0, estimated, overdue: true, span: { start, end } };
    }
    if (start > lastDay) return null; // parte después del rango visible
    const startCol = colOf(start, true);
    const endCol = colOf(end, false);
    return {
      startCol,
      endCol: Math.max(endCol, startCol),
      estimated,
      overdue: toISO(end) < todayIso,
      span: { start, end },
    };
  };

  /* ---------- filas por profesional ---------- */
  const rows = useMemo(() => {
    const map = new Map<string, Project[]>();
    PROFESSIONALS.forEach((prof) => map.set(prof.name, []));
    active.forEach((p) => {
      const name = professionalName(p);
      if (!name) return;
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(p);
    });
    return Array.from(map.entries())
      .map(([name, projs]) => {
        // Carga por semana: proyectos cuyo rango pisa esa semana
        const weekLoad = weeks.map((w) => {
          const wStart = parseISO(w);
          const wEnd = addDays(wStart, 4);
          return projs.filter((p) => {
            if (p.frozen) return false;
            const { start, end } = projectSpan(p);
            return start <= wEnd && end >= wStart;
          }).length;
        });
        const activos = projs.filter((p) => !p.frozen).length;
        return { name, projs, weekLoad, activos };
      })
      .sort((a, b) => b.activos - a.activos || a.name.localeCompare(b.name));
  }, [active, weeks]);

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

  // Sin asignar pero con semana programada → fila "Por asignar" del gantt
  const unassignedProgrammed = useMemo(
    () => unassigned.filter((p) => p.semanaProgramada),
    [unassigned]
  );

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
        ...(unit ? { fechaAsignacionUnidad: toISO(new Date()) } : {}),
      });
    } finally {
      setSaving(null);
    }
  };

  const totalActivos = active.filter((p) => !p.frozen).length;
  const totalCongelados = active.filter((p) => p.frozen).length;

  /* ============================================================
     Render helpers
     ============================================================ */

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

  const loadChip = (n: number, key: string) => {
    const cls =
      n === 0
        ? "text-gray-400 bg-gray-100"
        : n <= 2
        ? "text-green-700 bg-green-50"
        : n <= 4
        ? "text-amber-700 bg-amber-50"
        : "text-red-700 bg-red-50";
    return (
      <span
        key={key}
        className={`inline-flex items-center justify-center w-7 text-[10px] font-bold px-1 py-0.5 rounded ${cls}`}
      >
        {n}
      </span>
    );
  };

  /** Capa de fondo: celdas de días con bordes de semana y columna de hoy */
  const gridBackground = (
    <div
      className="absolute inset-0 grid"
      style={{ gridTemplateColumns: `repeat(${TOTAL_DAYS}, minmax(0, 1fr))` }}
    >
      {days.map((d, i) => (
        <div
          key={i}
          className={`h-full ${
            i % DAYS_PER_WEEK === 0 ? "border-l border-gray-200" : "border-l border-gray-100"
          } ${i === todayIdx ? "bg-orange-50" : ""}`}
        />
      ))}
    </div>
  );

  /** Barras de proyectos de una fila, apiladas */
  const rowBars = (projs: Project[], violet = false) => (
    <div
      className="relative grid gap-y-[3px] py-1.5"
      style={{
        gridTemplateColumns: `repeat(${TOTAL_DAYS}, minmax(0, 1fr))`,
        gridAutoRows: "18px",
        minHeight: "30px",
      }}
    >
      {projs.map((p) => {
        const bar = barOf(p);
        if (!bar) return null;
        const st = STATUSES.find((s) => s.id === p.status);
        const baseColor = violet ? "#8b5cf6" : st?.color || "#6B7280";
        const label =
          bar.endCol - bar.startCol >= 2
            ? `${p.memorandumNumber ? p.memorandumNumber.replace("MEM-", "") + " · " : ""}${p.title}`
            : "";
        const tip = `${p.title}${p.memorandumNumber ? ` (${p.memorandumNumber})` : ""}\n${
          st?.label || ""
        } · ${fmtShort(toISO(bar.span.start))} → ${fmtShort(toISO(bar.span.end))}${
          bar.estimated ? " (término estimado)" : ""
        }${bar.overdue ? " · VENCIDO" : ""}${p.frozen ? " · CONGELADO" : ""}`;
        return (
          <button
            key={p.id}
            onClick={() => onProjectClick(p)}
            title={tip}
            className={`h-[18px] rounded-[4px] px-1.5 text-left text-[9px] font-semibold text-white truncate leading-[18px] transition-all hover:brightness-110 hover:shadow ${
              bar.overdue ? "ring-2 ring-red-400" : ""
            } ${p.frozen ? "opacity-50" : ""}`}
            style={{
              gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`,
              backgroundColor: p.frozen ? "#0ea5e9" : baseColor,
              backgroundImage: bar.estimated
                ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.28) 0 4px, transparent 4px 8px)"
                : undefined,
            }}
          >
            {p.flagged ? "⚠ " : ""}
            {label}
          </button>
        );
      })}
    </div>
  );

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

  /* ============================================================ */

  return (
    <div className="p-5 space-y-6">
      {/* KPIs */}
      <div className="flex flex-wrap gap-3">
        {kpi("Proyectos activos", totalActivos)}
        {kpi("Sin asignar", unassigned.length, "#F97316")}
        {kpi("Congelados", totalCongelados, "#0ea5e9")}
      </div>

      {/* ==================== AGENDA POR PROFESIONAL ==================== */}
      <section className="bg-white rounded-xl border border-gray-200/80 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-gray-800">
            Agenda por profesional — próximas {WEEKS_SHOWN} semanas
          </h2>
          <span className="text-xs text-gray-400">
            días hábiles · barra achurada = término estimado (sin fecha de
            entrega en la ficha) · borde rojo = vencido
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            {/* Encabezado: semanas y días */}
            <div className="grid" style={{ gridTemplateColumns: "230px 1fr" }}>
              <div className="border-b border-gray-200" />
              <div>
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `repeat(${WEEKS_SHOWN}, minmax(0, 1fr))`,
                  }}
                >
                  {weeks.map((w, i) => (
                    <div
                      key={w}
                      className="text-center text-[11px] font-bold text-gray-700 py-1.5 border-l border-gray-200 bg-gray-50"
                    >
                      Semana del {fmtShort(w)}
                      {i === 0 && (
                        <span className="ml-1.5 text-[9px] font-semibold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full">
                          actual
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div
                  className="grid border-b border-gray-200"
                  style={{
                    gridTemplateColumns: `repeat(${TOTAL_DAYS}, minmax(0, 1fr))`,
                  }}
                >
                  {days.map((d, i) => (
                    <div
                      key={i}
                      className={`text-center text-[9px] py-0.5 ${
                        i % DAYS_PER_WEEK === 0
                          ? "border-l border-gray-200"
                          : "border-l border-gray-100"
                      } ${
                        i === todayIdx
                          ? "bg-orange-100 text-orange-700 font-bold"
                          : "text-gray-400"
                      }`}
                    >
                      {DAY_LETTERS[i % DAYS_PER_WEEK]}
                      <span className="block text-[10px] font-semibold text-gray-600">
                        {String(d.getDate()).padStart(2, "0")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Fila: por asignar (programados sin profesional) */}
            {unassignedProgrammed.length > 0 && (
              <div
                className="grid border-b border-gray-100 bg-violet-50/40"
                style={{ gridTemplateColumns: "230px 1fr" }}
              >
                <div className="px-4 py-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    ?
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-violet-700 truncate">
                      Por asignar (programados)
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {unassignedProgrammed.length} en cola
                    </p>
                  </div>
                </div>
                <div className="relative">
                  {gridBackground}
                  {rowBars(unassignedProgrammed, true)}
                </div>
              </div>
            )}

            {/* Filas por profesional */}
            {rows.map((row) => (
              <div
                key={row.name}
                className="grid border-b border-gray-100 hover:bg-orange-50/30 transition-colors"
                style={{ gridTemplateColumns: "230px 1fr" }}
              >
                <div className="px-4 py-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {getInitials(row.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs font-medium text-gray-800 truncate"
                      title={row.name}
                    >
                      {shortName(row.name)}
                    </p>
                    <div className="flex gap-1 mt-0.5">
                      {row.weekLoad.map((n, i) =>
                        loadChip(n, `${row.name}-w${i}`)
                      )}
                    </div>
                  </div>
                </div>
                <div className="relative">
                  {gridBackground}
                  {row.projs.length > 0 ? (
                    rowBars(row.projs)
                  ) : (
                    <div className="relative flex items-center h-full min-h-[30px] px-3">
                      <span className="text-[10px] text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">
                        libre — puede absorber
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Leyenda */}
            <div className="px-4 py-2.5 flex flex-wrap items-center gap-3 bg-gray-50/60">
              <span className="text-[10px] text-gray-500 font-semibold">
                Carga semanal:
              </span>
              {loadChip(0, "l0")}
              <span className="text-[10px] text-gray-400">libre</span>
              {loadChip(2, "l2")}
              <span className="text-[10px] text-gray-400">holgado</span>
              {loadChip(4, "l4")}
              <span className="text-[10px] text-gray-400">al límite</span>
              {loadChip(6, "l6")}
              <span className="text-[10px] text-gray-400">sobrecargado</span>
              <span className="mx-2 text-gray-200">|</span>
              {STATUSES.filter((s) => s.id !== "terminada").map((s) => (
                <span key={s.id} className="flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-sm inline-block"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-[10px] text-gray-500">{s.short}</span>
                </span>
              ))}
            </div>
          </div>
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
                      {p.frozen && (
                        <Snowflake
                          size={12}
                          className="text-sky-500 flex-shrink-0"
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
    </div>
  );
}
