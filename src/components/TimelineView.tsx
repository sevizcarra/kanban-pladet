"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import Badge from "./Badge";
import ProgressBar from "./ProgressBar";
import { STATUSES, PRIORITIES, PROFESSIONALS, fmtDate, daysLeft, fmt, getProgress } from "@/lib/constants";
import { Project } from "@/types/project";

interface TimelineViewProps {
  projects: Project[];
  onProjectClick: (p: Project) => void;
}

export default function TimelineView({ projects, onProjectClick }: TimelineViewProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(STATUSES.map((s) => [s.id, true]))
  );

  const toggleStatus = (statusId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [statusId]: !prev[statusId],
    }));
  };

  const getProjectsByStatus = (statusId: string) => {
    return projects.filter((p) => p.status === statusId);
  };

  const getDaysLeftColor = (days: number | null) => {
    if (days === null) return "text-gray-500";
    if (days < 0) return "text-red-600 font-semibold";
    if (days < 30) return "text-yellow-600 font-semibold";
    return "text-green-600 font-semibold";
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Timeline Sections */}
      {STATUSES.map((status) => {
        const statusProjects = getProjectsByStatus(status.id);
        const isExpanded = expanded[status.id];

        return (
          <div key={status.id} className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200">
            {/* Status Header */}
            <div
              className="flex items-center gap-3 px-4 py-3 border-l-4 cursor-pointer hover:bg-gray-50 transition-colors"
              style={{ borderLeftColor: status.color }}
              onClick={() => toggleStatus(status.id)}
            >
              {/* Colored Dot */}
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />

              {/* Stage Label */}
              <span className="font-medium text-gray-800 flex-1">{status.label}</span>

              {/* Project Count Badge */}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: status.color }}>
                {statusProjects.length}
              </span>

              {/* Expand/Collapse Chevron */}
              <button className="p-1 hover:bg-gray-200 rounded transition-colors" onClick={() => toggleStatus(status.id)}>
                {isExpanded ? (
                  <ChevronUp size={20} className="text-gray-600" />
                ) : (
                  <ChevronDown size={20} className="text-gray-600" />
                )}
              </button>
            </div>

            {/* Project Cards */}
            {isExpanded && (
              <div className="px-4 py-3 bg-gray-50 space-y-3 border-t border-gray-200">
                {statusProjects.length > 0 ? (
                  statusProjects.map((project) => {
                    const priorityConfig = PRIORITIES[project.priority];
                    const progress = getProgress(project.status, project.subEtapas);
                    const daysLeftValue = daysLeft(project.dueDate);

                    return (
                      <div
                        key={project.id}
                        className="bg-white rounded-lg p-4 border-l-4 cursor-pointer hover:shadow-md transition-shadow"
                        style={{ borderLeftColor: status.color }}
                        onClick={() => onProjectClick(project)}
                      >
                        {/* Title and Priority */}
                        <div className="flex items-start gap-2 mb-2">
                          <span className="font-bold text-gray-900 flex-1">{project.title}</span>
                          <Badge color={priorityConfig.color} bg={priorityConfig.bg}>
                            {priorityConfig.label}
                          </Badge>
                        </div>

                        {/* Memorandum Number, Requesting Unit, and Assigned Professional */}
                        <div className="flex items-center gap-2 mb-3 text-sm text-gray-600 flex-wrap">
                          <span>Memo: {project.memorandumNumber}</span>
                          <span className="text-gray-500">•</span>
                          <span>{project.requestingUnit}</span>
                          {project.jefeProyectoId !== undefined && project.jefeProyectoId >= 0 && PROFESSIONALS[project.jefeProyectoId] && (
                            <>
                              <span className="text-gray-500">•</span>
                              <span className="inline-flex items-center gap-1 text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full text-xs font-medium">
                                <span className="w-4 h-4 rounded-full bg-teal-200 text-teal-800 flex items-center justify-center text-[9px] font-bold">
                                  {PROFESSIONALS[project.jefeProyectoId].name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                                </span>
                                {PROFESSIONALS[project.jefeProyectoId].name}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-500">Progreso</span>
                            <span className="text-xs font-semibold text-gray-600">{progress}%</span>
                          </div>
                          <ProgressBar value={progress} color={status.color} />
                        </div>

                        {/* Due Date and Days Left */}
                        <div className="flex items-center justify-between mb-2 text-sm">
                          <div className="text-gray-600">
                            Vencimiento: <span className="font-medium">{fmtDate(project.dueDate)}</span>
                          </div>
                          {daysLeftValue !== null && (
                            <span className={`font-medium ${getDaysLeftColor(daysLeftValue)}`}>
                              {daysLeftValue < 0 ? `${Math.abs(daysLeftValue)}d vencido` : `${daysLeftValue}d restantes`}
                            </span>
                          )}
                        </div>

                        {/* Budget */}
                        {project.budget && (
                          <div className="text-sm text-gray-600">
                            Presupuesto: <span className="font-medium text-gray-900">{fmt(project.budget)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    No hay proyectos en esta etapa
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Summary Footer */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-3">Resumen por Etapa</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
          {STATUSES.map((status) => {
            const count = getProjectsByStatus(status.id).length;
            return (
              <div key={status.id} className="flex items-center gap-2 text-sm">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                <span className="text-gray-700 font-medium">{status.short}</span>
                <span className="px-1.5 py-0.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: status.color }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
