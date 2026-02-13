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
} from "lucide-react";
import {
  STATUSES,
  PRIORITIES,
  PROFESSIONALS,
  INSPECTORS,
  SPECIALISTS,
  BIDDING_TYPES,
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
import { Project } from "@/types/project";

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  onUpdate: (p: Project) => void;
  onDelete: (id: string, reason: string) => void;
  userEmail: string;
}

export default function ProjectDetail({
  project,
  onBack,
  onUpdate,
  onDelete,
  userEmail,
}: ProjectDetailProps) {
  // Local editable state
  const [fechaRecepcionMemo, setFechaRecepcionMemo] = useState(
    project.fechaRecepcionMemo || ""
  );
  const [fechaEstEntrega, setFechaEstEntrega] = useState(
    project.dueDate || ""
  );
  const [descripcion, setDescripcion] = useState(project.description || "");
  const [fechaLicitacion, setFechaLicitacion] = useState(
    project.fechaLicitacion || ""
  );
  const [fechaPublicacion, setFechaPublicacion] = useState(
    project.fechaPublicacion || ""
  );
  const [montoAsignado, setMontoAsignado] = useState(project.budget || "");
  const [tipoFinanciamiento, setTipoFinanciamiento] = useState(
    project.tipoFinanciamiento || "Capital"
  );
  const [idLicitacion, setIdLicitacion] = useState(
    project.idLicitacion || ""
  );
  const [codigoProyectoDCI, setCodigoProyectoDCI] = useState(
    project.codigoProyectoDCI || ""
  );
  const [fechaVencimientoRecursos, setFechaVencimientoRecursos] = useState(
    project.fechaVencimientoRecursos || ""
  );
  const [jefeProyectoId, setJefeProyectoId] = useState(
    project.jefeProyectoId || -1
  );
  const [inspectorId, setInspectorId] = useState(project.inspectorId || -1);
  // profesionalAsignado removido — el Jefe de Proyecto desarrolla la propuesta
  const [especialidades, setEspecialidades] = useState(
    project.especialidades || []
  );
  const [subEtapas, setSubEtapas] = useState(
    project.subEtapas || {
      disenoArquitectura: false,
      disenoEspecialidades: false,
      compraCDP: false,
      compraEnProceso: false,
      compraEvaluacionAdj: false,
    }
  );
  const [tipoLicitacion, setTipoLicitacion] = useState(
    project.tipoLicitacion || ""
  );
  const [edpCount, setEdpCount] = useState(project.edpCount || 1);
  const [retCount, setRetCount] = useState(project.retCount || 0);
  const [ndcCount, setNdcCount] = useState(project.ndcCount || 4);
  const [fechaInicioObra, setFechaInicioObra] = useState(
    project.fechaInicioObra || ""
  );
  const [plazoEjecucion, setPlazoEjecucion] = useState(
    project.plazoEjecucion ? parseInt(project.plazoEjecucion) : 0
  );
  const [fechaVencGarantia, setFechaVencGarantia] = useState(
    project.fechaVencGarantia || ""
  );
  const [fechaRecProviso, setFechaRecProviso] = useState(
    project.fechaRecProviso || ""
  );
  const [fechaRecDefinitiva, setFechaRecDefinitiva] = useState(
    project.fechaRecDefinitiva || ""
  );

  // Location
  const [ubicacionLat, setUbicacionLat] = useState(project.ubicacionLat || 0);
  const [ubicacionLng, setUbicacionLng] = useState(project.ubicacionLng || 0);
  const [ubicacionNombre, setUbicacionNombre] = useState(project.ubicacionNombre || "");

  // Title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(project.title);

  // UI state
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  // Computed values
  const fechaEstTermino = useMemo(() => {
    if (!fechaInicioObra || !plazoEjecucion) return null;
    const date = new Date(fechaInicioObra);
    date.setDate(date.getDate() + plazoEjecucion);
    return date.toISOString().split("T")[0];
  }, [fechaInicioObra, plazoEjecucion]);

  const showDCI = useMemo(() => {
    return (
      tipoFinanciamiento === "DCI" || tipoFinanciamiento === "VRIIC"
    );
  }, [tipoFinanciamiento]);

  const canDelete = useMemo(
    () => deleteReason.trim().length >= 10,
    [deleteReason]
  );

  const projectIsFTE = isFTE(project.tipoDesarrollo);
  const projectStatuses = getStatusesForProject(project.tipoDesarrollo);
  const statusObj = getStatusObj(project.status, project.tipoDesarrollo);
  const statusIndex = getStatusIndex(project.status, project.tipoDesarrollo);
  const progress = getProgress(project.status, project.subEtapas, project.tipoDesarrollo);

  // Handlers
  const handleSave = () => {
    const updated: Project = {
      ...project,
      fechaRecepcionMemo: fechaRecepcionMemo || "",
      dueDate: fechaEstEntrega || "",
      description: descripcion,
      fechaLicitacion: fechaLicitacion || "",
      fechaPublicacion: fechaPublicacion || "",
      budget: montoAsignado,
      tipoFinanciamiento,
      tipoLicitacion: tipoLicitacion || "",
      idLicitacion: idLicitacion || "",
      codigoProyectoDCI: codigoProyectoDCI || "",
      fechaVencimientoRecursos: fechaVencimientoRecursos || "",
      jefeProyectoId: jefeProyectoId === -1 ? 0 : jefeProyectoId,
      inspectorId: inspectorId === -1 ? 0 : inspectorId,
      profesionalAsignado: "",
      especialidades,
      subEtapas,
      edpCount,
      retCount,
      ndcCount,
      fechaInicioObra: fechaInicioObra || "",
      plazoEjecucion: plazoEjecucion.toString(),
      fechaVencGarantia: fechaVencGarantia || "",
      fechaRecProviso: fechaRecProviso || "",
      fechaRecDefinitiva: fechaRecDefinitiva || "",
      ubicacionLat,
      ubicacionLng,
      ubicacionNombre,
    };
    onUpdate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTitleSave = () => {
    if (titleDraft.trim()) {
      onUpdate({ ...project, title: titleDraft.trim() });
      setEditingTitle(false);
    }
  };

  const handleToggleEspecialidad = (name: string) => {
    setEspecialidades((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]
    );
  };

  const handleDeleteConfirm = () => {
    onDelete(project.id, deleteReason);
    setShowDeleteConfirm(false);
  };

  const handleStatusCheckbox = (clickedIdx: number) => {
    let newStatusId = project.status;
    if (clickedIdx <= statusIndex) {
      if (clickedIdx === statusIndex && clickedIdx > 0) {
        newStatusId = projectStatuses[clickedIdx - 1].id;
      } else if (clickedIdx < statusIndex) {
        newStatusId = projectStatuses[clickedIdx].id;
      }
    } else {
      newStatusId = projectStatuses[clickedIdx].id;
    }
    if (newStatusId !== project.status) {
      onUpdate({ ...project, status: newStatusId });
    }
  };

  const handleSubEtapaChange = (key: keyof typeof subEtapas) => {
    setSubEtapas((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shadow-sm">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {editingTitle ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleTitleSave(); if (e.key === "Escape") { setEditingTitle(false); setTitleDraft(project.title); } }}
                  className="text-xl font-bold text-gray-900 border-b-2 border-[#F97316] outline-none bg-transparent flex-1 py-0.5"
                  autoFocus
                />
                <button onClick={handleTitleSave} className="p-1.5 hover:bg-green-50 rounded-lg transition text-green-600">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => { setEditingTitle(false); setTitleDraft(project.title); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-gray-900">{project.title}</h1>
                <button onClick={() => setEditingTitle(true)} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600">
                  <Pencil className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Código: {project.codigoProyectoUsa || "—"}
          </p>
        </div>
        {/* Save button in header */}
        <button
          onClick={handleSave}
          className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-all ${
            saved
              ? "bg-green-500 text-white"
              : "bg-[#F97316] hover:bg-[#F97316]/90 text-white"
          }`}
        >
          {saved ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Guardado
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Guardar
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-6 p-6 max-w-7xl mx-auto">
        {/* LEFT COLUMN - Sticky card */}
        <div className="sticky top-20 h-fit">
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 border-l-4 border-l-[#F97316] shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-5 h-5 text-[#F97316]" />
              <h2 className="text-lg font-bold text-gray-900">
                Información del Proyecto
              </h2>
            </div>

            {/* Project info rows */}
            <div className="space-y-3 mb-5 pb-5 border-b border-gray-200">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">
                  Código Proyecto PLADET
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {project.codigoProyectoUsa || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">
                  Unidad Requirente
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {project.requestingUnit}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">
                  Contacto
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {project.contactName}
                </p>
                <p className="text-xs text-gray-500">{project.contactEmail}</p>
              </div>
            </div>

            {/* Status badge and progress */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <Badge
                  color={statusObj.color}
                  bg={statusObj.color + "20"}
                >
                  {statusObj.label}
                </Badge>
                <span className="text-xs font-semibold text-gray-600">
                  {progress}%
                </span>
              </div>
              <ProgressBar value={progress} color={statusObj.color} />
            </div>

            {/* Status flow with checkboxes */}
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-3">
                Flujo de Estado
              </p>
              {projectStatuses.map((status, idx) => {
                const isChecked = idx <= statusIndex;
                const isCurrent = idx === statusIndex;
                const isPast = idx < statusIndex;

                return (
                  <div key={status.id}>
                    {/* Main stage checkbox */}
                    <label
                      className={`flex items-center gap-2.5 text-xs p-2 rounded-lg cursor-pointer transition-colors ${
                        isPast
                          ? "bg-green-50 text-green-700"
                          : isCurrent
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleStatusCheckbox(idx)}
                        className="rounded border-gray-300 text-[#F97316] focus:ring-[#F97316] w-3.5 h-3.5 flex-shrink-0"
                      />
                      <span className="leading-tight">{status.label}</span>
                    </label>

                    {/* Sub-checkboxes for "En Diseño" (not for FTE) */}
                    {!projectIsFTE && status.id === "en_diseno" && (
                      <div className="ml-7 mt-1 mb-1 space-y-1 border-l-2 border-amber-200 pl-3">
                        <label className="flex items-center gap-2 text-xs p-1.5 rounded cursor-pointer hover:bg-amber-50 transition-colors text-gray-700">
                          <input
                            type="checkbox"
                            checked={!!subEtapas.disenoArquitectura}
                            onChange={() => handleSubEtapaChange("disenoArquitectura")}
                            className="rounded border-gray-300 text-amber-500 focus:ring-amber-400 w-3 h-3 flex-shrink-0"
                          />
                          <span>Arquitectura</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs p-1.5 rounded cursor-pointer hover:bg-amber-50 transition-colors text-gray-700">
                          <input
                            type="checkbox"
                            checked={!!subEtapas.disenoEspecialidades}
                            onChange={() => handleSubEtapaChange("disenoEspecialidades")}
                            className="rounded border-gray-300 text-amber-500 focus:ring-amber-400 w-3 h-3 flex-shrink-0"
                          />
                          <span>Especialidades</span>
                        </label>
                      </div>
                    )}

                    {/* Sub-checkboxes for "En Gestión de Compra" (not for FTE) */}
                    {!projectIsFTE && status.id === "gestion_compra" && (
                      <div className="ml-7 mt-1 mb-1 space-y-1 border-l-2 border-orange-200 pl-3">
                        <label className="flex items-center gap-2 text-xs p-1.5 rounded cursor-pointer hover:bg-orange-50 transition-colors text-gray-700">
                          <input
                            type="checkbox"
                            checked={!!subEtapas.compraCDP}
                            onChange={() => handleSubEtapaChange("compraCDP")}
                            className="rounded border-gray-300 text-orange-500 focus:ring-orange-400 w-3 h-3 flex-shrink-0"
                          />
                          <span>CDP solicitado</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs p-1.5 rounded cursor-pointer hover:bg-orange-50 transition-colors text-gray-700">
                          <input
                            type="checkbox"
                            checked={!!subEtapas.compraEnProceso}
                            onChange={() => handleSubEtapaChange("compraEnProceso")}
                            className="rounded border-gray-300 text-orange-500 focus:ring-orange-400 w-3 h-3 flex-shrink-0"
                          />
                          <span>En proceso de compra</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs p-1.5 rounded cursor-pointer hover:bg-orange-50 transition-colors text-gray-700">
                          <input
                            type="checkbox"
                            checked={!!subEtapas.compraEvaluacionAdj}
                            onChange={() => handleSubEtapaChange("compraEvaluacionAdj")}
                            className="rounded border-gray-300 text-orange-500 focus:ring-orange-400 w-3 h-3 flex-shrink-0"
                          />
                          <span>Evaluación/Adjudicación</span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comentarios — left sidebar */}
          <CommentsSection projectId={project.id} userEmail={userEmail} />

          {/* Ubicación */}
          <LocationPicker
            lat={ubicacionLat}
            lng={ubicacionLng}
            nombre={ubicacionNombre}
            onLocationChange={(lat, lng, nombre) => {
              setUbicacionLat(lat);
              setUbicacionLng(lng);
              setUbicacionNombre(nombre);
            }}
          />
        </div>

        {/* RIGHT COLUMN - Multiple cards */}
        <div>
          {/* FTE: Vista simplificada — solo resumen + adjuntar informe */}
          {projectIsFTE ? (
            <>
              {/* Resumen de creación */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-[#F97316]" />
                  <h2 className="text-lg font-bold text-gray-900">
                    Resumen del Requerimiento
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 font-semibold">Memorándum</p>
                    <p className="text-sm font-medium text-gray-900">{project.memorandumNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold">Unidad Requirente</p>
                    <p className="text-sm font-medium text-gray-900">{project.requestingUnit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold">Contacto</p>
                    <p className="text-sm font-medium text-gray-900">{project.contactName}</p>
                    <p className="text-xs text-gray-500">{project.contactEmail}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold">Tipo de Desarrollo</p>
                    <p className="text-sm font-medium text-gray-900">FTE — Factibilidad Técnica</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold">Disciplina Líder</p>
                    <p className="text-sm font-medium text-gray-900">{project.disciplinaLider || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold">Sector</p>
                    <p className="text-sm font-medium text-gray-900">{project.sector || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold">Fecha Creación</p>
                    <p className="text-sm font-medium text-gray-900">{fmtDate(project.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold">Fecha Est. Entrega</p>
                    <p className="text-sm font-medium text-gray-900">{fmtDate(project.dueDate)}</p>
                  </div>
                  {project.jefeProyectoId !== undefined && project.jefeProyectoId >= 0 && PROFESSIONALS[project.jefeProyectoId] && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 font-semibold">Jefe de Proyecto</p>
                      <p className="text-sm font-medium text-gray-900">
                        {PROFESSIONALS[project.jefeProyectoId].name} — {PROFESSIONALS[project.jefeProyectoId].role}
                      </p>
                    </div>
                  )}
                </div>

                {/* Descripción */}
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-xs text-gray-500 font-semibold mb-1">Descripción</p>
                  <p className="text-sm text-gray-700">{project.description || "Sin descripción"}</p>
                </div>
              </div>

              {/* Equipo del Proyecto (FTE) */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-[#F97316]" />
                  <h2 className="text-lg font-bold text-gray-900">
                    Equipo del Proyecto
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Jefe de Proyecto */}
                  <div>
                    <label className="block text-xs text-gray-600 font-semibold mb-1">
                      Jefe de Proyecto
                    </label>
                    <select
                      value={jefeProyectoId === -1 ? "" : jefeProyectoId}
                      onChange={(e) =>
                        setJefeProyectoId(
                          e.target.value ? parseInt(e.target.value) : -1
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                    >
                      <option value="">Seleccionar...</option>
                      {PROFESSIONALS.map((prof, idx) => (
                        <option key={idx} value={idx}>
                          {prof.name} — {prof.role}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Inspector Técnico */}
                  <div>
                    <label className="block text-xs text-gray-600 font-semibold mb-1">
                      Inspector Técnico
                    </label>
                    <select
                      value={inspectorId === -1 ? "" : inspectorId}
                      onChange={(e) =>
                        setInspectorId(
                          e.target.value ? parseInt(e.target.value) : -1
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                    >
                      <option value="">Seleccionar...</option>
                      {INSPECTORS.map((inspector, idx) => (
                        <option key={idx} value={idx}>
                          {inspector}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Especialistas checkboxes */}
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-xs text-gray-600 font-semibold mb-3">
                    Especialistas
                  </p>
                  <div className="space-y-2">
                    {SPECIALISTS.map((specialist) => (
                      <label
                        key={specialist.name}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition"
                      >
                        <input
                          type="checkbox"
                          checked={especialidades.includes(specialist.name)}
                          onChange={() => handleToggleEspecialidad(specialist.name)}
                          className="rounded border-gray-300 text-[#F97316] focus:ring-[#F97316]"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {specialist.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {specialist.discipline}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Informe de Factibilidad */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Upload className="w-5 h-5 text-[#F97316]" />
                  <h2 className="text-lg font-bold text-gray-900">
                    Informe de Factibilidad
                  </h2>
                </div>

                <button className="w-full border-2 border-dashed border-gray-300 hover:border-[#F97316] rounded-lg p-6 text-center transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-[#F97316]">
                  <Upload className="w-6 h-6" />
                  <span className="text-sm font-medium">Adjuntar Informe de Factibilidad</span>
                  <span className="text-xs text-gray-400">PDF, DOC o imagen</span>
                </button>
              </div>

              {/* DELETE button */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full px-4 py-3 rounded-lg border border-red-500 text-red-600 font-bold hover:bg-red-50 transition flex items-center justify-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Eliminar Proyecto
              </button>
            </>
          ) : (
          <>
          {/* 1. Antecedentes Generales */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-[#F97316]" />
              <h2 className="text-lg font-bold text-gray-900">
                Antecedentes Generales
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Fecha Recepción Memorándum */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Fecha Recepción Memorándum
                </label>
                <input
                  type="date"
                  value={fechaRecepcionMemo}
                  onChange={(e) => setFechaRecepcionMemo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                />
              </div>

              {/* Fecha Est. Entrega */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Fecha Est. Entrega
                </label>
                <input
                  type="date"
                  value={fechaEstEntrega}
                  onChange={(e) => setFechaEstEntrega(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                />
              </div>

              {/* Fecha Licitación */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Fecha Licitación
                </label>
                <input
                  type="date"
                  value={fechaLicitacion}
                  onChange={(e) => setFechaLicitacion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                />
              </div>

              {/* Fecha Publicación */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Fecha Publicación
                </label>
                <input
                  type="date"
                  value={fechaPublicacion}
                  onChange={(e) => setFechaPublicacion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                />
              </div>

              {/* Monto Asignado */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Monto Asignado CLP
                </label>
                <div className="flex items-center">
                  <span className="text-sm text-gray-600 mr-2">$</span>
                  <input
                    type="text"
                    value={montoAsignado}
                    onChange={(e) => setMontoAsignado(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Tipo Financiamiento */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Tipo Financiamiento
                </label>
                <select
                  value={tipoFinanciamiento}
                  onChange={(e) => setTipoFinanciamiento(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                >
                  <option value="Capital">Capital</option>
                  <option value="Corriente">Corriente</option>
                  <option value="Corriente USACH">Corriente USACH</option>
                  <option value="DCI">DCI</option>
                  <option value="VRIIC">VRIIC</option>
                </select>
              </div>

              {/* ID Licitación */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  ID Licitación
                </label>
                <input
                  type="text"
                  value={idLicitacion}
                  onChange={(e) => setIdLicitacion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                />
              </div>

              {/* Código Proyecto DCI (conditional) */}
              {showDCI && (
                <div>
                  <label className="block text-xs text-gray-600 font-semibold mb-1">
                    Código Proyecto DCI
                  </label>
                  <input
                    type="text"
                    value={codigoProyectoDCI}
                    onChange={(e) => setCodigoProyectoDCI(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                  />
                </div>
              )}

              {/* Fecha Venc. Recursos (conditional) */}
              {showDCI && (
                <div>
                  <label className="block text-xs text-gray-600 font-semibold mb-1">
                    Fecha Venc. Recursos
                  </label>
                  <input
                    type="date"
                    value={fechaVencimientoRecursos}
                    onChange={(e) => setFechaVencimientoRecursos(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 2. Descripción del Proyecto */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-[#F97316]" />
              <h2 className="text-lg font-bold text-gray-900">
                Descripción del Proyecto
              </h2>
            </div>

            <div>
              <label className="block text-xs text-gray-600 font-semibold mb-1">
                Descripción ({descripcion.length}/200)
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value.slice(0, 200))}
                maxLength={200}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none resize-none h-20"
                placeholder="Ingrese la descripción del proyecto..."
              />
            </div>
          </div>

          {/* 3. Equipo del Proyecto */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-[#F97316]" />
              <h2 className="text-lg font-bold text-gray-900">
                Equipo del Proyecto
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Jefe de Proyecto */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Jefe de Proyecto
                </label>
                <select
                  value={jefeProyectoId === -1 ? "" : jefeProyectoId}
                  onChange={(e) =>
                    setJefeProyectoId(
                      e.target.value ? parseInt(e.target.value) : -1
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                >
                  <option value="">Seleccionar...</option>
                  {PROFESSIONALS.map((prof, idx) => (
                    <option key={idx} value={idx}>
                      {prof.name} — {prof.role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Inspector Técnico */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Inspector Técnico
                </label>
                <select
                  value={inspectorId === -1 ? "" : inspectorId}
                  onChange={(e) =>
                    setInspectorId(
                      e.target.value ? parseInt(e.target.value) : -1
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                >
                  <option value="">Seleccionar...</option>
                  {INSPECTORS.map((inspector, idx) => (
                    <option key={idx} value={idx}>
                      {inspector}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Especialistas checkboxes */}
            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs text-gray-600 font-semibold mb-3">
                Especialistas
              </p>
              <div className="space-y-2">
                {SPECIALISTS.map((specialist) => (
                  <label
                    key={specialist.name}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition"
                  >
                    <input
                      type="checkbox"
                      checked={especialidades.includes(specialist.name)}
                      onChange={() => handleToggleEspecialidad(specialist.name)}
                      className="rounded border-gray-300 text-[#F97316] focus:ring-[#F97316]"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {specialist.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {specialist.discipline}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Documentación de Diseño */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-[#F97316]" />
              <h2 className="text-lg font-bold text-gray-900">
                Documentación de Diseño
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                "Ficha de Proyecto",
                "Planos",
                "EETT",
                "Itemizado",
              ].map((doc) => (
                <button
                  key={doc}
                  className="border-2 border-dashed border-gray-300 hover:border-[#F97316] rounded-lg p-4 text-center transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-[#F97316]"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-sm font-medium">{doc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 5. Antecedentes de Compra */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-[#F97316]" />
              <h2 className="text-lg font-bold text-gray-900">
                Antecedentes de Compra
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                "Formulario compra / BT",
                "CDP",
                "OC / CTTO",
                "Oferta",
                "Acta de visita",
                "Cuadro ADJ / Informe",
              ].map((doc) => (
                <button
                  key={doc}
                  className="border-2 border-dashed border-gray-300 hover:border-[#F97316] rounded-lg p-4 text-center transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-[#F97316]"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-sm font-medium">{doc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 6. Antecedentes de Ejecución */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-[#F97316]" />
              <h2 className="text-lg font-bold text-gray-900">
                Antecedentes de Ejecución
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Fecha Inicio Obra */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Fecha Inicio Obra
                </label>
                <input
                  type="date"
                  value={fechaInicioObra}
                  onChange={(e) => setFechaInicioObra(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                />
              </div>

              {/* Plazo Ejecución */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Plazo Ejecución (días corridos)
                </label>
                <input
                  type="number"
                  value={plazoEjecucion}
                  onChange={(e) => setPlazoEjecucion(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                  placeholder="0"
                />
              </div>

              {/* Fecha Est. Término */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Fecha Est. Término
                </label>
                <input
                  type="text"
                  disabled
                  value={fechaEstTermino ? fmtDate(fechaEstTermino) : "—"}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-gray-50 text-gray-600"
                />
              </div>

              {/* Fecha Venc. Garantía */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Fecha Venc. Garantía
                </label>
                <input
                  type="date"
                  value={fechaVencGarantia}
                  onChange={(e) => setFechaVencGarantia(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                />
              </div>

              {/* Fecha Rec. Provisoria */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Fecha Rec. Provisoria
                </label>
                <input
                  type="date"
                  value={fechaRecProviso}
                  onChange={(e) => setFechaRecProviso(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                />
              </div>

              {/* Fecha Rec. Definitiva */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Fecha Rec. Definitiva
                </label>
                <input
                  type="date"
                  value={fechaRecDefinitiva}
                  onChange={(e) => setFechaRecDefinitiva(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                />
              </div>
            </div>
          </div>

          {/* 7. EDPs */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#F97316]" />
                <h2 className="text-lg font-bold text-gray-900">EDPs</h2>
              </div>
              <span className="text-xs text-gray-600 font-semibold">
                Total: {edpCount}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {Array.from({ length: edpCount }).map((_, idx) => (
                <button
                  key={`edp-${idx}`}
                  className="border-2 border-dashed border-gray-300 hover:border-[#F97316] rounded-lg p-4 text-center transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-[#F97316]"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-sm font-medium">EDP {idx + 1}</span>
                </button>
              ))}
            </div>

            {retCount > 0 && (
              <>
                <div className="border-t border-gray-200 pt-4 mb-4">
                  <p className="text-xs text-gray-600 font-semibold mb-3">
                    Retenciones
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: retCount }).map((_, idx) => (
                      <button
                        key={`ret-${idx}`}
                        className="border-2 border-dashed border-gray-300 hover:border-gray-500 rounded-lg p-4 text-center transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-gray-700"
                      >
                        <Upload className="w-5 h-5" />
                        <span className="text-sm font-medium">
                          Retención {idx + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setEdpCount((prev) => prev + 1)}
                className="flex-1 px-3 py-2 rounded-lg border border-[#F97316] text-[#F97316] text-sm font-semibold hover:bg-[#F97316]/5 transition"
              >
                + Agregar EDP
              </button>
              <button
                onClick={() => setRetCount((prev) => prev + 1)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-500 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition"
              >
                + Agregar Retención
              </button>
            </div>
          </div>

          {/* 8. NDCs */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#F97316]" />
                <h2 className="text-lg font-bold text-gray-900">NDCs</h2>
              </div>
              <span className="text-xs text-gray-600 font-semibold">
                Total: {ndcCount}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {Array.from({ length: ndcCount }).map((_, idx) => (
                <button
                  key={`ndc-${idx}`}
                  className="border-2 border-dashed border-gray-300 hover:border-[#F97316] rounded-lg p-4 text-center transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-[#F97316]"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-sm font-medium">NDC {idx + 1}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setNdcCount((prev) => prev + 1)}
              className="w-full px-3 py-2 rounded-lg border border-[#F97316] text-[#F97316] text-sm font-semibold hover:bg-[#F97316]/5 transition"
            >
              + Agregar NDC
            </button>
          </div>

          {/* 9. Modificación de Contrato (MCD) */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-5 h-5 text-[#F97316]" />
              <h2 className="text-lg font-bold text-gray-900">
                Modificación de Contrato (MCD)
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {["Libro de Obra", "CDP MCD", "Modificación"].map((doc) => (
                <button
                  key={doc}
                  className="border-2 border-dashed border-gray-300 hover:border-[#F97316] rounded-lg p-4 text-center transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-[#F97316]"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-sm font-medium">{doc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* DELETE button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full px-4 py-3 rounded-lg border border-red-500 text-red-600 font-bold hover:bg-red-50 transition flex items-center justify-center gap-2"
          >
            <Trash2 className="w-5 h-5" />
            Eliminar Proyecto
          </button>
          </>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full overflow-hidden">
            {/* Red header */}
            <div className="bg-red-500 px-6 py-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-white flex-shrink-0" />
              <h3 className="text-lg font-bold text-white">
                Eliminar Proyecto
              </h3>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  Proyecto a eliminar:
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {project.title}
                </p>
                <p className="text-xs text-gray-500">
                  Memorándum: {project.memorandumNumber}
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-2">
                  Justificación (mínimo 10 caracteres)
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-red-500 outline-none resize-none h-24"
                  placeholder="Ingrese la razón por la que desea eliminar este proyecto..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteReason("");
                  }}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={!canDelete}
                  className={`flex-1 px-3 py-2 rounded-lg text-white text-sm font-semibold transition ${
                    canDelete
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-gray-300 cursor-not-allowed"
                  }`}
                >
                  Confirmar Eliminación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
