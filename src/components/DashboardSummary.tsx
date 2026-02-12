"use client";

import {
  FolderKanban,
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingUp,
  CalendarClock,
} from "lucide-react";
import { STATUSES, PRIORITIES, getStatusObj, daysLeft } from "@/lib/constants";
import type { Project } from "@/types/project";

interface Props {
  projects: Project[];
}

export default function DashboardSummary({ projects }: Props) {
  const total = projects.length;
  const terminados = projects.filter((p) => p.status === "terminada").length;
  const activos = total - terminados;

  // Overdue: projects with dueDate in the past and not terminated
  const overdue = projects.filter((p) => {
    if (p.status === "terminada") return false;
    const dl = daysLeft(p.dueDate);
    return dl !== null && dl < 0;
  });

  // Due this week (next 7 days)
  const dueThisWeek = projects.filter((p) => {
    if (p.status === "terminada") return false;
    const dl = daysLeft(p.dueDate);
    return dl !== null && dl >= 0 && dl <= 7;
  });

  // Stuck: projects not terminated and no due date or in first two statuses for more context
  const inDesign = projects.filter((p) => p.status === "en_diseno").length;
  const inExecution = projects.filter((p) => p.status === "en_ejecucion").length;

  const cards = [
    {
      label: "Total Proyectos",
      value: total,
      sub: `${activos} activos`,
      icon: FolderKanban,
      color: "#0ea5e9",
      bg: "bg-sky-50",
    },
    {
      label: "Atrasados",
      value: overdue.length,
      sub: overdue.length > 0 ? overdue.map((p) => p.title.slice(0, 25)).join(", ") : "Ninguno",
      icon: AlertTriangle,
      color: "#ef4444",
      bg: "bg-red-50",
    },
    {
      label: "Vencen esta semana",
      value: dueThisWeek.length,
      sub: dueThisWeek.length > 0 ? dueThisWeek.map((p) => p.title.slice(0, 25)).join(", ") : "Ninguno",
      icon: CalendarClock,
      color: "#f59e0b",
      bg: "bg-amber-50",
    },
    {
      label: "En Diseño",
      value: inDesign,
      sub: "proyectos",
      icon: Clock,
      color: "#f59e0b",
      bg: "bg-amber-50",
    },
    {
      label: "En Ejecución",
      value: inExecution,
      sub: "proyectos",
      icon: TrendingUp,
      color: "#22c55e",
      bg: "bg-green-50",
    },
    {
      label: "Terminados",
      value: terminados,
      sub: total > 0 ? `${Math.round((terminados / total) * 100)}% del total` : "—",
      icon: CheckCircle2,
      color: "#64748b",
      bg: "bg-slate-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`${card.bg} rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: card.color + "15" }}
              >
                <Icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
            </div>
            <p
              className="text-2xl font-bold"
              style={{ color: card.value > 0 && card.color === "#ef4444" ? card.color : "#111827" }}
            >
              {card.value}
            </p>
            <p className="text-xs font-semibold text-gray-600 mt-0.5">
              {card.label}
            </p>
            <p className="text-[10px] text-gray-400 mt-1 truncate">
              {card.sub}
            </p>
          </div>
        );
      })}
    </div>
  );
}
