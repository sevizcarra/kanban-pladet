"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import {
  WORK_TYPES,
  LEADING_DISCIPLINE,
  REQUESTING_UNITS,
  SECTORS,
  BIDDING_TYPES,
  PROJECT_CATEGORIES,
} from "@/lib/constants";
import { Project } from "@/types/project";

interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (project: Omit<Project, "id">) => void;
}

export default function CreateProjectModal({
  onClose,
  onCreate,
}: CreateProjectModalProps) {
  const currentYear = new Date().getFullYear().toString();

  const [form, setForm] = useState({
    memorandum: "",
    year: currentYear,
    tipoDesarrollo: "",
    disciplinaLider: "",
    unidadRequirente: "",
    sector: "",
    tipoLicitacion: "",
    categoriaProyecto: "",
    nombre: "",
    prioridad: "media" as "alta" | "media" | "baja",
    fechaEntrega: "",
    nombreContacto: "",
    emailContacto: "",
  });

  const generatedCode = useMemo(() => {
    const yearShort = form.year ? form.year.slice(-2) : "00";
    return [
      form.memorandum || "0",
      yearShort,
      form.tipoLicitacion,
      form.tipoDesarrollo,
      form.disciplinaLider,
    ]
      .filter(Boolean)
      .join("-");
  }, [
    form.memorandum,
    form.year,
    form.tipoLicitacion,
    form.tipoDesarrollo,
    form.disciplinaLider,
  ]);

  const canSubmit = form.nombre.trim().length > 0;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    const newProject: Omit<Project, "id"> = {
      title: form.nombre,
      description: "",
      status: "recepcion_requerimiento",
      priority: form.prioridad,
      memorandumNumber: `MEM-${form.year}-${form.memorandum || "000"}`,
      requestingUnit: form.unidadRequirente || "—",
      contactName: form.nombreContacto || "—",
      contactEmail: form.emailContacto || "—",
      budget: "0",
      dueDate: form.fechaEntrega || null,
      tipoFinanciamiento: null,
      codigoProyectoUsa: generatedCode,
      tipoDesarrollo: form.tipoDesarrollo,
      disciplinaLider: form.disciplinaLider,
      sector: form.sector,
      categoriaProyecto: form.categoriaProyecto,
      tipoLicitacion: form.tipoLicitacion,
    };

    onCreate(newProject);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="bg-[#F97316] text-white px-6 py-4 flex items-center justify-between rounded-t-lg sticky top-0">
          <h2 className="text-xl font-semibold">Nuevo Proyecto</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-[#008B83] p-1 rounded transition"
            aria-label="Cerrar"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Section 1: Identificación */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Identificación
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Memorandum
                  </label>
                  <input
                    type="text"
                    name="memorandum"
                    value={form.memorandum}
                    onChange={handleInputChange}
                    placeholder="Ej: 1234"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Año
                  </label>
                  <input
                    type="text"
                    name="year"
                    value={form.year}
                    onChange={handleInputChange}
                    placeholder="Año"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
              </div>

              {/* Generated Code Display */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Código Proyecto PLADET
                </label>
                <input
                  type="text"
                  value={generatedCode}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Clasificación */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Clasificación
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tipo de Desarrollo
                </label>
                <select
                  name="tipoDesarrollo"
                  value={form.tipoDesarrollo}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                >
                  <option value="">Seleccionar...</option>
                  {WORK_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Disciplina Líder
                </label>
                <select
                  name="disciplinaLider"
                  value={form.disciplinaLider}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                >
                  <option value="">Seleccionar...</option>
                  {LEADING_DISCIPLINE.map((discipline) => (
                    <option key={discipline.value} value={discipline.value}>
                      {discipline.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Unidad Requirente
                </label>
                <select
                  name="unidadRequirente"
                  value={form.unidadRequirente}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                >
                  <option value="">Seleccionar...</option>
                  {REQUESTING_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Sector
                </label>
                <select
                  name="sector"
                  value={form.sector}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                >
                  <option value="">Seleccionar...</option>
                  {SECTORS.map((sector) => (
                    <option key={sector.value} value={sector.value}>
                      {sector.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Categoría del Proyecto
                </label>
                <select
                  name="categoriaProyecto"
                  value={form.categoriaProyecto}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                >
                  <option value="">Seleccionar...</option>
                  {PROJECT_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tipo de Licitación
                </label>
                <select
                  name="tipoLicitacion"
                  value={form.tipoLicitacion}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                >
                  <option value="">Seleccionar...</option>
                  {BIDDING_TYPES.map((bt) => (
                    <option key={bt.value} value={bt.value}>
                      {bt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Detalles */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Detalles
            </h3>
            <div className="space-y-4">
              {/* Nombre (Full Width) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nombre del Proyecto *
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleInputChange}
                  placeholder="Nombre del proyecto"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>

              {/* Prioridad & Fecha Entrega */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Prioridad
                  </label>
                  <select
                    name="prioridad"
                    value={form.prioridad}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                  >
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Fecha de Entrega
                  </label>
                  <input
                    type="date"
                    name="fechaEntrega"
                    value={form.fechaEntrega}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nombre de Contacto
                </label>
                <input
                  type="text"
                  name="nombreContacto"
                  value={form.nombreContacto}
                  onChange={handleInputChange}
                  placeholder="Nombre completo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email de Contacto
                </label>
                <input
                  type="email"
                  name="emailContacto"
                  value={form.emailContacto}
                  onChange={handleInputChange}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition ${
                canSubmit
                  ? "bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              Crear Proyecto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
