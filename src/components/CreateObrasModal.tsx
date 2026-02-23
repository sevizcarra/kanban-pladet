"use client";

import { useState } from "react";
import { X, Hammer } from "lucide-react";
import {
  REQUESTING_UNITS,
  SECTORS,
  PROJECT_CATEGORIES,
  CUADRILLAS,
  BIDDING_TYPES,
} from "@/lib/constants";
import { Project } from "@/types/project";

interface CreateObrasModalProps {
  onClose: () => void;
  onCreate: (project: Omit<Project, "id">) => void;
}

export default function CreateObrasModal({
  onClose,
  onCreate,
}: CreateObrasModalProps) {
  const currentYear = new Date().getFullYear().toString();

  const [form, setForm] = useState({
    memorandum: "",
    year: currentYear,
    nombre: "",
    prioridad: "media" as "alta" | "media" | "baja",
    unidadRequirente: "",
    categoriaProyecto: "",
    sector: "",
    cuadrillas: [] as string[],
    descripcion: "",
    // New fields
    nombreContacto: "",
    emailContacto: "",
    fechaEntrega: "",
    tipoLicitacion: "",
    budget: "",
    recinto: "",
  });

  const canSubmit = form.nombre.trim().length > 0;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleCuadrilla = (value: string) => {
    setForm((prev) => ({
      ...prev,
      cuadrillas: prev.cuadrillas.includes(value)
        ? prev.cuadrillas.filter((c) => c !== value)
        : [...prev.cuadrillas, value],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    const newProject: Omit<Project, "id"> = {
      title: form.nombre,
      description: form.descripcion,
      status: "recepcion_requerimiento",
      priority: form.prioridad,
      memorandumNumber: `MEM-${form.year}-${form.memorandum || "000"}`,
      requestingUnit: form.unidadRequirente,
      contactName: form.nombreContacto || "",
      contactEmail: form.emailContacto || "",
      budget: form.budget || "0",
      dueDate: form.fechaEntrega || null,
      tipoLicitacion: form.tipoLicitacion || "",
      recinto: form.recinto || "",
      tipoFinanciamiento: null,
      codigoProyectoUsa: "",
      tipoDesarrollo: "",
      disciplinaLider: "",
      sector: form.sector,
      categoriaProyecto: form.categoriaProyecto,
      dashboardType: "obras",
      cuadrillas: form.cuadrillas,
      createdAt: new Date().toISOString(),
      commentCount: 0,
    };

    onCreate(newProject);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#22c55e] to-[#16a34a] rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Hammer className="w-6 h-6 text-white" />
            <h2 className="text-lg font-bold text-white">Nuevo Proyecto Obras</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Memorándum + Año */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                N° Memorándum
              </label>
              <input
                type="text"
                name="memorandum"
                value={form.memorandum}
                onChange={handleInputChange}
                placeholder="001"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-green-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Año
              </label>
              <input
                type="text"
                name="year"
                value={form.year}
                onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-green-400 outline-none"
              />
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Nombre del Proyecto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleInputChange}
              placeholder="Ej: Reparación baños Edificio A"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-green-400 outline-none"
            />
          </div>

          {/* Prioridad */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Prioridad
            </label>
            <div className="flex gap-2">
              {(["alta", "media", "baja"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, prioridad: p }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${
                    form.prioridad === p
                      ? p === "alta"
                        ? "bg-red-50 border-red-300 text-red-600"
                        : p === "media"
                        ? "bg-gray-100 border-gray-400 text-gray-700"
                        : "bg-green-50 border-green-300 text-green-600"
                      : "border-gray-200 text-gray-400 hover:border-gray-300"
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Unidad + Sector */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Unidad Requirente
              </label>
              <select
                name="unidadRequirente"
                value={form.unidadRequirente}
                onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-green-400 outline-none"
              >
                <option value="">Seleccionar...</option>
                {REQUESTING_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Sector
              </label>
              <select
                name="sector"
                value={form.sector}
                onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-green-400 outline-none"
              >
                <option value="">Seleccionar...</option>
                {SECTORS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Categoría
            </label>
            <select
              name="categoriaProyecto"
              value={form.categoriaProyecto}
              onChange={handleInputChange}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-green-400 outline-none"
            >
              <option value="">Seleccionar...</option>
              {PROJECT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Presupuesto, Licitación, Fecha */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Monto Asignado
              </label>
              <input
                type="text"
                name="budget"
                value={form.budget}
                onChange={handleInputChange}
                placeholder="$0"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-green-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Tipo Licitación
              </label>
              <select
                name="tipoLicitacion"
                value={form.tipoLicitacion}
                onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-green-400 outline-none"
              >
                <option value="">Seleccionar...</option>
                {BIDDING_TYPES.map((bt) => (
                  <option key={bt.value} value={bt.value}>{bt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Fecha Entrega
              </label>
              <input
                type="date"
                name="fechaEntrega"
                value={form.fechaEntrega}
                onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-green-400 outline-none"
              />
            </div>
          </div>

          {/* Recinto / Ubicación */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Recinto / Ubicación
            </label>
            <input
              type="text"
              name="recinto"
              value={form.recinto}
              onChange={handleInputChange}
              placeholder="Ej: Edificio FING, Campus principal"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-green-400 outline-none"
            />
          </div>

          {/* Contacto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Contacto (nombre)
              </label>
              <input
                type="text"
                name="nombreContacto"
                value={form.nombreContacto}
                onChange={handleInputChange}
                placeholder="Nombre completo"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-green-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Contacto (email)
              </label>
              <input
                type="email"
                name="emailContacto"
                value={form.emailContacto}
                onChange={handleInputChange}
                placeholder="correo@ejemplo.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-green-400 outline-none"
              />
            </div>
          </div>

          {/* Cuadrillas */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Cuadrilla(s)
            </label>
            <div className="flex gap-3">
              {CUADRILLAS.map((c) => {
                const selected = form.cuadrillas.includes(c.value);
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleCuadrilla(c.value)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border-2 transition ${
                      selected
                        ? "border-current shadow-sm"
                        : "border-gray-200 text-gray-400 hover:border-gray-300"
                    }`}
                    style={selected ? { color: c.color, backgroundColor: c.color + "10", borderColor: c.color } : undefined}
                  >
                    <span>{c.icon}</span>
                    <span>{c.label.replace("Cuadrilla ", "")}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleInputChange}
              rows={3}
              placeholder="Descripción breve del proyecto..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-green-400 outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition ${
                canSubmit
                  ? "bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:shadow-lg hover:shadow-green-500/25"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              Crear Proyecto Obras
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
