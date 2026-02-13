"use client";

import { useState, useMemo } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MessageCircle,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import {
  STATUSES,
  PRIORITIES,
  PROFESSIONALS,
  getStatusObj,
  getProgress,
  fmtDate,
  daysLeft,
  getAntecedentesIncompletos,
} from "@/lib/constants";
import Badge from "./Badge";
import ProgressBar from "./ProgressBar";
import type { Project } from "@/types/project";

type SortKey =
  | "title"
  | "status"
  | "priority"
  | "requestingUnit"
  | "jefeProyecto"
  | "progress"
  | "dueDate";
type SortDir = "asc" | "desc";

interface Props {
  projects: Project[];
  onProjectClick: (p: Project) => void;
}

const STATUS_ORDER = Object.fromEntries(
  STATUSES.map((s, i) => [s.id, i])
);
const PRIORITY_ORDER: Record<string, number> = {
  alta: 0,
  media: 1,
  baja: 2,
};

export default function TableView({ projects, onProjectClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    const arr = [...projects];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "status":
          cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
          break;
        case "priority":
          cmp =
            (PRIORITY_ORDER[a.priority] ?? 99) -
            (PRIORITY_ORDER[b.priority] ?? 99);
          break;
        case "requestingUnit":
          cmp = (a.requestingUnit || "").localeCompare(b.requestingUnit || "");
          break;
        case "jefeProyecto": {
          const nameA =
            a.jefeProyectoId !== undefined &&
            a.jefeProyectoId >= 0 &&
            PROFESSIONALS[a.jefeProyectoId]
              ? PROFESSIONALS[a.jefeProyectoId].name
              : "";
          const nameB =
            b.jefeProyectoId !== undefined &&
            b.jefeProyectoId >= 0 &&
            PROFESSIONALS[b.jefeProyectoId]
              ? PROFESSIONALS[b.jefeProyectoId].name
              : "";
          cmp = nameA.localeCompare(nameB);
          break;
        }
        case "progress":
          cmp =
            getProgress(a.status, a.subEtapas, a.tipoDesarrollo) -
            getProgress(b.status, b.subEtapas, b.tipoDesarrollo);
          break;
        case "dueDate": {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          cmp = da - db;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [projects, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col)
      return <ChevronsUpDown className="w-3 h-3 text-gray-400" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 text-[#F97316]" />
    ) : (
      <ChevronDown className="w-3 h-3 text-[#F97316]" />
    );
  };

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: "title", label: "Proyecto", className: "min-w-[200px]" },
    { key: "status", label: "Estado", className: "min-w-[160px]" },
    { key: "priority", label: "Prioridad" },
    { key: "requestingUnit", label: "Unidad" },
    { key: "jefeProyecto", label: "Jefe de Proyecto", className: "min-w-[180px]" },
    { key: "progress", label: "Avance" },
    { key: "dueDate", label: "Fecha Entrega" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition select-none ${col.className || ""}`}
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    <SortIcon col={col.key} />
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((p) => {
              const statusObj = getStatusObj(p.status, p.tipoDesarrollo);
              const prio = PRIORITIES[p.priority];
              const progress = getProgress(
                p.status,
                p.subEtapas,
                p.tipoDesarrollo
              );
              const jefe =
                p.jefeProyectoId !== undefined &&
                p.jefeProyectoId >= 0 &&
                PROFESSIONALS[p.jefeProyectoId]
                  ? PROFESSIONALS[p.jefeProyectoId]
                  : null;
              const dl = p.status !== "terminada" ? daysLeft(p.dueDate) : null;
              const isOverdue = dl !== null && dl < 0;
              const isDueSoon = dl !== null && dl >= 0 && dl <= 7;
              const antecedentes = getAntecedentesIncompletos(p);

              return (
                <tr
                  key={p.id}
                  onClick={() => onProjectClick(p)}
                  className={`cursor-pointer transition-colors group ${
                    isOverdue ? "bg-red-50/60 hover:bg-red-50" : isDueSoon ? "bg-amber-50/40 hover:bg-amber-50" : "hover:bg-orange-50/40"
                  }`}
                >
                  {/* Proyecto */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                      {isDueSoon && !isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900 group-hover:text-[#F97316] transition-colors leading-snug">
                            {p.title}
                          </p>
                          {antecedentes.incompleto && (
                            <div className="relative group/dot">
                              <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-[8px] font-bold">{antecedentes.faltantes.length}</span>
                              </div>
                              <div className="absolute left-0 top-5 hidden group-hover/dot:block z-50 w-48 bg-gray-900 text-white text-[10px] rounded-lg p-2 shadow-lg">
                                <p className="font-semibold mb-1">Antecedentes incompletos:</p>
                                {antecedentes.faltantes.map(f => <p key={f} className="text-gray-300">• {f}</p>)}
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {p.codigoProyectoUsa || p.memorandumNumber}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3">
                    <Badge color={statusObj.color} bg={statusObj.color + "18"}>
                      {statusObj.label}
                    </Badge>
                  </td>

                  {/* Prioridad */}
                  <td className="px-4 py-3">
                    <Badge color={prio.color} bg={prio.bg}>
                      {prio.label}
                    </Badge>
                  </td>

                  {/* Unidad */}
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-700 font-medium bg-gray-100 px-2 py-1 rounded">
                      {p.requestingUnit}
                    </span>
                  </td>

                  {/* Jefe de Proyecto */}
                  <td className="px-4 py-3">
                    {jefe ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: statusObj.color }}
                        >
                          {jefe.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <span className="text-xs text-gray-700 truncate">
                          {jefe.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  {/* Avance */}
                  <td className="px-4 py-3 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <ProgressBar
                          value={progress}
                          color={statusObj.color}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-gray-600 w-8 text-right">
                        {progress}%
                      </span>
                    </div>
                  </td>

                  {/* Fecha Entrega */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs ${isOverdue ? "text-red-600 font-semibold" : isDueSoon ? "text-amber-600 font-semibold" : "text-gray-600"}`}>
                        {fmtDate(p.dueDate)}
                      </span>
                      {isOverdue && (
                        <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
                          {Math.abs(dl || 0)}d
                        </span>
                      )}
                      {isDueSoon && !isOverdue && (
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                          {dl === 0 ? "Hoy" : `${dl}d`}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Comment indicator */}
                  <td className="px-4 py-3">
                    {(p.commentCount || 0) > 0 && (
                      <div className="flex items-center gap-0.5 text-gray-400">
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium">
                          {p.commentCount}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">No hay proyectos que coincidan con los filtros</p>
          </div>
        )}
      </div>

      {/* Footer count */}
      <div className="bg-gray-50/80 border-t border-gray-200 px-4 py-2.5">
        <p className="text-[11px] text-gray-500">
          {sorted.length} proyecto{sorted.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
