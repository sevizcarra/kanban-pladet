"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Lightbulb,
  Trash2,
  ChevronDown,
  ChevronUp,
  Rocket,
  Edit3,
  Save,
  X,
  StickyNote,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  subscribeBacklog,
  createBacklogItem,
  updateBacklogItem,
  deleteBacklogItem,
} from "@/lib/firestore";
import { BacklogItem } from "@/types/backlog";
import { Project } from "@/types/project";
import {
  WORK_TYPES,
  LEADING_DISCIPLINE,
  REQUESTING_UNITS,
  SECTORS,
  PRIORITIES,
  BIDDING_TYPES,
} from "@/lib/constants";

interface Props {
  userEmail: string;
  onPromoteToProject: (data: Omit<Project, "id">) => void;
}

const FINANCING_TYPES = ["Capital", "Corriente", "Corriente USACH", "DCI", "VRIIC"];

export default function BacklogView({ userEmail, onPromoteToProject }: Props) {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [editingValues, setEditingValues] = useState<Record<string, Partial<BacklogItem>>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);
  const saveTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const titleInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Subscribe to backlog items
  useEffect(() => {
    const unsubscribe = subscribeBacklog(setItems);
    return unsubscribe;
  }, []);

  // Debounced auto-save
  const debouncedSave = useCallback(
    (id: string, data: Partial<BacklogItem>) => {
      // Clear existing timer
      if (saveTimersRef.current[id]) {
        clearTimeout(saveTimersRef.current[id]);
      }

      // Set new timer
      saveTimersRef.current[id] = setTimeout(() => {
        updateBacklogItem(id, data);
        delete saveTimersRef.current[id];
      }, 500);
    },
    []
  );

  const handleFieldChange = (
    id: string,
    field: keyof BacklogItem,
    value: unknown
  ) => {
    setEditingValues((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));

    debouncedSave(id, {
      [field]: value,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCreateNewItem = async () => {
    try {
      const newItem: Omit<BacklogItem, "id"> = {
        title: "Nueva idea",
        description: "",
        notes: "",
        memorandum: "",
        year: new Date().getFullYear().toString(),
        tipoDesarrollo: "",
        disciplinaLider: "",
        requestingUnit: "",
        sector: "",
        tipoLicitacion: "",
        priority: "",
        contactName: "",
        contactEmail: "",
        dueDate: null,
        budget: "",
        tipoFinanciamiento: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userEmail,
      };

      const id = await createBacklogItem(newItem);
      setExpandedId(id);

      // Focus on title input after expansion
      setTimeout(() => {
        titleInputRefs.current[id]?.focus();
        titleInputRefs.current[id]?.select();
      }, 0);
    } catch (error) {
      console.error("Error creating backlog item:", error);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      setDeleting(id);
      await deleteBacklogItem(id);
      setExpandedId(null);
    } catch (error) {
      console.error("Error deleting backlog item:", error);
      setDeleting(null);
    }
  };

  const calculateCompleteness = (item: BacklogItem) => {
    const fieldsToCheck = [
      item.title,
      item.memorandum,
      item.year,
      item.tipoDesarrollo,
      item.disciplinaLider,
      item.requestingUnit,
      item.sector,
      item.tipoLicitacion,
      item.priority,
      item.contactName,
      item.contactEmail,
      item.dueDate,
      item.budget && item.budget !== "0" ? item.budget : null,
      item.tipoFinanciamiento,
      item.notes,
    ];

    const filled = fieldsToCheck.filter((f) => f && f !== "").length;
    return { filled, total: fieldsToCheck.length };
  };

  const getMissingFieldsForPromotion = (item: BacklogItem): string[] => {
    const missing = [];
    if (!item.title || item.title.trim() === "") missing.push("Título");
    if (!item.priority) missing.push("Prioridad");
    return missing;
  };

  const canPromoteItem = (item: BacklogItem): boolean => {
    return item.title.trim() !== "" && item.priority !== "";
  };

  const handlePromoteItem = async (item: BacklogItem) => {
    const missing = getMissingFieldsForPromotion(item);
    if (missing.length > 0) return;

    try {
      setPromoting(item.id);

      // Generate PLADET code same as CreateProjectModal
      const generatedCode = [
        item.memorandum || "0",
        item.year || new Date().getFullYear().toString(),
        item.tipoDesarrollo,
        item.disciplinaLider,
        item.requestingUnit,
        item.sector ? "S" + item.sector : "",
        item.tipoLicitacion,
      ]
        .filter(Boolean)
        .join("-");

      const projectData: Omit<Project, "id"> = {
        title: item.title,
        description: item.description,
        status: "recepcion_requerimiento",
        priority: item.priority as "alta" | "media" | "baja" || "media",
        memorandumNumber: `MEM-${item.year || new Date().getFullYear()}-${item.memorandum || "000"}`,
        requestingUnit: item.requestingUnit || "—",
        contactName: item.contactName || "—",
        contactEmail: item.contactEmail || "—",
        budget: item.budget || "0",
        dueDate: item.dueDate || null,
        tipoFinanciamiento: item.tipoFinanciamiento || null,
        codigoProyectoUsa: generatedCode,
        tipoDesarrollo: item.tipoDesarrollo || "",
        disciplinaLider: item.disciplinaLider || "",
        sector: item.sector || "",
        tipoLicitacion: item.tipoLicitacion || "",
      };

      onPromoteToProject(projectData);

      // Delete the backlog item after promotion
      await deleteBacklogItem(item.id);

      setExpandedId(null);
      setSuccessMessage("Idea promovida a proyecto exitosamente");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error promoting item:", error);
    } finally {
      setPromoting(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    if (priority === "alta") return "border-l-4 border-red-500";
    if (priority === "media") return "border-l-4 border-gray-400";
    if (priority === "baja") return "border-l-4 border-green-500";
    return "border-l-4 border-gray-300";
  };

  const item = items.find((i) => i.id === expandedId);
  const editingData = expandedId ? editingValues[expandedId] || {} : {};

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      {/* Success Message */}
      {successMessage && (
        <div className="fixed top-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2 z-50 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="text-green-800 text-sm">{successMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-[#F97316] to-orange-500 rounded-lg">
              <Lightbulb className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">BACKLOG DE IDEAS</h1>
              <p className="text-sm text-gray-500">
                {items.length} idea{items.length !== 1 ? "s" : ""} registrada{items.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={handleCreateNewItem}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#F97316] to-orange-500 text-white rounded-lg hover:shadow-lg transition-shadow font-medium"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Nueva Idea</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-orange-50 rounded-full mb-4">
            <Lightbulb className="w-12 h-12 text-[#F97316]" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No tienes ideas en el backlog
          </h3>
          <p className="text-gray-600 text-sm mb-6 max-w-md">
            Haz clic en "+ Nueva Idea" para comenzar a registrar proyectos
          </p>
          <button
            onClick={handleCreateNewItem}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#F97316] to-orange-500 text-white rounded-lg hover:shadow-lg transition-shadow font-medium"
          >
            <Plus className="w-5 h-5" />
            Nueva Idea
          </button>
        </div>
      ) : (
        /* Grid of Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((currentItem) => {
            const isExpanded = expandedId === currentItem.id;
            const completeness = calculateCompleteness(currentItem);
            const isDeleting = deleting === currentItem.id;
            const isPromoting = promoting === currentItem.id;
            const missingFields = getMissingFieldsForPromotion(currentItem);
            const canPromote = canPromoteItem(currentItem);

            return (
              <div
                key={currentItem.id}
                className={`${getPriorityColor(
                  editingData.priority || currentItem.priority
                )} bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden`}
              >
                {/* Collapsed View */}
                {!isExpanded ? (
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-gray-900 text-sm flex-1 line-clamp-2">
                        {editingData.title || currentItem.title}
                      </h3>
                      <button
                        onClick={() => setExpandedId(currentItem.id)}
                        className="ml-2 p-1 hover:bg-gray-100 rounded transition"
                      >
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>

                    {/* Notes preview */}
                    {(editingData.notes || currentItem.notes) && (
                      <p className="text-xs text-gray-500 mb-3 line-clamp-1">
                        {editingData.notes || currentItem.notes}
                      </p>
                    )}

                    {/* Priority badge */}
                    {(editingData.priority || currentItem.priority) && (
                      <div className="flex gap-2 items-center mb-3">
                        <span
                          className="text-xs px-2 py-1 rounded font-medium"
                          style={{
                            backgroundColor:
                              PRIORITIES[editingData.priority || currentItem.priority]?.bg,
                            color:
                              PRIORITIES[editingData.priority || currentItem.priority]?.color,
                          }}
                        >
                          {PRIORITIES[editingData.priority || currentItem.priority]?.label}
                        </span>
                      </div>
                    )}

                    {/* Completeness indicator */}
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span>Completitud</span>
                      <div className="flex items-center gap-1">
                        <div className="relative w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-semibold text-gray-700">
                          {completeness.filled}/{completeness.total}
                        </div>
                      </div>
                    </div>

                    {/* Created date */}
                    <p className="text-xs text-gray-400">
                      {new Date(currentItem.createdAt).toLocaleDateString("es-CL")}
                    </p>
                  </div>
                ) : (
                  /* Expanded View */
                  <div className="p-4">
                    {/* Header with title and close button */}
                    <div className="flex items-start justify-between mb-4 pb-4 border-b">
                      <input
                        ref={(el) => {
                          if (el) titleInputRefs.current[currentItem.id] = el;
                        }}
                        type="text"
                        value={editingData.title || currentItem.title}
                        onChange={(e) =>
                          handleFieldChange(currentItem.id, "title", e.target.value)
                        }
                        className="text-lg font-bold text-gray-900 flex-1 bg-gray-50 px-2 py-1 rounded border border-gray-300 focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                        placeholder="Título de la idea"
                      />
                      <button
                        onClick={() => setExpandedId(null)}
                        className="ml-2 p-1 hover:bg-gray-100 rounded transition"
                      >
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>

                    {/* Identificación Section */}
                    <div className="mb-4 pb-4 border-b">
                      <label className="text-xs font-semibold text-gray-700 block mb-3">
                        Identificación
                      </label>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="text"
                          value={editingData.memorandum !== undefined ? editingData.memorandum : currentItem.memorandum || ""}
                          onChange={(e) =>
                            handleFieldChange(currentItem.id, "memorandum", e.target.value)
                          }
                          placeholder="Nº Memorándum"
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                        />
                        <input
                          type="text"
                          value={editingData.year !== undefined ? editingData.year : currentItem.year || ""}
                          onChange={(e) =>
                            handleFieldChange(currentItem.id, "year", e.target.value)
                          }
                          placeholder="Año"
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                        />
                      </div>
                      {/* Code preview */}
                      <div className="bg-gray-100 px-3 py-2 rounded text-xs text-gray-500">
                        <span className="font-medium">Código: </span>
                        {[
                          (editingData.memorandum !== undefined ? editingData.memorandum : currentItem.memorandum) || "0",
                          (editingData.year !== undefined ? editingData.year : currentItem.year) || "0000",
                          editingData.tipoDesarrollo || currentItem.tipoDesarrollo,
                          editingData.disciplinaLider || currentItem.disciplinaLider,
                          editingData.requestingUnit || currentItem.requestingUnit,
                          (editingData.sector || currentItem.sector) ? "S" + (editingData.sector || currentItem.sector) : "",
                          editingData.tipoLicitacion || currentItem.tipoLicitacion,
                        ].filter(Boolean).join("-") || "—"}
                      </div>
                    </div>

                    {/* Notas Section */}
                    <div className="mb-4 pb-4 border-b">
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-2">
                        <StickyNote className="w-4 h-4" />
                        Notas
                      </label>
                      <textarea
                        value={editingData.notes || currentItem.notes}
                        onChange={(e) =>
                          handleFieldChange(currentItem.id, "notes", e.target.value)
                        }
                        placeholder="Notas y contexto de la idea"
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                        rows={3}
                      />
                    </div>

                    {/* Clasificación Section */}
                    <div className="mb-4 pb-4 border-b">
                      <label className="text-xs font-semibold text-gray-700 block mb-3">
                        Clasificación
                      </label>
                      <div className="space-y-2">
                        <select
                          value={editingData.tipoDesarrollo || currentItem.tipoDesarrollo}
                          onChange={(e) =>
                            handleFieldChange(currentItem.id, "tipoDesarrollo", e.target.value)
                          }
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                        >
                          <option value="">Tipo de Desarrollo</option>
                          {WORK_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={editingData.disciplinaLider || currentItem.disciplinaLider}
                          onChange={(e) =>
                            handleFieldChange(currentItem.id, "disciplinaLider", e.target.value)
                          }
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                        >
                          <option value="">Disciplina Líder</option>
                          {LEADING_DISCIPLINE.map((d) => (
                            <option key={d.value} value={d.value}>
                              {d.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={editingData.requestingUnit || currentItem.requestingUnit}
                          onChange={(e) =>
                            handleFieldChange(currentItem.id, "requestingUnit", e.target.value)
                          }
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                        >
                          <option value="">Unidad Requiriente</option>
                          {REQUESTING_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>

                        <select
                          value={editingData.sector || currentItem.sector}
                          onChange={(e) =>
                            handleFieldChange(currentItem.id, "sector", e.target.value)
                          }
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                        >
                          <option value="">Sector</option>
                          {SECTORS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={editingData.tipoLicitacion || currentItem.tipoLicitacion || ""}
                          onChange={(e) =>
                            handleFieldChange(currentItem.id, "tipoLicitacion", e.target.value)
                          }
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                        >
                          <option value="">Tipo de Licitación</option>
                          {BIDDING_TYPES.map((bt) => (
                            <option key={bt.value} value={bt.value}>
                              {bt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Detalles Section */}
                    <div className="mb-4 pb-4 border-b">
                      <label className="text-xs font-semibold text-gray-700 block mb-3">
                        Detalles
                      </label>
                      <div className="space-y-2">
                        <select
                          value={editingData.priority || currentItem.priority}
                          onChange={(e) =>
                            handleFieldChange(currentItem.id, "priority", e.target.value)
                          }
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                        >
                          <option value="">Prioridad</option>
                          <option value="alta">Alta</option>
                          <option value="media">Media</option>
                          <option value="baja">Baja</option>
                        </select>

                        <input
                          type="date"
                          value={editingData.dueDate || currentItem.dueDate || ""}
                          onChange={(e) =>
                            handleFieldChange(currentItem.id, "dueDate", e.target.value || null)
                          }
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                        />

                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">$</span>
                          <input
                            type="number"
                            value={editingData.budget !== undefined ? editingData.budget : currentItem.budget}
                            onChange={(e) =>
                              handleFieldChange(currentItem.id, "budget", e.target.value)
                            }
                            placeholder="Presupuesto"
                            className="w-full pl-6 pr-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                          />
                        </div>

                        <select
                          value={editingData.tipoFinanciamiento || currentItem.tipoFinanciamiento || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              currentItem.id,
                              "tipoFinanciamiento",
                              e.target.value || null
                            )
                          }
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                        >
                          <option value="">Tipo de Financiamiento</option>
                          {FINANCING_TYPES.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Contacto Section */}
                    <div className="mb-4 pb-4 border-b">
                      <label className="text-xs font-semibold text-gray-700 block mb-3">
                        Contacto
                      </label>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingData.contactName || currentItem.contactName}
                          onChange={(e) =>
                            handleFieldChange(currentItem.id, "contactName", e.target.value)
                          }
                          placeholder="Nombre de contacto"
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                        />
                        <input
                          type="email"
                          value={editingData.contactEmail || currentItem.contactEmail}
                          onChange={(e) =>
                            handleFieldChange(currentItem.id, "contactEmail", e.target.value)
                          }
                          placeholder="Email de contacto"
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                        />
                      </div>
                    </div>

                    {/* Description (hidden field for mapping to project) */}
                    <input
                      type="hidden"
                      value={editingData.description || currentItem.description}
                      onChange={(e) =>
                        handleFieldChange(currentItem.id, "description", e.target.value)
                      }
                    />

                    {/* Actions */}
                    <div className="flex gap-2">
                      {/* Promote Button */}
                      <button
                        onClick={() => handlePromoteItem(currentItem)}
                        disabled={!canPromote || isPromoting}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded font-medium text-sm transition-all ${
                          canPromote
                            ? "bg-gradient-to-r from-[#F97316] to-orange-500 text-white hover:shadow-md"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                        title={
                          !canPromote
                            ? `Campos faltantes: ${missingFields.join(", ")}`
                            : "Promover a proyecto"
                        }
                      >
                        <Rocket className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          {isPromoting ? "Promoviendo..." : "Promover"}
                        </span>
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteItem(currentItem.id)}
                        disabled={isDeleting}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition font-medium text-sm disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
