"use client";

import { useMemo } from "react";
import {
  STATUSES,
  PRIORITIES,
  PROFESSIONALS,
  WORK_TYPES,
  PROJECT_CATEGORIES,
  REQUESTING_UNITS,
  SECTORS,
  BIDDING_TYPES,
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
  TrendingUp,
  Users,
  CalendarClock,
  FolderKanban,
  CheckCircle2,
  ArrowUpRight,
  Building2,
  Layers,
  MapPin,
  Wallet,
  Gavel,
  Tag,
} from "lucide-react";

interface StatsViewProps {
  projects: Project[];
}

const CHART_COLORS = [
  "#F97316", "#0ea5e9", "#8b5cf6", "#22c55e", "#ef4444",
  "#eab308", "#ec4899", "#14b8a6", "#6366f1", "#f43f5e",
  "#64748b", "#84cc16",
];

const tooltipStyle = {
  backgroundColor: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "0.5rem",
  fontSize: "12px",
};

export default function StatsView({ projects }: StatsViewProps) {
  const total = projects.length;
  const terminados = projects.filter((p) => p.status === "terminada").length;
  const activos = total - terminados;
  const totalBudget = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);

  const overdue = projects.filter((p) => {
    if (p.status === "terminada") return false;
    const dl = daysLeft(p.dueDate);
    return dl !== null && dl < 0;
  });

  const dueThisWeek = projects.filter((p) => {
    if (p.status === "terminada") return false;
    const dl = daysLeft(p.dueDate);
    return dl !== null && dl >= 0 && dl <= 7;
  });

  const avgProgress = total > 0
    ? Math.round(projects.reduce((sum, p) => sum + getProgress(p.status, p.subEtapas, p.tipoDesarrollo), 0) / total)
    : 0;

  // ── Budget by Requesting Unit ──
  const budgetByUnit = useMemo(() => {
    const map = new Map<string, { count: number; budget: number }>();
    projects.forEach((p) => {
      const unit = p.requestingUnit || "Sin asignar";
      const prev = map.get(unit) || { count: 0, budget: 0 };
      map.set(unit, { count: prev.count + 1, budget: prev.budget + (Number(p.budget) || 0) });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data, budgetM: Math.round(data.budget / 1000000 * 10) / 10 }))
      .sort((a, b) => b.budget - a.budget)
      .filter((d) => d.budget > 0);
  }, [projects]);

  // ── Budget by Work Type ──
  const budgetByWorkType = useMemo(() => {
    const map = new Map<string, { count: number; budget: number }>();
    projects.forEach((p) => {
      const type = WORK_TYPES.find((w) => w.value === p.tipoDesarrollo)?.label || p.tipoDesarrollo || "Sin tipo";
      const prev = map.get(type) || { count: 0, budget: 0 };
      map.set(type, { count: prev.count + 1, budget: prev.budget + (Number(p.budget) || 0) });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name: name.split(" - ")[0], fullName: name, ...data, budgetM: Math.round(data.budget / 1000000 * 10) / 10 }))
      .sort((a, b) => b.budget - a.budget);
  }, [projects]);

  // ── Budget by Category ──
  const budgetByCategory = useMemo(() => {
    const map = new Map<string, { count: number; budget: number }>();
    projects.forEach((p) => {
      const cat = PROJECT_CATEGORIES.find((c) => c.value === p.categoriaProyecto)?.label || "Sin categoría";
      const prev = map.get(cat) || { count: 0, budget: 0 };
      map.set(cat, { count: prev.count + 1, budget: prev.budget + (Number(p.budget) || 0) });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data, budgetM: Math.round(data.budget / 1000000 * 10) / 10 }))
      .sort((a, b) => b.budget - a.budget);
  }, [projects]);

  // ── Budget by Sector ──
  const budgetBySector = useMemo(() => {
    const map = new Map<string, { count: number; budget: number }>();
    projects.forEach((p) => {
      const sector = SECTORS.find((s) => s.value === p.sector)?.label || p.sector || "Sin sector";
      const prev = map.get(sector) || { count: 0, budget: 0 };
      map.set(sector, { count: prev.count + 1, budget: prev.budget + (Number(p.budget) || 0) });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data, budgetM: Math.round(data.budget / 1000000 * 10) / 10 }))
      .sort((a, b) => b.budget - a.budget)
      .filter((d) => d.budget > 0);
  }, [projects]);

  // ── Budget by Financing Type ──
  const budgetByFinancing = useMemo(() => {
    const map = new Map<string, { count: number; budget: number }>();
    projects.forEach((p) => {
      const fin = p.tipoFinanciamiento || "Sin asignar";
      const prev = map.get(fin) || { count: 0, budget: 0 };
      map.set(fin, { count: prev.count + 1, budget: prev.budget + (Number(p.budget) || 0) });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data, budgetM: Math.round(data.budget / 1000000 * 10) / 10 }))
      .sort((a, b) => b.budget - a.budget)
      .filter((d) => d.budget > 0);
  }, [projects]);

  // ── Budget by Bidding Type ──
  const budgetByBidding = useMemo(() => {
    const map = new Map<string, { count: number; budget: number }>();
    projects.forEach((p) => {
      const bid = BIDDING_TYPES.find((b) => b.value === p.tipoLicitacion)?.label || p.tipoLicitacion || "Sin asignar";
      const prev = map.get(bid) || { count: 0, budget: 0 };
      map.set(bid, { count: prev.count + 1, budget: prev.budget + (Number(p.budget) || 0) });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name: name.split(" - ")[0], fullName: name, ...data, budgetM: Math.round(data.budget / 1000000 * 10) / 10 }))
      .sort((a, b) => b.budget - a.budget)
      .filter((d) => d.budget > 0);
  }, [projects]);

  // ── Status distribution ──
  const statusChartData = STATUSES.map((status) => ({
    name: status.short,
    fullName: status.label,
    count: projects.filter((p) => p.status === status.id).length,
    fill: status.color,
  }));

  // ── Priority distribution ──
  const priorityChartData = Object.entries(PRIORITIES)
    .map(([key, value]) => ({
      name: value.label,
      value: projects.filter((p) => p.priority === key).length,
      fill: value.color,
    }))
    .filter((d) => d.value > 0);

  // ── Workload per professional ──
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
      budget: assigned.reduce((s, p) => s + (Number(p.budget) || 0), 0),
      projects: assigned,
    };
  }).filter((d) => d.total > 0);

  // ── Category by status (cross-tab) ──
  const categoryByStatus = useMemo(() => {
    return PROJECT_CATEGORIES.map((cat) => {
      const catProjects = projects.filter((p) => p.categoriaProyecto === cat.value);
      const row: Record<string, string | number> = { name: cat.label };
      STATUSES.forEach((s) => {
        row[s.short] = catProjects.filter((p) => p.status === s.id).length;
      });
      row.total = catProjects.length;
      return row;
    }).filter((r) => (r.total as number) > 0);
  }, [projects]);

  /* ── Render helpers ── */
  const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-5 h-5 text-[#F97316]" />
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{title}</h3>
    </div>
  );

  const BudgetBarChart = ({ data, title, icon }: { data: { name: string; budgetM: number; count: number; fullName?: string }[]; title: string; icon: React.ElementType }) => (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <SectionTitle icon={icon} title={title} />
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: any, _name: any, props: any) => [
                `$${value}M (${props?.payload?.count || 0} proyectos)`,
                props?.payload?.fullName || ""
              ]) as any} />
            <Bar dataKey="budgetM" radius={[0, 6, 6, 0]}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Total", value: total, icon: FolderKanban, color: "#0ea5e9" },
          { label: "Activos", value: activos, icon: TrendingUp, color: "#22c55e" },
          { label: "Terminados", value: terminados, icon: CheckCircle2, color: "#64748b" },
          { label: "Atrasados", value: overdue.length, icon: AlertTriangle, color: "#ef4444" },
          { label: "Vencen pronto", value: dueThisWeek.length, icon: CalendarClock, color: "#6B7280" },
          { label: "Avance prom.", value: `${avgProgress}%`, icon: ArrowUpRight, color: "#8b5cf6" },
          { label: "Presupuesto", value: fmt(totalBudget), icon: Wallet, color: "#F97316" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          const isAlert = kpi.color === "#ef4444" && typeof kpi.value === "number" && kpi.value > 0;
          return (
            <div key={kpi.label} className={`rounded-xl p-3.5 border ${isAlert ? "border-red-200 bg-red-50" : "border-gray-100 bg-white"} shadow-sm`}>
              <Icon className="w-4 h-4 mb-2" style={{ color: kpi.color }} />
              <p className="text-xl font-bold" style={{ color: isAlert ? "#ef4444" : "#111827" }}>{kpi.value}</p>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">{kpi.label}</p>
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
                <h3 className="font-bold text-red-700">Proyectos Atrasados ({overdue.length})</h3>
              </div>
              <div className="space-y-2">
                {overdue.map((p) => {
                  const dl = daysLeft(p.dueDate);
                  const statusObj = getStatusObj(p.status, p.tipoDesarrollo);
                  return (
                    <div key={p.id} className="bg-white rounded-lg p-3 border border-red-100 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.title}</p>
                        <p className="text-xs text-gray-500">{statusObj.label}</p>
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
                <h3 className="font-bold text-amber-700">Vencen esta semana ({dueThisWeek.length})</h3>
              </div>
              <div className="space-y-2">
                {dueThisWeek.map((p) => {
                  const dl = daysLeft(p.dueDate);
                  return (
                    <div key={p.id} className="bg-white rounded-lg p-3 border border-amber-100 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.title}</p>
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

      {/* ── Row 1: Status + Priority ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <SectionTitle icon={FolderKanban} title="Proyectos por Estado" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={statusChartData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={40} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any, _name: any, props: any) => [
                  String(value), props?.payload?.fullName || ""
                ]) as any} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {statusChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <SectionTitle icon={Layers} title="Distribución por Prioridad" />
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={priorityChartData} cx="50%" cy="50%" labelLine={false}
                label={(entry) => entry.value > 0 ? `${entry.name}: ${entry.value}` : ""}
                outerRadius={95} innerRadius={50} fill="#8884d8" dataKey="value" strokeWidth={2}>
                {priorityChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 2: Budget by Unit + Budget by Category ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetBarChart data={budgetByUnit} title="Inversión por Unidad Requirente (M$)" icon={Building2} />
        <BudgetBarChart data={budgetByCategory} title="Inversión por Categoría (M$)" icon={Tag} />
      </div>

      {/* ── Row 3: Budget by Work Type + Budget by Sector ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetBarChart data={budgetByWorkType} title="Inversión por Tipo de Desarrollo (M$)" icon={Layers} />
        <BudgetBarChart data={budgetBySector} title="Inversión por Sector (M$)" icon={MapPin} />
      </div>

      {/* ── Row 4: Budget by Financing + Budget by Bidding ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetBarChart data={budgetByFinancing} title="Inversión por Tipo Financiamiento (M$)" icon={Wallet} />
        <BudgetBarChart data={budgetByBidding} title="Inversión por Tipo Licitación (M$)" icon={Gavel} />
      </div>

      {/* ── Category × Status cross-table ── */}
      {categoryByStatus.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm overflow-x-auto">
          <SectionTitle icon={Tag} title="Categoría × Estado" />
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-bold text-gray-700">Categoría</th>
                {STATUSES.map((s) => (
                  <th key={s.id} className="text-center py-2 px-2 font-bold" style={{ color: s.color }}>{s.short}</th>
                ))}
                <th className="text-center py-2 px-3 font-bold text-gray-900">Total</th>
              </tr>
            </thead>
            <tbody>
              {categoryByStatus.map((row) => (
                <tr key={row.name as string} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium text-gray-800">{row.name}</td>
                  {STATUSES.map((s) => {
                    const val = row[s.short] as number;
                    return (
                      <td key={s.id} className="text-center py-2 px-2">
                        {val > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-bold" style={{ backgroundColor: s.color }}>{val}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center py-2 px-3 font-bold text-gray-900">{row.total as number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Workload per Professional ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <SectionTitle icon={Users} title="Carga de Trabajo por Jefe de Proyecto" />
        {workloadData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workloadData.map((prof, idx) => {
              const activeProjects = prof.projects.filter((p) => p.status !== "terminada");
              return (
                <div key={prof.fullName} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}>
                      {prof.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{prof.fullName}</p>
                      <p className="text-[10px] text-gray-500">{prof.role}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 mb-3 text-center">
                    <div className="flex-1 bg-sky-50 rounded-lg py-1.5">
                      <p className="text-sm font-bold text-sky-600">{prof.total}</p>
                      <p className="text-[9px] text-gray-500">Total</p>
                    </div>
                    <div className="flex-1 bg-green-50 rounded-lg py-1.5">
                      <p className="text-sm font-bold text-green-600">{prof.active}</p>
                      <p className="text-[9px] text-gray-500">Activos</p>
                    </div>
                    <div className="flex-1 bg-orange-50 rounded-lg py-1.5">
                      <p className="text-sm font-bold text-orange-600">{fmt(prof.budget)}</p>
                      <p className="text-[9px] text-gray-500">Inversión</p>
                    </div>
                  </div>

                  {activeProjects.length > 0 ? (
                    <div className="space-y-1.5">
                      {activeProjects.map((p) => {
                        const statusObj = getStatusObj(p.status, p.tipoDesarrollo);
                        const dl = daysLeft(p.dueDate);
                        const isOverdue = dl !== null && dl < 0;
                        return (
                          <div key={p.id} className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusObj.color }} />
                            <span className="text-gray-700 truncate flex-1">{p.title}</span>
                            {isOverdue && <span className="text-[9px] font-bold text-red-500 flex-shrink-0">!</span>}
                            <span className="text-gray-400 font-medium flex-shrink-0">{statusObj.short}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 italic">Sin proyectos activos</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">Aún no hay profesionales asignados como jefes de proyecto.</p>
        )}
      </div>
    </div>
  );
}
