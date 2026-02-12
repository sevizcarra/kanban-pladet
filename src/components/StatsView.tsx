"use client";

import {
  STATUSES,
  PRIORITIES,
  PROFESSIONALS,
  fmt,
  daysLeft,
  getProgress,
  getStatusObj,
} from "@/lib/constants";
import { Project } from "@/types/project";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  Clock,
  TrendingUp,
  Users,
  CalendarClock,
  FolderKanban,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";

interface StatsViewProps {
  projects: Project[];
}

export default function StatsView({ projects }: StatsViewProps) {
  const total = projects.length;
  const terminados = projects.filter((p) => p.status === "terminada").length;
  const activos = total - terminados;
  const totalBudget = projects.reduce(
    (sum, p) => sum + (Number(p.budget) || 0),
    0
  );

  // Overdue projects
  const overdue = projects.filter((p) => {
    if (p.status === "terminada") return false;
    const dl = daysLeft(p.dueDate);
    return dl !== null && dl < 0;
  });

  // Due this week
  const dueThisWeek = projects.filter((p) => {
    if (p.status === "terminada") return false;
    const dl = daysLeft(p.dueDate);
    return dl !== null && dl >= 0 && dl <= 7;
  });

  // Average progress
  const avgProgress =
    total > 0
      ? Math.round(
          projects.reduce(
            (sum, p) =>
              sum + getProgress(p.status, p.subEtapas, p.tipoDesarrollo),
            0
          ) / total
        )
      : 0;

  // ── Chart Data ──

  // Status distribution
  const statusChartData = STATUSES.map((status) => ({
    name: status.short,
    fullName: status.label,
    count: projects.filter((p) => p.status === status.id).length,
    fill: status.color,
  }));

  // Priority distribution
  const priorityChartData = Object.entries(PRIORITIES)
    .map(([key, value]) => ({
      name: value.label,
      value: projects.filter((p) => p.priority === key).length,
      fill: value.color,
    }))
    .filter((d) => d.value > 0);

  // Workload per professional (jefe de proyecto)
  const workloadData = PROFESSIONALS.map((prof, idx) => {
    const assigned = projects.filter((p) => p.jefeProyectoId === idx);
    const active = assigned.filter((p) => p.status !== "terminada");
    return {
      name: prof.name.split(" ").slice(0, 2).join(" "),
      fullName: prof.name,
      role: prof.role,
      idx,
      total: assigned.length,
      active: active.length,
      completed: assigned.length - active.length,
      projects: assigned,
    };
  }).filter((d) => d.total > 0);

  // Budget by status
  const budgetByStatus = STATUSES.map((status) => {
    const budget = projects
      .filter((p) => p.status === status.id)
      .reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    return {
      name: status.short,
      fullName: status.label,
      budget: Math.round(budget / 1000000),
      fill: status.color,
    };
  }).filter((d) => d.budget > 0);

  const COLORS = [
    "#0ea5e9",
    "#8b5cf6",
    "#f59e0b",
    "#14b8a6",
    "#f97316",
    "#22c55e",
    "#ef4444",
    "#64748b",
  ];

  return (
    <div className="space-y-6">
      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          {
            label: "Total",
            value: total,
            icon: FolderKanban,
            color: "#0ea5e9",
          },
          {
            label: "Activos",
            value: activos,
            icon: TrendingUp,
            color: "#22c55e",
          },
          {
            label: "Terminados",
            value: terminados,
            icon: CheckCircle2,
            color: "#64748b",
          },
          {
            label: "Atrasados",
            value: overdue.length,
            icon: AlertTriangle,
            color: "#ef4444",
          },
          {
            label: "Vencen pronto",
            value: dueThisWeek.length,
            icon: CalendarClock,
            color: "#f59e0b",
          },
          {
            label: "Avance prom.",
            value: `${avgProgress}%`,
            icon: ArrowUpRight,
            color: "#8b5cf6",
          },
          {
            label: "Presupuesto",
            value: fmt(totalBudget),
            icon: FolderKanban,
            color: "#14b8a6",
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          const isAlert =
            kpi.color === "#ef4444" &&
            typeof kpi.value === "number" &&
            kpi.value > 0;
          return (
            <div
              key={kpi.label}
              className={`rounded-xl p-3.5 border ${
                isAlert ? "border-red-200 bg-red-50" : "border-gray-100 bg-white"
              } shadow-sm`}
            >
              <Icon
                className="w-4 h-4 mb-2"
                style={{ color: kpi.color }}
              />
              <p
                className="text-xl font-bold"
                style={{
                  color: isAlert ? "#ef4444" : "#111827",
                }}
              >
                {kpi.value}
              </p>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
                {kpi.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Alertas Section ── */}
      {(overdue.length > 0 || dueThisWeek.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {overdue.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-red-700">
                  Proyectos Atrasados ({overdue.length})
                </h3>
              </div>
              <div className="space-y-2">
                {overdue.map((p) => {
                  const dl = daysLeft(p.dueDate);
                  const statusObj = getStatusObj(p.status, p.tipoDesarrollo);
                  return (
                    <div
                      key={p.id}
                      className="bg-white rounded-lg p-3 border border-red-100 flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {p.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {statusObj.label}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full flex-shrink-0 ml-2">
                        {Math.abs(dl || 0)}d atraso
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {dueThisWeek.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-amber-700">
                  Vencen esta semana ({dueThisWeek.length})
                </h3>
              </div>
              <div className="space-y-2">
                {dueThisWeek.map((p) => {
                  const dl = daysLeft(p.dueDate);
                  return (
                    <div
                      key={p.id}
                      className="bg-white rounded-lg p-3 border border-amber-100 flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {p.title}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full flex-shrink-0 ml-2">
                        {dl === 0 ? "Hoy" : `${dl}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Bar Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-gray-900 uppercase tracking-wide">
            Proyectos por Estado
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={statusChartData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                width={40}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any, name: any, props: any) => [
                  String(value), props?.payload?.fullName || name || ""
                ]) as any}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {statusChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Priority Pie */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-gray-900 uppercase tracking-wide">
            Distribución por Prioridad
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={priorityChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) =>
                  entry.value > 0
                    ? `${entry.name}: ${entry.value}`
                    : ""
                }
                outerRadius={95}
                innerRadius={50}
                fill="#8884d8"
                dataKey="value"
                strokeWidth={2}
              >
                {priorityChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Budget by Status ── */}
      {budgetByStatus.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-gray-900 uppercase tracking-wide">
            Presupuesto por Estado (millones CLP)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={budgetByStatus}
              margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any, name: any, props: any) => [
                  `$${value}M`, props?.payload?.fullName || name || ""
                ]) as any}
              />
              <Bar dataKey="budget" radius={[6, 6, 0, 0]}>
                {budgetByStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Workload per Professional ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-[#00A499]" />
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
            Carga de Trabajo por Jefe de Proyecto
          </h3>
        </div>

        {workloadData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workloadData.map((prof, idx) => {
              const activeProjects = prof.projects.filter(
                (p) => p.status !== "terminada"
              );
              return (
                <div
                  key={prof.fullName}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{
                        backgroundColor: COLORS[idx % COLORS.length],
                      }}
                    >
                      {prof.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {prof.fullName}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {prof.role}
                      </p>
                    </div>
                  </div>

                  {/* Mini stats */}
                  <div className="flex gap-3 mb-3 text-center">
                    <div className="flex-1 bg-sky-50 rounded-lg py-1.5">
                      <p className="text-sm font-bold text-sky-600">
                        {prof.total}
                      </p>
                      <p className="text-[9px] text-gray-500">Total</p>
                    </div>
                    <div className="flex-1 bg-green-50 rounded-lg py-1.5">
                      <p className="text-sm font-bold text-green-600">
                        {prof.active}
                      </p>
                      <p className="text-[9px] text-gray-500">Activos</p>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg py-1.5">
                      <p className="text-sm font-bold text-gray-600">
                        {prof.completed}
                      </p>
                      <p className="text-[9px] text-gray-500">Terminados</p>
                    </div>
                  </div>

                  {/* Project list */}
                  {activeProjects.length > 0 ? (
                    <div className="space-y-1.5">
                      {activeProjects.map((p) => {
                        const statusObj = getStatusObj(
                          p.status,
                          p.tipoDesarrollo
                        );
                        const dl = daysLeft(p.dueDate);
                        const isOverdue = dl !== null && dl < 0;
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-2 text-xs"
                          >
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor: statusObj.color,
                              }}
                            />
                            <span className="text-gray-700 truncate flex-1">
                              {p.title}
                            </span>
                            {isOverdue && (
                              <span className="text-[9px] font-bold text-red-500 flex-shrink-0">
                                !
                              </span>
                            )}
                            <span className="text-gray-400 font-medium flex-shrink-0">
                              {statusObj.short}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 italic">
                      Sin proyectos activos
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">
            Aún no hay profesionales asignados como jefes de proyecto.
          </p>
        )}
      </div>
    </div>
  );
}
