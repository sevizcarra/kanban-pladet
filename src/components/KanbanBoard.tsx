"use client";
import { STATUSES, PRIORITIES, PROFESSIONALS, getProgress, daysLeft, getAntecedentesIncompletos } from "@/lib/constants";
import type { Project } from "@/types/project";
import Badge from "./Badge";
import ProgressBar from "./ProgressBar";
import { User, MessageCircle, AlertTriangle, AlertCircle, Siren } from "lucide-react";

interface Props {
  projects: Project[];
  onProjectClick: (p: Project) => void;
  onToggleFlag?: (p: Project) => void;
}

export default function KanbanBoard({ projects, onProjectClick, onToggleFlag }: Props) {
  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
      {STATUSES.map((s) => {
        const cols = projects.filter((p) => p.status === s.id);
        return (
          <div key={s.id} className="min-w-[240px] max-w-[280px] flex-shrink-0">
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3 py-2 px-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 0 2px white, 0 0 0 3.5px ${s.color}40` }} />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{s.label}</span>
              <span
                className="text-[10px] font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center"
                style={{ backgroundColor: s.color + '15', color: s.color }}
              >
                {cols.length}
              </span>
            </div>

            {/* Column body */}
            <div className="flex flex-col gap-2.5 min-h-[100px] p-2 bg-white/40 backdrop-blur-sm rounded-xl border border-gray-200/50">
              {cols.map((p) => {
                const prio = PRIORITIES[p.priority];
                const dl = p.status !== "terminada" ? daysLeft(p.dueDate) : null;
                const isOverdue = dl !== null && dl < 0;
                const isDueSoon = dl !== null && dl >= 0 && dl <= 7;
                const antecedentes = getAntecedentesIncompletos(p);
                const isFlagged = !!p.flagged;
                return (
                  <div key={p.id}
                    className={`rounded-xl cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group relative ${
                      isFlagged
                        ? "bg-red-50 border-2 border-red-400 ring-1 ring-red-300/50"
                        : isOverdue
                          ? "bg-white border-2 border-red-300"
                          : isDueSoon
                            ? "bg-white border-2 border-amber-300"
                            : "bg-white border border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    {/* Flagged pulse animation */}
                    {isFlagged && (
                      <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                      </div>
                    )}

                    {/* Punto rojo: Antecedentes incompletos */}
                    {antecedentes.incompleto && (
                      <div className="absolute -top-1.5 -right-1.5 group/dot z-10">
                        <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                          <span className="text-white text-[8px] font-bold">{antecedentes.faltantes.length}</span>
                        </div>
                        <div className="absolute right-0 top-5 hidden group-hover/dot:block z-50 w-48 bg-gray-900 text-white text-[10px] rounded-lg p-2 shadow-lg">
                          <p className="font-semibold mb-1">Antecedentes incompletos:</p>
                          {antecedentes.faltantes.map(f => <p key={f} className="text-gray-300">• {f}</p>)}
                        </div>
                      </div>
                    )}

                    <div className="p-3.5" onClick={() => onProjectClick(p)}>
                      {/* Top color accent bar */}
                      <div className="h-1 rounded-full mb-3 -mx-1" style={{ background: `linear-gradient(to right, ${isFlagged ? '#ef4444' : isOverdue ? '#ef4444' : s.color}, ${isFlagged ? '#ef444480' : isOverdue ? '#ef444480' : s.color + '80'})` }} />

                      <div className="flex items-start justify-between gap-1 mb-2">
                        <p className={`text-xs font-bold leading-snug transition-colors flex-1 ${isFlagged ? 'text-red-800' : 'text-gray-900 group-hover:text-[#F97316]'}`}>{p.title}</p>
                        {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                        {isDueSoon && !isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                      </div>

                      <div className="flex justify-between items-center mb-1">
                        <Badge color={prio.color} bg={prio.bg}>{prio.label}</Badge>
                        <span className="text-[10px] text-gray-500 font-medium bg-gray-50 px-1.5 py-0.5 rounded">{p.requestingUnit}</span>
                      </div>

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100">
                        {p.jefeProyectoId !== undefined && p.jefeProyectoId >= 0 && PROFESSIONALS[p.jefeProyectoId] ? (
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 text-white"
                              style={{ backgroundColor: s.color }}
                            >
                              {getInitials(PROFESSIONALS[p.jefeProyectoId].name)}
                            </div>
                            <span className="text-[10px] text-gray-600 truncate">{PROFESSIONALS[p.jefeProyectoId].name}</span>
                          </div>
                        ) : <div />}
                        {(p.commentCount || 0) > 0 && (
                          <div className="flex items-center gap-0.5 text-gray-400 flex-shrink-0">
                            <MessageCircle className="w-3 h-3" />
                            <span className="text-[10px] font-medium">{p.commentCount}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Flag toggle button */}
                    {onToggleFlag && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFlag(p);
                        }}
                        title={isFlagged ? "Quitar alerta" : "Marcar con alerta"}
                        className={`absolute bottom-2 right-2 p-1.5 rounded-lg transition-all duration-200 z-10 ${
                          isFlagged
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-transparent text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-red-500'
                        }`}
                      >
                        <Siren className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              {cols.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                    <span className="text-xs">0</span>
                  </div>
                  <p className="text-xs">Sin proyectos</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
