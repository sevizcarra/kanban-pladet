"use client";
import { STATUSES, PRIORITIES, PROFESSIONALS, getProgress } from "@/lib/constants";
import type { Project } from "@/types/project";
import Badge from "./Badge";
import ProgressBar from "./ProgressBar";
import { User } from "lucide-react";

interface Props {
  projects: Project[];
  onProjectClick: (p: Project) => void;
}

export default function KanbanBoard({ projects, onProjectClick }: Props) {
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
                return (
                  <div key={p.id} onClick={() => onProjectClick(p)}
                    className="bg-white rounded-xl p-3.5 cursor-pointer border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 hover:-translate-y-0.5 transition-all duration-200 group"
                  >
                    {/* Top color accent bar */}
                    <div className="h-1 rounded-full mb-3 -mx-1" style={{ background: `linear-gradient(to right, ${s.color}, ${s.color}80)` }} />

                    <p className="text-xs font-bold text-gray-900 mb-2 leading-snug group-hover:text-[#00A499] transition-colors">{p.title}</p>

                    <div className="flex justify-between items-center mb-1">
                      <Badge color={prio.color} bg={prio.bg}>{prio.label}</Badge>
                      <span className="text-[10px] text-gray-500 font-medium bg-gray-50 px-1.5 py-0.5 rounded">{p.requestingUnit}</span>
                    </div>

                    {p.jefeProyectoId !== undefined && p.jefeProyectoId >= 0 && PROFESSIONALS[p.jefeProyectoId] && (
                      <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-gray-100">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 text-white"
                          style={{ backgroundColor: s.color }}
                        >
                          {getInitials(PROFESSIONALS[p.jefeProyectoId].name)}
                        </div>
                        <span className="text-[10px] text-gray-600 truncate">{PROFESSIONALS[p.jefeProyectoId].name}</span>
                      </div>
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
