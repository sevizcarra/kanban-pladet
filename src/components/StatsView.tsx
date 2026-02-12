"use client";

import { STATUSES, PRIORITIES, PROFESSIONALS, SPECIALISTS, fmt } from "@/lib/constants";
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

interface StatsViewProps {
  projects: Project[];
}

export default function StatsView({ projects }: StatsViewProps) {
  // Calculate stat values
  const totalProjects = projects.length;
  const enEjecucion = projects.filter((p) => p.status === "en_ejecucion").length;
  const totalBudget = projects.reduce((sum, p) => {
    const budget = Number(p.budget) || 0;
    return sum + budget;
  }, 0);
  const terminados = projects.filter((p) => p.status === "terminada").length;

  // Prepare data for status bar chart
  const statusChartData = STATUSES.map((status) => ({
    name: status.short,
    count: projects.filter((p) => p.status === status.id).length,
    fill: status.color,
  }));

  // Prepare data for priority pie chart
  const priorityChartData = Object.entries(PRIORITIES).map(([key, value]) => ({
    name: value.label,
    value: projects.filter((p) => p.priority === key).length,
    fill: value.color,
  }));

  // Define stat card colors
  const statCardColors = {
    blue: { bg: "#e0f2fe", borderColor: "#0ea5e9", icon: "📊" },
    green: { bg: "#dcfce7", borderColor: "#22c55e", icon: "▶️" },
    orange: { bg: "#fed7aa", borderColor: "#f59e0b", icon: "💰" },
    gray: { bg: "#f1f5f9", borderColor: "#64748b", icon: "✓" },
  };

  const StatCard = ({
    label,
    value,
    colorKey,
  }: {
    label: string;
    value: string | number;
    colorKey: keyof typeof statCardColors;
  }) => {
    const color = statCardColors[colorKey];
    return (
      <div
        className="rounded-xl border-l-4 p-6 flex items-center gap-4"
        style={{
          backgroundColor: color.bg,
          borderLeftColor: color.borderColor,
        }}
      >
        <span className="text-4xl">{color.icon}</span>
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    );
  };

  // Prepare data for professional workload (by Jefe de Proyecto)
  const workloadData = PROFESSIONALS.map((prof, idx) => {
    const assigned = projects.filter((p) => p.jefeProyectoId === idx);
    const active = assigned.filter((p) => p.status !== "terminada");
    return {
      name: prof.name.split(" ")[0],
      fullName: prof.name,
      profIdx: idx,
      total: assigned.length,
      active: active.length,
    };
  }).filter(d => d.total > 0);

  const WORKLOAD_COLORS = ["#0ea5e9", "#14b8a6", "#8b5cf6", "#f59e0b", "#ef4444", "#22c55e", "#f97316", "#64748b"];

  return (
    <div className="space-y-8 p-6">
      {/* Top Row: Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Proyectos" value={totalProjects} colorKey="blue" />
        <StatCard label="En Ejecución" value={enEjecucion} colorKey="green" />
        <StatCard
          label="Presupuesto Total"
          value={fmt(totalBudget)}
          colorKey="orange"
        />
        <StatCard label="Terminados" value={terminados} colorKey="gray" />
      </div>

      {/* Workload per Professional */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Carga de Trabajo por Profesional
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workloadData.map((prof, idx) => {
            const projectsForProf = projects.filter(p => p.profesionalAsignado === prof.fullName);
            const activeProjects = projectsForProf.filter(p => p.status !== "terminada");
            return (
              <div key={prof.fullName} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: WORKLOAD_COLORS[idx % WORKLOAD_COLORS.length] }}
                  >
                    {prof.fullName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{prof.fullName}</p>
                    <p className="text-xs text-gray-500">
                      {prof.active} activo{prof.active !== 1 ? "s" : ""} · {prof.total} total
                    </p>
                  </div>
                </div>
                {activeProjects.length > 0 ? (
                  <div className="space-y-1.5">
                    {activeProjects.map((p) => {
                      const statusObj = STATUSES.find(s => s.id === p.status);
                      return (
                        <div key={p.id} className="flex items-center gap-2 text-xs">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusObj?.color || "#999" }} />
                          <span className="text-gray-700 truncate flex-1">{p.title}</span>
                          <span className="text-gray-500 font-medium flex-shrink-0">{statusObj?.short}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">Sin proyectos activos asignados</p>
                )}
              </div>
            );
          })}
        </div>
        {workloadData.every(d => d.total === 0) && (
          <p className="text-sm text-gray-500 text-center py-8">
            Aún no hay profesionales asignados a proyectos. Asigna un profesional desde el detalle de cada proyecto.
          </p>
        )}
      </div>

      {/* Two-Column Grid: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Status Bar Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Proyectos por Estado
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={statusChartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" />
              <YAxis
                dataKey="name"
                type="category"
                width={70}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                }}
                formatter={(value) => value}
              />
              <Bar dataKey="count" fill="#0ea5e9" radius={[0, 8, 8, 0]}>
                {statusChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Right: Priority Pie Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Distribución por Prioridad
          </h3>
          <ResponsiveContainer width="100%" height={300}>
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
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
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
                }}
                formatter={(value) => value}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
