"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ArrowRight,
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
  Eye,
  Download,
} from "lucide-react";
import {
  STATUSES,
  PRIORITIES,
  MANAGERS,
  INSPECTORS,
  SPECIALISTS,
  fmt,
  fmtDate,
  getStatusObj,
  getStatusIndex,
  getProgress,
} from "@/lib/constants";
import Badge from "./Badge";
import ProgressBar from "./ProgressBar";
import { Project } from "@/types/project";

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  onUpdate: (p: Project) => void;
  onDelete: (id: string, reason: string) => void;
}

export default function ProjectDetail({
  project,
  onBack,
  onUpdate,
  onDelete,
}: ProjectDetailProps) {
  // Local editable state
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
  const [especialidades, setEspecialidades] = useState(
    project.especialidades || []
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

  // UI state
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [showPDF, setShowPDF] = useState(false);

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

  const statusObj = getStatusObj(project.status);
  const statusIndex = getStatusIndex(project.status);
  const progress = getProgress(project.status);
  const isLastStatus = statusIndex === STATUSES.length - 1;

  // Handlers
  const handleToggleEspecialidad = (name: string) => {
    setEspecialidades((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]
    );
  };

  const handleSave = () => {
    const updated: Project = {
      ...project,
      description: descripcion,
      fechaLicitacion,
      fechaPublicacion,
      budget: montoAsignado,
      tipoFinanciamiento,
      idLicitacion,
      codigoProyectoDCI,
      fechaVencimientoRecursos,
      jefeProyectoId: jefeProyectoId === -1 ? undefined : jefeProyectoId,
      inspectorId: inspectorId === -1 ? undefined : inspectorId,
      especialidades,
      edpCount,
      retCount,
      ndcCount,
      fechaInicioObra,
      plazoEjecucion: plazoEjecucion.toString(),
      fechaVencGarantia,
      fechaRecProviso,
      fechaRecDefinitiva,
    };
    onUpdate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleDeleteConfirm = () => {
    onDelete(project.id, deleteReason);
    setShowDeleteConfirm(false);
  };

  const handleAdvanceStatus = () => {
    if (!isLastStatus) {
      const nextStatus = STATUSES[statusIndex + 1];
      onUpdate({ ...project, status: nextStatus.id });
    }
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
          <h1 className="text-xl font-bold text-gray-900">{project.title}</h1>
          <p className="text-sm text-gray-500">
            Memorándum: {project.memorandumNumber}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-6 p-6 max-w-7xl mx-auto">
        {/* LEFT COLUMN - Sticky card */}
        <div className="sticky top-20 h-fit">
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 border-l-4 border-l-[#00A499] shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-5 h-5 text-[#00A499]" />
              <h2 className="text-lg font-bold text-gray-900">
                Información del Proyecto
              </h2>
            </div>

            {/* Project info rows */}
            <div className="space-y-3 mb-5 pb-5 border-b border-gray-200">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">
                  Memorándum
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {project.memorandumNumber}
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

            {/* Advance status button */}
            {!isLastStatus && (
              <button
                onClick={handleAdvanceStatus}
                className="w-full mb-3 px-3 py-2 rounded-lg bg-[#00A499] hover:bg-[#00A499]/90 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                Avanzar a: {STATUSES[statusIndex + 1].label}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* View summary button */}
            <button
              onClick={() => setShowPDF(true)}
              className="w-full px-3 py-2 rounded-lg border border-[#00A499] text-[#00A499] text-sm font-semibold hover:bg-[#00A499]/5 transition flex items-center justify-center gap-2 mb-5"
            >
              <Eye className="w-4 h-4" />
              Ver Resumen / Imprimir
            </button>

            {/* Status flow mini */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-3">
                Flujo de Estado
              </p>
              {STATUSES.map((status, idx) => (
                <div
                  key={status.id}
                  className={`flex items-center gap-2 text-xs p-2 rounded-lg transition ${
                    idx < statusIndex
                      ? "bg-green-50 text-green-700"
                      : idx === statusIndex
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-gray-400"
                  }`}
                >
                  {idx < statusIndex ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-current" />
                  )}
                  <span>{status.short}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Multiple cards */}
        <div>
          {/* 1. Antecedentes Generales */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-[#00A499]" />
              <h2 className="text-lg font-bold text-gray-900">
                Antecedentes Generales
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Fecha Creación */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Fecha Creación
                </label>
                <input
                  type="text"
                  disabled
                  value={fmtDate(project.createdAt)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-gray-50 text-gray-600"
                />
              </div>

              {/* Fecha Est. Entrega */}
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Fecha Est. Entrega
                </label>
                <input
                  type="text"
                  disabled
                  value={fmtDate(project.dueDate)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-gray-50 text-gray-600"
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none"
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none"
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
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none"
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none"
                >
                  <option value="Capital">Capital</option>
                  <option value="Corriente">Corriente</option>
                  <option value="Corriente USACH">Corriente USACH</option>
                  <option value="DCI">DCI</option>
                  <option value="VRIIC">VRIIC</option>
                </select>
              </div>

              {/* ID Licitación - full width */}
              <div className="col-span-2">
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  ID Licitación
                </label>
                <input
                  type="text"
                  value={idLicitacion}
                  onChange={(e) => setIdLicitacion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none"
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
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none"
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
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 2. Descripción del Proyecto */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-[#00A499]" />
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
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none resize-none h-20"
                placeholder="Ingrese la descripción del proyecto..."
              />
            </div>
          </div>

          {/* 3. Equipo del Proyecto */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-[#00A499]" />
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none"
                >
                  <option value="">Seleccionar...</option>
                  {MANAGERS.map((manager, idx) => (
                    <option key={idx} value={idx}>
                      {manager}
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none"
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
                      className="rounded border-gray-300 text-[#00A499] focus:ring-[#00A499]"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {specialist.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {specialist.discipline} • {specialist.unit}
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
              <Briefcase className="w-5 h-5 text-[#00A499]" />
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
                  className="border-2 border-dashed border-gray-300 hover:border-[#00A499] rounded-lg p-4 text-center transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-[#00A499]"
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
              <Briefcase className="w-5 h-5 text-[#00A499]" />
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
                  className="border-2 border-dashed border-gray-300 hover:border-[#00A499] rounded-lg p-4 text-center transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-[#00A499]"
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
              <Calendar className="w-5 h-5 text-[#00A499]" />
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none"
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none"
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none"
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none"
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none"
                />
              </div>
            </div>
          </div>

          {/* 7. EDPs */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#00A499]" />
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
                  className="border-2 border-dashed border-gray-300 hover:border-[#00A499] rounded-lg p-4 text-center transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-[#00A499]"
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
                        className="border-2 border-dashed border-orange-300 hover:border-orange-500 rounded-lg p-4 text-center transition flex flex-col items-center justify-center gap-2 text-orange-600 hover:text-orange-700"
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
                className="flex-1 px-3 py-2 rounded-lg border border-[#00A499] text-[#00A499] text-sm font-semibold hover:bg-[#00A499]/5 transition"
              >
                + Agregar EDP
              </button>
              <button
                onClick={() => setRetCount((prev) => prev + 1)}
                className="flex-1 px-3 py-2 rounded-lg border border-orange-500 text-orange-600 text-sm font-semibold hover:bg-orange-50 transition"
              >
                + Agregar Retención
              </button>
            </div>
          </div>

          {/* 8. NDCs */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#00A499]" />
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
                  className="border-2 border-dashed border-gray-300 hover:border-[#00A499] rounded-lg p-4 text-center transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-[#00A499]"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-sm font-medium">NDC {idx + 1}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setNdcCount((prev) => prev + 1)}
              className="w-full px-3 py-2 rounded-lg border border-[#00A499] text-[#00A499] text-sm font-semibold hover:bg-[#00A499]/5 transition"
            >
              + Agregar NDC
            </button>
          </div>

          {/* 9. SAVE button */}
          <button
            onClick={handleSave}
            className={`w-full px-4 py-3 rounded-lg text-white font-bold transition flex items-center justify-center gap-2 mb-4 ${
              saved
                ? "bg-green-500 hover:bg-green-600"
                : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            }`}
          >
            {saved ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Cambios guardados
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Guardar Cambios
              </>
            )}
          </button>

          {/* 10. DELETE button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full px-4 py-3 rounded-lg border border-red-500 text-red-600 font-bold hover:bg-red-50 transition flex items-center justify-center gap-2"
          >
            <Trash2 className="w-5 h-5" />
            Eliminar Proyecto
          </button>
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

      {/* PDF Summary modal placeholder */}
      {showPDF && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                Resumen / Impresión
              </h3>
              <button
                onClick={() => setShowPDF(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {project.title}
                </h2>
                <p className="text-sm text-gray-600">
                  Memorándum: {project.memorandumNumber}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-200">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">
                    Estado
                  </p>
                  <Badge
                    color={statusObj.color}
                    bg={statusObj.color + "20"}
                  >
                    {statusObj.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">
                    Progreso
                  </p>
                  <p className="text-sm font-bold text-gray-900">{progress}%</p>
                </div>
              </div>

              <button
                onClick={() => window.print()}
                className="w-full px-4 py-2 rounded-lg bg-[#00A499] hover:bg-[#00A499]/90 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar / Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
