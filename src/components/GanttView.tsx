"use client";

import React, { useMemo, useRef, useState } from "react";
import { Project } from "@/types/project";
import {
  STATUSES,
  PROFESSIONALS,
  PRIORITIES,
  getStatusObj,
  daysLeft,
  fmtDate,
  fmt,
  getProgress,
} from "@/lib/constants";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

interface GanttViewProps {
  projects: Project[];
  onProjectClick: (p: Project) => void;
}

type ZoomLevel = "months" | "weeks";

export default function GanttView({ projects, onProjectClick }: GanttViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("months");
  const [tooltip, setTooltip] = useState<{
    project: Project;
    x: number;
    y: number;
  } | null>(null);

  // Only show projects with at least a due date or created date
  const ganttProjects = useMemo(() => {
    return projects
      .filter((p) => p.dueDate || p.createdAt)
      .sort((a, b) => {
        // Sort by status order, then by due date
        const sA = STATUSES.findIndex((s) => s.id === a.status);
        const sB = STATUSES.findIndex((s) => s.id === b.status);
        if (sA !== sB) return sA - sB;
        const dA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const dB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return dA - dB;
      });
  }, [projects]);

  // Calculate timeline range
  const { startDate, endDate, months, totalDays } = useMemo(() => {
    const now = new Date();
    let minDate = new Date(now);
    let maxDate = new Date(now);

    ganttProjects.forEach((p) => {
      const start = p.createdAt
        ? new Date(p.createdAt)
        : p.dueDate
        ? new Date(new Date(p.dueDate).getTime() - 90 * 86400000)
        : now;
      const end = p.dueDate ? new Date(p.dueDate) : now;

      if (start < minDate) minDate = new Date(start);
      if (end > maxDate) maxDate = new Date(end);
    });

    // Add 1-month padding on each side
    minDate.setDate(1);
    minDate.setMonth(minDate.getMonth() - 1);
    maxDate.setMonth(maxDate.getMonth() + 2);
    maxDate.setDate(0);

    // Generate months
    const monthList: { label: string; year: number; month: number; days: number; startDay: number }[] = [];
    const cursor = new Date(minDate);
    let dayOffset = 0;

    while (cursor <= maxDate) {
      const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      monthList.push({
        label: cursor.toLocaleString("es-CL", { month: "short" }),
        year: cursor.getFullYear(),
        month: cursor.getMonth(),
        days: daysInMonth,
        startDay: dayOffset,
      });
      dayOffset += daysInMonth;
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const total = dayOffset;

    return { startDate: minDate, endDate: maxDate, months: monthList, totalDays: total };
  }, [ganttProjects]);

  const dayWidth = zoom === "months" ? 3 : 10;
  const chartWidth = totalDays * dayWidth;
  const ROW_HEIGHT = 36;
  const HEADER_HEIGHT = 52;
  const LABEL_WIDTH = 280;

  const dayFromDate = (d: Date) => {
    return Math.round((d.getTime() - startDate.getTime()) / 86400000);
  };

  const todayOffset = dayFromDate(new Date());

  const scrollToToday = () => {
    if (scrollRef.current) {
      const scrollTo = todayOffset * dayWidth - scrollRef.current.clientWidth / 2;
      scrollRef.current.scrollLeft = Math.max(0, scrollTo);
    }
  };

  // Auto-scroll to today on mount
  React.useEffect(() => {
    const timer = setTimeout(scrollToToday, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/50">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
          Carta Gantt — Plazos de Proyectos
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={scrollToToday}
            className="px-3 py-1.5 text-xs font-medium bg-[#00A499] text-white rounded-md hover:bg-[#008F85] transition-colors"
          >
            Hoy
          </button>
          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setZoom("months")}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                zoom === "months"
                  ? "bg-[#00A499] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={() => setZoom("weeks")}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                zoom === "weeks"
                  ? "bg-[#00A499] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <ZoomIn size={14} />
            </button>
          </div>
          <span className="text-[10px] text-gray-400">
            {ganttProjects.length} proyectos
          </span>
        </div>
      </div>

      {ganttProjects.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          No hay proyectos con fechas para mostrar en la carta Gantt.
        </div>
      ) : (
        <div className="flex">
          {/* Project Labels (fixed left) */}
          <div
            className="flex-shrink-0 border-r border-gray-200 bg-white z-10"
            style={{ width: LABEL_WIDTH }}
          >
            {/* Header */}
            <div
              className="px-3 flex items-end border-b border-gray-200 bg-gray-50/80 text-[10px] font-semibold text-gray-500 uppercase"
              style={{ height: HEADER_HEIGHT }}
            >
              <span className="pb-2">Proyecto</span>
            </div>
            {/* Rows */}
            {ganttProjects.map((p) => {
              const statusObj = getStatusObj(p.status, p.tipoDesarrollo);
              const dl = daysLeft(p.dueDate);
              const isOverdue = p.status !== "terminada" && dl !== null && dl < 0;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 px-3 border-b border-gray-100 cursor-pointer hover:bg-teal-50/40 transition-colors ${
                    isOverdue ? "bg-red-50/30" : ""
                  }`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onProjectClick(p)}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: statusObj.color }}
                  />
                  <span className="text-xs text-gray-800 truncate flex-1 font-medium">
                    {p.title}
                  </span>
                  {isOverdue && (
                    <span className="text-[9px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {Math.abs(dl!)}d
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Scrollable chart area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-x-auto overflow-y-hidden"
          >
            <div style={{ width: chartWidth, position: "relative" }}>
              {/* Month Headers */}
              <div
                className="flex border-b border-gray-200 bg-gray-50/80"
                style={{ height: HEADER_HEIGHT }}
              >
                {months.map((m, i) => {
                  const isCurrentMonth =
                    m.month === new Date().getMonth() &&
                    m.year === new Date().getFullYear();
                  return (
                    <div
                      key={`${m.year}-${m.month}`}
                      className={`border-r border-gray-200 flex flex-col justify-end px-1.5 pb-1.5 ${
                        isCurrentMonth ? "bg-teal-50/50" : ""
                      }`}
                      style={{ width: m.days * dayWidth, minWidth: 0 }}
                    >
                      <span
                        className={`text-[10px] font-bold uppercase ${
                          isCurrentMonth ? "text-[#00A499]" : "text-gray-500"
                        }`}
                      >
                        {m.label}
                      </span>
                      <span className="text-[9px] text-gray-400">
                        {m.year}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Grid Rows + Bars */}
              {ganttProjects.map((p) => {
                const statusObj = getStatusObj(p.status, p.tipoDesarrollo);
                const progress = getProgress(
                  p.status,
                  p.subEtapas,
                  p.tipoDesarrollo
                );
                const dl = daysLeft(p.dueDate);
                const isOverdue =
                  p.status !== "terminada" && dl !== null && dl < 0;
                const isDone = p.status === "terminada";

                // Bar start: createdAt or 90 days before due
                const barStart = p.createdAt
                  ? new Date(p.createdAt)
                  : p.dueDate
                  ? new Date(
                      new Date(p.dueDate).getTime() - 90 * 86400000
                    )
                  : new Date();

                // Bar end: dueDate or today + 30
                const barEnd = p.dueDate
                  ? new Date(p.dueDate)
                  : new Date(Date.now() + 30 * 86400000);

                const startDay = Math.max(0, dayFromDate(barStart));
                const endDay = Math.min(totalDays, dayFromDate(barEnd));
                const barWidth = Math.max(
                  dayWidth * 2,
                  (endDay - startDay) * dayWidth
                );
                const barLeft = startDay * dayWidth;

                return (
                  <div
                    key={p.id}
                    className="border-b border-gray-100 relative"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Month grid lines */}
                    {months.map((m) => (
                      <div
                        key={`grid-${p.id}-${m.year}-${m.month}`}
                        className="absolute top-0 bottom-0 border-r border-gray-100"
                        style={{
                          left: m.startDay * dayWidth,
                          width: m.days * dayWidth,
                        }}
                      />
                    ))}

                    {/* Bar */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 rounded-md cursor-pointer group"
                      style={{
                        left: barLeft,
                        width: barWidth,
                        height: 20,
                        backgroundColor: isOverdue
                          ? "#fecaca"
                          : isDone
                          ? "#e2e8f0"
                          : `${statusObj.color}22`,
                        border: `1.5px solid ${
                          isOverdue ? "#ef4444" : isDone ? "#94a3b8" : statusObj.color
                        }`,
                      }}
                      onClick={() => onProjectClick(p)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          project: p,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 8,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {/* Progress fill */}
                      <div
                        className="absolute top-0 left-0 bottom-0 rounded-l-[4px]"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: isOverdue
                            ? "#ef4444"
                            : isDone
                            ? "#94a3b8"
                            : statusObj.color,
                          opacity: 0.5,
                          borderRadius:
                            progress >= 100 ? "4px" : "4px 0 0 4px",
                        }}
                      />
                      {/* Label on bar */}
                      {barWidth > 60 && (
                        <span
                          className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold truncate"
                          style={{
                            color: isOverdue
                              ? "#991b1b"
                              : isDone
                              ? "#475569"
                              : statusObj.color,
                          }}
                        >
                          {progress}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Today line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                style={{ left: todayOffset * dayWidth }}
              >
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-b-md whitespace-nowrap">
                  Hoy
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-white border border-gray-200 shadow-xl rounded-lg p-3 pointer-events-none"
          style={{
            left: Math.min(tooltip.x, window.innerWidth - 280),
            top: tooltip.y - 110,
            width: 260,
          }}
        >
          <p className="text-sm font-bold text-gray-900 truncate mb-1">
            {tooltip.project.title}
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <span className="text-gray-500">Estado:</span>
            <span className="font-medium text-gray-800">
              {getStatusObj(tooltip.project.status, tooltip.project.tipoDesarrollo).label}
            </span>
            <span className="text-gray-500">Avance:</span>
            <span className="font-medium text-gray-800">
              {getProgress(tooltip.project.status, tooltip.project.subEtapas, tooltip.project.tipoDesarrollo)}%
            </span>
            <span className="text-gray-500">Vencimiento:</span>
            <span className="font-medium text-gray-800">
              {fmtDate(tooltip.project.dueDate)}
            </span>
            {tooltip.project.jefeProyectoId !== undefined &&
              tooltip.project.jefeProyectoId >= 0 &&
              PROFESSIONALS[tooltip.project.jefeProyectoId] && (
                <>
                  <span className="text-gray-500">Jefe Proy.:</span>
                  <span className="font-medium text-gray-800 truncate">
                    {PROFESSIONALS[tooltip.project.jefeProyectoId].name
                      .split(" ")
                      .slice(0, 2)
                      .join(" ")}
                  </span>
                </>
              )}
            {tooltip.project.budget && (
              <>
                <span className="text-gray-500">Presupuesto:</span>
                <span className="font-medium text-gray-800">
                  {fmt(Number(tooltip.project.budget) || 0)}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50/50 flex flex-wrap items-center gap-4 text-[10px]">
        <span className="font-semibold text-gray-500 uppercase">Leyenda:</span>
        {STATUSES.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm border"
              style={{
                backgroundColor: `${s.color}33`,
                borderColor: s.color,
              }}
            />
            <span className="text-gray-600">{s.label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-200 border border-red-500" />
          <span className="text-red-600 font-semibold">Atrasado</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-0.5 h-3 bg-red-500" />
          <span className="text-red-600 font-semibold">Hoy</span>
        </span>
      </div>
    </div>
  );
}
