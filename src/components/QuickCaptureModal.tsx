"use client";

import { useMemo, useState } from "react";
import { Project } from "@/types/project";
import { REQUESTING_UNITS, PRIORITIES } from "@/lib/constants";
import { findSimilarProjects, SimilarMatch } from "@/lib/similarity";
import { Zap, X, AlertTriangle } from "lucide-react";

/**
 * Captura rápida de memos — pensada para el flujo de recepción (Rodrimar).
 * 5 campos, 30 segundos: la tarjeta cae a "Recepción Requerimiento" sin
 * profesional asignado, y queda visible en la bandeja de "Carga del Equipo"
 * para que se asigne o programe su semana.
 */

interface QuickCaptureModalProps {
  existingProjects: Project[];
  onCreate: (project: Omit<Project, "id">) => Promise<void> | void;
  onClose: () => void;
}

export default function QuickCaptureModal({
  existingProjects,
  onCreate,
  onClose,
}: QuickCaptureModalProps) {
  const currentYear = String(new Date().getFullYear());
  const today = new Date().toISOString().slice(0, 10);

  const [memoNum, setMemoNum] = useState("");
  const [year, setYear] = useState(currentYear);
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState("");
  const [priority, setPriority] = useState<"alta" | "media" | "baja">("media");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [fechaRecepcion, setFechaRecepcion] = useState(today);
  const [submitting, setSubmitting] = useState(false);
  const [similar, setSimilar] = useState<SimilarMatch[] | null>(null);

  const canSubmit = title.trim().length > 2 && !submitting;

  const buildProject = (): Omit<Project, "id"> => ({
    title: title.trim(),
    description: "",
    status: "recepcion_requerimiento",
    priority,
    memorandumNumber: memoNum.trim()
      ? `MEM-${year}-${memoNum.trim()}`
      : "",
    requestingUnit: unit || "—",
    contactName: contactName.trim() || "—",
    contactEmail: contactEmail.trim() || "—",
    budget: "0",
    dueDate: null,
    tipoFinanciamiento: null,
    codigoProyectoUsa: "",
    tipoDesarrollo: "",
    disciplinaLider: "",
    sector: "",
    fechaRecepcionMemo: fechaRecepcion,
    createdAt: new Date().toISOString(),
  });

  const doCreate = async (project: Omit<Project, "id">) => {
    setSubmitting(true);
    try {
      await onCreate(project);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const project = buildProject();
    const matches = findSimilarProjects(project.title, existingProjects);
    if (matches.length > 0 && !similar) {
      setSimilar(matches);
      return;
    }
    await doCreate(project);
  };

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100";

  const priorityOptions = useMemo(
    () => Object.entries(PRIORITIES) as [
      "alta" | "media" | "baja",
      { label: string; color: string; bg: string }
    ][],
    []
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-violet-500 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={18} />
            <div>
              <h2 className="text-base font-semibold leading-tight">
                Captura rápida de memo
              </h2>
              <p className="text-[11px] text-violet-100">
                Solo lo esencial — el resto se completa al asignar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/15 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Memo + año + fecha recepción */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                N° Memo
              </label>
              <input
                autoFocus
                value={memoNum}
                onChange={(e) => setMemoNum(e.target.value)}
                placeholder="3899"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Año
              </label>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Recepción
              </label>
              <input
                type="date"
                value={fechaRecepcion}
                onChange={(e) => setFechaRecepcion(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Materia */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Materia / asunto *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Reparación de techumbre Edificio A"
              className={inputCls}
            />
          </div>

          {/* Unidad + prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Unidad requirente
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={inputCls}
              >
                <option value="">Seleccionar…</option>
                {REQUESTING_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Prioridad
              </label>
              <div className="flex gap-1.5">
                {priorityOptions.map(([key, info]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPriority(key)}
                    className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-all ${
                      priority === key
                        ? "border-transparent shadow-sm"
                        : "border-gray-200 text-gray-400 bg-white hover:border-gray-300"
                    }`}
                    style={
                      priority === key
                        ? { color: info.color, backgroundColor: info.bg }
                        : undefined
                    }
                  >
                    {info.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Contacto (opcional) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Contacto (opcional)
              </label>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nombre"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Email contacto
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="correo@usach.cl"
                className={inputCls}
              />
            </div>
          </div>

          {/* Aviso de similares (posible duplicado o memo secundario) */}
          {similar && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5 mb-1.5">
                <AlertTriangle size={13} />
                Ojo: hay {similar.length} proyecto(s) parecido(s) — ¿memo
                secundario o duplicado?
              </p>
              <ul className="space-y-0.5 mb-1">
                {similar.slice(0, 3).map((m) => (
                  <li
                    key={m.project.id}
                    className="text-[11px] text-amber-800 truncate"
                  >
                    • {m.project.title}{" "}
                    {m.project.memorandumNumber && (
                      <span className="text-amber-500">
                        ({m.project.memorandumNumber})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-600">
                Si corresponde a uno de estos, cancela y vincúlalo desde la
                ficha. Si no, confirma abajo.
              </p>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-violet-500 rounded-lg shadow-md shadow-violet-500/20 hover:shadow-lg disabled:opacity-40 disabled:shadow-none transition-all"
            >
              {submitting
                ? "Creando…"
                : similar
                ? "Crear igual"
                : "Crear tarjeta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
