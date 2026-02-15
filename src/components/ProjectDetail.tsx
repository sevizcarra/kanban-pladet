"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  Save,
  CheckCircle,
  Trash2,
  AlertTriangle,
  X,
  Upload,
  FileText,
  Users,
  Calendar,
  Briefcase,
  ClipboardList,
  Pencil,
  Check,
  MapPin,
  MessageSquare,
  Package,
  Hammer,
  FolderOpen,
} from "lucide-react";
import {
  STATUSES,
  PRIORITIES,
  PROFESSIONALS,
  INSPECTORS,
  SPECIALISTS,
  BIDDING_TYPES,
  normalizeTipoLicitacion,
  fmt,
  fmtDate,
  getStatusObj,
  getStatusIndex,
  getProgress,
  isFTE,
  getStatusesForProject,
} from "@/lib/constants";
import Badge from "./Badge";
import ProgressBar from "./ProgressBar";
import CommentsSection from "./CommentsSection";
import LocationPicker from "./LocationPicker";
import EmailConfirmDialog from "./EmailConfirmDialog";
import { Project } from "@/types/project";

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  onUpdate: (p: Project) => void;
  onDelete: (id: string, reason: string) => void;
  userEmail: string;
}

/* ── Tab definitions ── */
const TABS_REGULAR = [
  { id: "general", label: "Antecedentes", icon: Calendar },
  { id: "equipo", label: "Equipo", icon: Users },
  { id: "diseno", label: "Diseño", icon: FolderOpen },
  { id: "compras", label: "Compras", icon: Package },
  { id: "ejecucion", label: "Ejecución", icon: Hammer },
  { id: "comentarios", label: "Comentarios", icon: MessageSquare },
] as const;

const TABS_FTE = [
  { id: "general", label: "Resumen", icon: FileText },
  { id: "equipo", label: "Equipo", icon: Users },
  { id: "comentarios", label: "Comentarios", icon: MessageSquare },
] as const;

type TabId = "general" | "equipo" | "diseno" | "compras" | "ejecucion" | "comentarios";

export default function ProjectDetail({
  project,
  onBack,
  onUpdate,
  onDelete,
  userEmail,
}: ProjectDetailProps) {
  // Local editable state
  const [fechaRecepcionMemo, setFechaRecepcionMemo] = useState(project.fechaRecepcionMemo || "");
  const [fechaEstEntrega, setFechaEstEntrega] = useState(project.dueDate || "");
  const [descripcion, setDescripcion] = useState(project.description || "");
  const [fechaLicitacion, setFechaLicitacion] = useState(project.fechaLicitacion || "");
  const [fechaPublicacion, setFechaPublicacion] = useState(project.fechaPublicacion || "");
  const [montoAsignado, setMontoAsignado] = useState(project.budget || "");
  const [tipoFinanciamiento, setTipoFinanciamiento] = useState(project.tipoFinanciamiento || "Capital");
  const [idLicitacion, setIdLicitacion] = useState(project.idLicitacion || "");
  const [codigoProyectoDCI, setCodigoProyectoDCI] = useState(project.codigoProyectoDCI || "");
  const [fechaVencimientoRecursos, setFechaVencimientoRecursos] = useState(project.fechaVencimientoRecursos || "");
  const [memorandumNumber, setMemorandumNumber] = useState(project.memorandumNumber || "");
  const [jefeProyectoId, setJefeProyectoId] = useState(project.jefeProyectoId || -1);
  const [inspectorId, setInspectorId] = useState(project.inspectorId || -1);
  const [especialidades, setEspecialidades] = useState(project.especialidades || []);
  const [subEtapas, setSubEtapas] = useState(
    project.subEtapas || {
      disenoArquitectura: false, disenoEspecialidades: false,
      compraCDP: false, compraEnProceso: false, compraEvaluacionAdj: false, compraAceptacionOC: false,
    }
  );
  const [tipoLicitacion, setTipoLicitacion] = useState(normalizeTipoLicitacion(project.tipoLicitacion || ""));
  const [edpCount, setEdpCount] = useState(project.edpCount || 1);
  const [retCount, setRetCount] = useState(project.retCount || 0);
  const [ndcCount, setNdcCount] = useState(project.ndcCount || 4);
  const [fechaInicioObra, setFechaInicioObra] = useState(project.fechaInicioObra || "");
  const [plazoEjecucion, setPlazoEjecucion] = useState(project.plazoEjecucion ? parseInt(project.plazoEjecucion) : 0);
  const [fechaVencGarantia, setFechaVencGarantia] = useState(project.fechaVencGarantia || "");
  const [fechaRecProviso, setFechaRecProviso] = useState(project.fechaRecProviso || "");
  const [fechaRecDefinitiva, setFechaRecDefinitiva] = useState(project.fechaRecDefinitiva || "");

  // Location
  const [ubicacionLat, setUbicacionLat] = useState(project.ubicacionLat || 0);
  const [ubicacionLng, setUbicacionLng] = useState(project.ubicacionLng || 0);
  const [ubicacionNombre, setUbicacionNombre] = useState(project.ubicacionNombre || "");

  // Title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(project.title);

  // Editable project info
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoUnit, setInfoUnit] = useState(project.requestingUnit || "—");
  const [infoContactName, setInfoContactName] = useState(project.contactName || "—");
  const [infoContactEmail, setInfoContactEmail] = useState(project.contactEmail || "—");

  // UI state
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [emailDialog, setEmailDialog] = useState<{
    open: boolean; pendingStatusId: string; previousStatusLabel: string; newStatusLabel: string;
  }>({ open: false, pendingStatusId: "", previousStatusLabel: "", newStatusLabel: "" });

  // Computed values
  const fechaEstTermino = useMemo(() => {
    if (!fechaInicioObra || !plazoEjecucion) return null;
    const date = new Date(fechaInicioObra);
    date.setDate(date.getDate() + plazoEjecucion);
    return date.toISOString().split("T")[0];
  }, [fechaInicioObra, plazoEjecucion]);

  const showDCI = useMemo(() => tipoFinanciamiento === "DCI" || tipoFinanciamiento === "VRIIC", [tipoFinanciamiento]);
  const canDelete = useMemo(() => deleteReason.trim().length >= 10, [deleteReason]);

  const generatedCode = useMemo(() => {
    const parts = (memorandumNumber || "").split("-");
    const memo = parts.length >= 3 ? parts[2] : "0";
    const yearShort = parts.length >= 2 ? (parts[1] || "").slice(-2) : "00";
    return [memo, yearShort, tipoLicitacion || normalizeTipoLicitacion(project.tipoLicitacion || ""), project.tipoDesarrollo, project.disciplinaLider].filter(Boolean).join("-");
  }, [memorandumNumber, tipoLicitacion, project.tipoLicitacion, project.tipoDesarrollo, project.disciplinaLider]);

  const projectIsFTE = isFTE(project.tipoDesarrollo);
  const projectStatuses = getStatusesForProject(project.tipoDesarrollo);
  const statusObj = getStatusObj(project.status, project.tipoDesarrollo);
  const statusIndex = getStatusIndex(project.status, project.tipoDesarrollo);
  const progress = getProgress(project.status, project.subEtapas, project.tipoDesarrollo);
  const tabs = projectIsFTE ? TABS_FTE : TABS_REGULAR;

  // Handlers
  const handleSave = () => {
    const updated: Project = {
      ...project,
      memorandumNumber: memorandumNumber || "", requestingUnit: infoUnit || "", contactName: infoContactName || "", contactEmail: infoContactEmail || "",
      fechaRecepcionMemo: fechaRecepcionMemo || "", dueDate: fechaEstEntrega || "",
      description: descripcion, fechaLicitacion: fechaLicitacion || "",
      fechaPublicacion: fechaPublicacion || "", budget: montoAsignado,
      tipoFinanciamiento, tipoLicitacion: tipoLicitacion || "",
      codigoProyectoUsa: generatedCode, idLicitacion: idLicitacion || "",
      codigoProyectoDCI: codigoProyectoDCI || "", fechaVencimientoRecursos: fechaVencimientoRecursos || "",
      jefeProyectoId: jefeProyectoId === -1 ? 0 : jefeProyectoId,
      inspectorId: inspectorId === -1 ? 0 : inspectorId,
      profesionalAsignado: "", especialidades, subEtapas, edpCount, retCount, ndcCount,
      fechaInicioObra: fechaInicioObra || "", plazoEjecucion: plazoEjecucion.toString(),
      fechaVencGarantia: fechaVencGarantia || "", fechaRecProviso: fechaRecProviso || "",
      fechaRecDefinitiva: fechaRecDefinitiva || "",
      ubicacionLat, ubicacionLng, ubicacionNombre,
    };
    onUpdate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTitleSave = () => { if (titleDraft.trim()) { onUpdate({ ...project, title: titleDraft.trim() }); setEditingTitle(false); } };
  const handleToggleEspecialidad = (name: string) => { setEspecialidades((prev) => prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]); };
  const handleDeleteConfirm = () => { onDelete(project.id, deleteReason); setShowDeleteConfirm(false); };

  const handleStatusCheckbox = (clickedIdx: number) => {
    let newStatusId = project.status;
    if (clickedIdx <= statusIndex) {
      if (clickedIdx === statusIndex && clickedIdx > 0) newStatusId = projectStatuses[clickedIdx - 1].id;
      else if (clickedIdx < statusIndex) newStatusId = projectStatuses[clickedIdx].id;
    } else {
      newStatusId = projectStatuses[clickedIdx].id;
    }
    if (newStatusId !== project.status) {
      const prevLabel = projectStatuses.find((s) => s.id === project.status)?.label || project.status;
      const newLabel = projectStatuses.find((s) => s.id === newStatusId)?.label || newStatusId;
      setEmailDialog({ open: true, pendingStatusId: newStatusId, previousStatusLabel: prevLabel, newStatusLabel: newLabel });
    }
  };

  const commitStatusChange = async (sendEmail: boolean, editedName?: string, editedEmail?: string) => {
    const newStatusId = emailDialog.pendingStatusId;
    const updatedProject = { ...project, status: newStatusId, ...(editedName !== undefined ? { contactName: editedName } : {}), ...(editedEmail !== undefined ? { contactEmail: editedEmail } : {}) };
    onUpdate(updatedProject);
    const toEmail = editedEmail || project.contactEmail;
    const toName = editedName || project.contactName;
    if (sendEmail && toEmail && toEmail !== "—" && toEmail.includes("@")) {
      const res = await fetch("/api/send-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "status_change", to: toEmail, contactName: toName || "Estimado/a", projectName: project.title, projectCode: project.codigoProyectoUsa || "—", previousStatus: project.status, newStatus: newStatusId }) });
      if (!res.ok) throw new Error("Email send failed");
    }
  };

  const handleSubEtapaChange = (key: keyof typeof subEtapas) => { setSubEtapas((prev) => ({ ...prev, [key]: !prev[key] })); };

  /* ── Shared UI ── */
  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none";
  const cardCls = "bg-white rounded-xl border border-gray-200 p-5";

  /* ── Sub-etapas for current status ── */
  const currentStatusId = projectStatuses[statusIndex]?.id;
  const hasSubEtapas = !projectIsFTE && (currentStatusId === "en_diseno" || currentStatusId === "gestion_compra");

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* ═══ HEADER ═══ */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm z-20">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input type="text" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleTitleSave(); if (e.key === "Escape") { setEditingTitle(false); setTitleDraft(project.title); } }}
                className="text-lg font-bold text-gray-900 border-b-2 border-[#F97316] outline-none bg-transparent flex-1 py-0.5" autoFocus />
              <button onClick={handleTitleSave} className="p-1.5 hover:bg-green-50 rounded-lg transition text-green-600"><Check className="w-4 h-4" /></button>
              <button onClick={() => { setEditingTitle(false); setTitleDraft(project.title); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900 truncate">{project.title}</h1>
              <button onClick={() => setEditingTitle(true)} className="p-1 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600 flex-shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
              <span className="bg-[#F97316]/10 text-[#F97316] px-2 py-0.5 rounded font-mono text-[11px] font-bold tracking-wide flex-shrink-0">{generatedCode || "—"}</span>
            </div>
          )}
        </div>
        <button onClick={handleSave}
          className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-all flex-shrink-0 ${saved ? "bg-green-500 text-white" : "bg-[#F97316] hover:bg-[#F97316]/90 text-white"}`}>
          {saved ? <><CheckCircle className="w-4 h-4" /> Guardado</> : <><Save className="w-4 h-4" /> Guardar</>}
        </button>
      </div>

      {/* ═══ HORIZONTAL STATUS STEPPER ═══ */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3 z-10">
        {/* Steps */}
        <div className="flex items-center">
          {projectStatuses.map((status, idx) => {
            const isCompleted = idx < statusIndex;
            const isCurrent = idx === statusIndex;
            const isFuture = idx > statusIndex;
            return (
              <div key={status.id} className="flex items-center flex-1 last:flex-initial">
                {/* Step circle + label */}
                <button
                  onClick={() => handleStatusCheckbox(idx)}
                  className="flex flex-col items-center gap-1 group relative"
                  title={status.label}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2 ${
                    isCompleted ? "bg-green-500 border-green-500 text-white" :
                    isCurrent ? "bg-[#F97316] border-[#F97316] text-white ring-4 ring-[#F97316]/20" :
                    "bg-white border-gray-300 text-gray-400 group-hover:border-gray-400"
                  }`}>
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <span className={`text-[10px] leading-tight text-center max-w-[80px] ${
                    isCurrent ? "font-bold text-[#F97316]" : isCompleted ? "font-medium text-green-700" : "text-gray-400"
                  }`}>
                    {status.label}
                  </span>
                </button>
                {/* Connector line */}
                {idx < projectStatuses.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mt-[-14px] rounded ${isCompleted ? "bg-green-400" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Sub-etapas row (if current status has them) */}
        {hasSubEtapas && (
          <div className="flex items-center gap-4 mt-2.5 pl-2 border-t border-gray-100 pt-2">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">Sub-etapas:</span>
            {currentStatusId === "en_diseno" && (
              <>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-amber-50 px-2 py-1 rounded transition text-gray-700">
                  <input type="checkbox" checked={!!subEtapas.disenoArquitectura} onChange={() => handleSubEtapaChange("disenoArquitectura")} className="rounded border-gray-300 text-amber-500 focus:ring-amber-400 w-3.5 h-3.5" />
                  Arquitectura
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-amber-50 px-2 py-1 rounded transition text-gray-700">
                  <input type="checkbox" checked={!!subEtapas.disenoEspecialidades} onChange={() => handleSubEtapaChange("disenoEspecialidades")} className="rounded border-gray-300 text-amber-500 focus:ring-amber-400 w-3.5 h-3.5" />
                  Especialidades
                </label>
              </>
            )}
            {currentStatusId === "gestion_compra" && (
              <>
                {([["compraCDP", "CDP solicitado"], ["compraEnProceso", "En proceso de compra"], ["compraEvaluacionAdj", "Evaluación/Adjudicación"], ["compraAceptacionOC", "En aceptación de OC"]] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-orange-50 px-2 py-1 rounded transition text-gray-700">
                    <input type="checkbox" checked={!!subEtapas[key]} onChange={() => handleSubEtapaChange(key)} className="rounded border-gray-300 text-orange-500 focus:ring-orange-400 w-3.5 h-3.5" />
                    {label}
                  </label>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ═══ TAB BAR ═══ */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 px-6 pt-2 flex items-end gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabId)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all border border-b-0 ${
                isActive ? "bg-white text-[#F97316] border-gray-200 shadow-sm -mb-px z-10" : "text-gray-700 hover:text-gray-900 hover:bg-gray-200 border-transparent"
              }`}>
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
        {/* Delete at far right */}
        <button onClick={() => setShowDeleteConfirm(true)} className="ml-auto flex items-center gap-1 px-3 py-2 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition mb-1">
          <Trash2 className="w-3.5 h-3.5" />
          Eliminar
        </button>
      </div>

      {/* ═══ TAB CONTENT — full width, scrollable ═══ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-4">

          {/* ── TAB: Antecedentes / Resumen ── */}
          {activeTab === "general" && (
            <>
              {/* Project info card */}
              <div className={cardCls}>
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="w-5 h-5 text-[#F97316]" />
                  <h2 className="text-base font-bold text-gray-900">Información del Proyecto</h2>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 font-semibold mb-1">Código PLADET</label>
                    <input type="text" disabled value={generatedCode || "—"} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-gray-50 text-gray-600 font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 font-semibold mb-1">Unidad Requirente</label>
                    <input type="text" value={infoUnit} onChange={(e) => setInfoUnit(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 font-semibold mb-1">Nombre Contacto</label>
                    <input type="text" value={infoContactName} onChange={(e) => setInfoContactName(e.target.value)} placeholder="Nombre" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 font-semibold mb-1">Email Contacto</label>
                    <input type="email" value={infoContactEmail === "—" ? "" : infoContactEmail} onChange={(e) => setInfoContactEmail(e.target.value)} placeholder="correo@ejemplo.cl" className={inputCls} />
                  </div>
                </div>
              </div>

              {projectIsFTE ? (
                /* FTE: additional summary info */
                <div className={cardCls}>
                  <div className="grid grid-cols-3 gap-4">
                    <div><p className="text-xs text-gray-500 font-semibold">Tipo de Desarrollo</p><p className="text-sm font-medium text-gray-900">FTE — Factibilidad Técnica</p></div>
                    <div><p className="text-xs text-gray-500 font-semibold">Disciplina Líder</p><p className="text-sm font-medium text-gray-900">{project.disciplinaLider || "—"}</p></div>
                    <div><p className="text-xs text-gray-500 font-semibold">Sector</p><p className="text-sm font-medium text-gray-900">{project.sector || "—"}</p></div>
                    <div><p className="text-xs text-gray-500 font-semibold">Fecha Creación</p><p className="text-sm font-medium text-gray-900">{fmtDate(project.createdAt)}</p></div>
                    <div><p className="text-xs text-gray-500 font-semibold">Fecha Est. Entrega</p><p className="text-sm font-medium text-gray-900">{fmtDate(project.dueDate)}</p></div>
                    {project.jefeProyectoId !== undefined && project.jefeProyectoId >= 0 && PROFESSIONALS[project.jefeProyectoId] && (
                      <div><p className="text-xs text-gray-500 font-semibold">Jefe de Proyecto</p><p className="text-sm font-medium text-gray-900">{PROFESSIONALS[project.jefeProyectoId].name}</p></div>
                    )}
                  </div>
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <p className="text-xs text-gray-500 font-semibold mb-1">Descripción</p>
                    <p className="text-sm text-gray-700">{project.description || "Sin descripción"}</p>
                  </div>
                </div>
              ) : (
                /* Regular: Antecedentes Generales */
                <>
                  <div className={cardCls}>
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="w-5 h-5 text-[#F97316]" />
                      <h2 className="text-base font-bold text-gray-900">Antecedentes Generales</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-600 font-semibold mb-1">N° Memorándum</label>
                        <input type="text" value={memorandumNumber} onChange={(e) => setMemorandumNumber(e.target.value)} className={inputCls} placeholder="MEM-2026-XXXX" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 font-semibold mb-1">Fecha Recepción Memorándum</label>
                        <input type="date" value={fechaRecepcionMemo} onChange={(e) => setFechaRecepcionMemo(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 font-semibold mb-1">Fecha Est. Entrega</label>
                        <input type="date" value={fechaEstEntrega} onChange={(e) => setFechaEstEntrega(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 font-semibold mb-1">Fecha de envío a DOCL</label>
                        <input type="date" value={fechaLicitacion} onChange={(e) => setFechaLicitacion(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 font-semibold mb-1">Fecha Publicación</label>
                        <input type="date" value={fechaPublicacion} onChange={(e) => setFechaPublicacion(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 font-semibold mb-1">Monto Asignado CDP</label>
                        <div className="flex items-center">
                          <span className="text-sm text-gray-600 mr-2">$</span>
                          <input type="text" value={montoAsignado} onChange={(e) => setMontoAsignado(e.target.value)} className={"flex-1 " + inputCls} placeholder="0" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 font-semibold mb-1">Tipo Financiamiento</label>
                        <select value={tipoFinanciamiento} onChange={(e) => setTipoFinanciamiento(e.target.value)} className={inputCls}>
                          <option value="Capital">Capital</option><option value="Corriente">Corriente</option><option value="Corriente USACH">Corriente USACH</option><option value="DCI">DCI</option><option value="VRIIC">VRIIC</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 font-semibold mb-1">Tipo de Licitación</label>
                        <select value={tipoLicitacion} onChange={(e) => setTipoLicitacion(e.target.value)} className={inputCls}>
                          <option value="">Seleccionar...</option>
                          {BIDDING_TYPES.map((bt) => (<option key={bt.value} value={bt.value}>{bt.label}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 font-semibold mb-1">ID Licitación</label>
                        <input type="text" value={idLicitacion} onChange={(e) => setIdLicitacion(e.target.value)} className={inputCls} />
                      </div>
                      {showDCI && (
                        <div>
                          <label className="block text-xs text-gray-600 font-semibold mb-1">Código Proyecto DCI</label>
                          <input type="text" value={codigoProyectoDCI} onChange={(e) => setCodigoProyectoDCI(e.target.value)} className={inputCls} />
                        </div>
                      )}
                      {showDCI && (
                        <div>
                          <label className="block text-xs text-gray-600 font-semibold mb-1">Fecha Venc. Recursos</label>
                          <input type="date" value={fechaVencimientoRecursos} onChange={(e) => setFechaVencimientoRecursos(e.target.value)} className={inputCls} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className={cardCls}>
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="w-5 h-5 text-[#F97316]" />
                      <h2 className="text-base font-bold text-gray-900">Descripción del Proyecto</h2>
                    </div>
                    <label className="block text-xs text-gray-600 font-semibold mb-1">Descripción ({descripcion.length}/200)</label>
                    <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value.slice(0, 200))} maxLength={200}
                      className={inputCls + " resize-none h-20"} placeholder="Ingrese la descripción del proyecto..." />
                  </div>

                  {/* Location */}
                  <LocationPicker lat={ubicacionLat} lng={ubicacionLng} nombre={ubicacionNombre}
                    onLocationChange={(lat, lng, nombre) => { setUbicacionLat(lat); setUbicacionLng(lng); setUbicacionNombre(nombre); }} />
                </>
              )}
            </>
          )}

          {/* ── TAB: Equipo ── */}
          {activeTab === "equipo" && (
            <div className={cardCls}>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-[#F97316]" />
                <h2 className="text-base font-bold text-gray-900">Equipo del Proyecto</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-600 font-semibold mb-1">Jefe de Proyecto</label>
                  <select value={jefeProyectoId === -1 ? "" : jefeProyectoId} onChange={(e) => setJefeProyectoId(e.target.value ? parseInt(e.target.value) : -1)} className={inputCls}>
                    <option value="">Seleccionar...</option>
                    {PROFESSIONALS.map((prof, idx) => (<option key={idx} value={idx}>{prof.name} — {prof.role}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 font-semibold mb-1">Inspector Técnico</label>
                  <select value={inspectorId === -1 ? "" : inspectorId} onChange={(e) => setInspectorId(e.target.value ? parseInt(e.target.value) : -1)} className={inputCls}>
                    <option value="">Seleccionar...</option>
                    {INSPECTORS.map((inspector, idx) => (<option key={idx} value={idx}>{inspector}</option>))}
                  </select>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-600 font-semibold mb-3">Especialistas</p>
                <div className="grid grid-cols-2 gap-2">
                  {SPECIALISTS.map((s) => (
                    <label key={s.name} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition">
                      <input type="checkbox" checked={especialidades.includes(s.name)} onChange={() => handleToggleEspecialidad(s.name)} className="rounded border-gray-300 text-[#F97316] focus:ring-[#F97316]" />
                      <div><p className="text-sm font-medium text-gray-900">{s.name}</p><p className="text-xs text-gray-500">{s.discipline}</p></div>
                    </label>
                  ))}
                </div>
              </div>

              {/* FTE: Informe de Factibilidad */}
              {projectIsFTE && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="text-xs text-gray-600 font-semibold mb-3">Informe de Factibilidad</p>
                  <button className="w-full border-2 border-dashed border-gray-300 hover:border-[#F97316] rounded-lg p-6 text-center transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-[#F97316]">
                    <Upload className="w-6 h-6" /><span className="text-sm font-medium">Adjuntar Informe</span><span className="text-xs text-gray-400">PDF, DOC o imagen</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Diseño ── */}
          {activeTab === "diseno" && !projectIsFTE && (
            <div className={cardCls}>
              <div className="flex items-center gap-2 mb-4">
                <FolderOpen className="w-5 h-5 text-[#F97316]" />
                <h2 className="text-base font-bold text-gray-900">Documentación de Diseño</h2>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {["Ficha de Proyecto", "Planos", "EETT", "Itemizado"].map((doc) => (
                  <button key={doc} className="border-2 border-dashed border-gray-300 hover:border-[#F97316] rounded-lg p-6 text-center transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-[#F97316]">
                    <Upload className="w-5 h-5" /><span className="text-sm font-medium">{doc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: Compras ── */}
          {activeTab === "compras" && !projectIsFTE && (
            <div className={cardCls}>
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-[#F97316]" />
                <h2 className="text-base font-bold text-gray-900">Antecedentes de Compra</h2>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {["Formulario compra / BT", "CDP", "OC / CTTO", "Oferta", "Acta de visita", "Cuadro ADJ / Informe"].map((doc) => (
                  <button key={doc} className="border-2 border-dashed border-gray-300 hover:border-[#F97316] rounded-lg p-6 text-center transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-[#F97316]">
                    <Upload className="w-5 h-5" /><span className="text-sm font-medium">{doc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: Ejecución ── */}
          {activeTab === "ejecucion" && !projectIsFTE && (
            <>
              <div className={cardCls}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-[#F97316]" />
                  <h2 className="text-base font-bold text-gray-900">Antecedentes de Ejecución</h2>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="block text-xs text-gray-600 font-semibold mb-1">Fecha Inicio Obra</label><input type="date" value={fechaInicioObra} onChange={(e) => setFechaInicioObra(e.target.value)} className={inputCls} /></div>
                  <div><label className="block text-xs text-gray-600 font-semibold mb-1">Plazo Ejecución (días corridos)</label><input type="number" value={plazoEjecucion} onChange={(e) => setPlazoEjecucion(parseInt(e.target.value) || 0)} className={inputCls} placeholder="0" /></div>
                  <div><label className="block text-xs text-gray-600 font-semibold mb-1">Fecha Est. Término</label><input type="text" disabled value={fechaEstTermino ? fmtDate(fechaEstTermino) : "—"} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-gray-50 text-gray-600" /></div>
                  <div><label className="block text-xs text-gray-600 font-semibold mb-1">Fecha Venc. Garantía</label><input type="date" value={fechaVencGarantia} onChange={(e) => setFechaVencGarantia(e.target.value)} className={inputCls} /></div>
                  <div><label className="block text-xs text-gray-600 font-semibold mb-1">Fecha Rec. Provisoria</label><input type="date" value={fechaRecProviso} onChange={(e) => setFechaRecProviso(e.target.value)} className={inputCls} /></div>
                  <div><label className="block text-xs text-gray-600 font-semibold mb-1">Fecha Rec. Definitiva</label><input type="date" value={fechaRecDefinitiva} onChange={(e) => setFechaRecDefinitiva(e.target.value)} className={inputCls} /></div>
                </div>
              </div>

              {/* EDPs */}
              <div className={cardCls}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Briefcase className="w-5 h-5 text-[#F97316]" /><h2 className="text-base font-bold text-gray-900">EDPs</h2></div>
                  <span className="text-xs text-gray-600 font-semibold">Total: {edpCount}</span>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {Array.from({ length: edpCount }).map((_, idx) => (
                    <button key={`edp-${idx}`} className="border-2 border-dashed border-gray-300 hover:border-[#F97316] rounded-lg p-3 text-center transition flex flex-col items-center justify-center gap-1 text-gray-600 hover:text-[#F97316]">
                      <Upload className="w-4 h-4" /><span className="text-xs font-medium">EDP {idx + 1}</span>
                    </button>
                  ))}
                </div>
                {retCount > 0 && (
                  <div className="border-t border-gray-200 pt-3 mb-3">
                    <p className="text-xs text-gray-600 font-semibold mb-2">Retenciones</p>
                    <div className="grid grid-cols-4 gap-3">
                      {Array.from({ length: retCount }).map((_, idx) => (
                        <button key={`ret-${idx}`} className="border-2 border-dashed border-gray-300 hover:border-gray-500 rounded-lg p-3 text-center transition flex flex-col items-center justify-center gap-1 text-gray-600">
                          <Upload className="w-4 h-4" /><span className="text-xs font-medium">Retención {idx + 1}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setEdpCount((p) => p + 1)} className="flex-1 px-3 py-2 rounded-lg border border-[#F97316] text-[#F97316] text-sm font-semibold hover:bg-[#F97316]/5 transition">+ EDP</button>
                  <button onClick={() => setRetCount((p) => p + 1)} className="flex-1 px-3 py-2 rounded-lg border border-gray-400 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition">+ Retención</button>
                </div>
              </div>

              {/* NDCs */}
              <div className={cardCls}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Briefcase className="w-5 h-5 text-[#F97316]" /><h2 className="text-base font-bold text-gray-900">NDCs</h2></div>
                  <span className="text-xs text-gray-600 font-semibold">Total: {ndcCount}</span>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {Array.from({ length: ndcCount }).map((_, idx) => (
                    <button key={`ndc-${idx}`} className="border-2 border-dashed border-gray-300 hover:border-[#F97316] rounded-lg p-3 text-center transition flex flex-col items-center justify-center gap-1 text-gray-600 hover:text-[#F97316]">
                      <Upload className="w-4 h-4" /><span className="text-xs font-medium">NDC {idx + 1}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setNdcCount((p) => p + 1)} className="w-full px-3 py-2 rounded-lg border border-[#F97316] text-[#F97316] text-sm font-semibold hover:bg-[#F97316]/5 transition">+ NDC</button>
              </div>

              {/* MCD */}
              <div className={cardCls}>
                <div className="flex items-center gap-2 mb-4"><ClipboardList className="w-5 h-5 text-[#F97316]" /><h2 className="text-base font-bold text-gray-900">Modificación de Contrato (MCD)</h2></div>
                <div className="grid grid-cols-3 gap-4">
                  {["Libro de Obra", "CDP MCD", "Modificación"].map((doc) => (
                    <button key={doc} className="border-2 border-dashed border-gray-300 hover:border-[#F97316] rounded-lg p-4 text-center transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-[#F97316]">
                      <Upload className="w-5 h-5" /><span className="text-sm font-medium">{doc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── TAB: Comentarios ── */}
          {activeTab === "comentarios" && (
            <CommentsSection projectId={project.id} userEmail={userEmail} />
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full overflow-hidden">
            <div className="bg-red-500 px-6 py-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-white flex-shrink-0" />
              <h3 className="text-lg font-bold text-white">Eliminar Proyecto</h3>
            </div>
            <div className="p-6 space-y-4">
              <div><p className="text-sm text-gray-600 mb-1">Proyecto a eliminar:</p><p className="text-sm font-semibold text-gray-900">{project.title}</p><p className="text-xs text-gray-500">Memorándum: {project.memorandumNumber}</p></div>
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-2">Justificación (mínimo 10 caracteres)</label>
                <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-red-500 outline-none resize-none h-24" placeholder="Ingrese la razón..." />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowDeleteConfirm(false); setDeleteReason(""); }} className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition">Cancelar</button>
                <button onClick={handleDeleteConfirm} disabled={!canDelete} className={`flex-1 px-3 py-2 rounded-lg text-white text-sm font-semibold transition ${canDelete ? "bg-red-500 hover:bg-red-600" : "bg-gray-300 cursor-not-allowed"}`}>Confirmar Eliminación</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email notification dialog */}
      <EmailConfirmDialog isOpen={emailDialog.open}
        onClose={() => { commitStatusChange(false); setEmailDialog((prev) => ({ ...prev, open: false })); }}
        onConfirm={async (editedName: string, editedEmail: string) => { await commitStatusChange(true, editedName, editedEmail); }}
        onSkip={() => { commitStatusChange(false); setEmailDialog((prev) => ({ ...prev, open: false })); }}
        contactName={project.contactName || "—"} contactEmail={project.contactEmail || "—"}
        projectName={project.title} projectCode={project.codigoProyectoUsa || "—"}
        type="status_change" previousStatus={emailDialog.previousStatusLabel} newStatus={emailDialog.newStatusLabel} />
    </div>
  );
}
