"use client";
import { STATUSES, PRIORITIES, getProgress } from "@/lib/constants";
import type { Project } from "@/types/project";
import Badge from "./Badge";
import ProgressBar from "./ProgressBar";

interface Props {
  projects: Project[];
  onProjectClick: (p: Project) => void;
}

export default function KanbanBoard({ projects, onProjectClick }: Props) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
      {STATUSES.map((s) => {
        const cols = projects.filter((p) => p.status === s.id);
        return (
          <div key={s.id} className="min-w-[240px] max-w-[280px] flex-shrink-0">
            <div className="flex items-center gap-2 mb-3 py-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-sm font-semibold text-gray-700">{s.short}</span>
              <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2">{cols.length}</span>
            </div>
            <div className="flex flex-col gap-2 min-h-[100px] p-1 bg-gray-50 rounded-xl">
              {cols.map((p) => {
                const prio = PRIORITIES[p.priority];
                return (
                  <div key={p.id} onClick={() => onProjectClick(p)}
                    className="bg-white rounded-lg p-3 cursor-pointer border-l-[3px] shadow-sm hover:scale-[1.02] transition-transform"
                    style={{ borderLeftColor: s.color }}>
                    <p className="text-xs font-semibold text-gray-900 mb-1">{p.title}</p>
                    <div className="flex justify-between items-center">
                      <Badge color={prio.color} bg={prio.bg}>{prio.label}</Badge>
                      <span className="text-[10px] text-gray-400">{p.requestingUnit}</span>
                    </div>
                  </div>
                );
              })}
              {cols.length === 0 && <p className="text-xs text-gray-300 text-center py-5">Sin proyectos</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
