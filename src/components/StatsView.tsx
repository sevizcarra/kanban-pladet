"use client";

import { STATUSES, PRIORITIES, fmt } from "@/lib/constants";
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
