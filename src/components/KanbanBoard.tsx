"use client";
import { useState, useMemo, useCallback } from "react";
import { STATUSES, PRIORITIES, PROFESSIONALS, CUADRILLAS, getProgress, daysLeft, getAntecedentesIncompletos } from "@/lib/constants";
import type { Project } from "@/types/project";
import Badge from "./Badge";
import ProgressBar from "./ProgressBar";
import { User, MessageCircle, AlertTriangle, AlertCircle, Siren, Snowflake, GripVertical, Copy } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";

interface Props {
  projects: Project[];
  statuses?: typeof STATUSES;
  onProjectClick: (p: Project) => void;
  onToggleFlag?: (p: Project) => void;
  onToggleFreeze?: (p: Project) => void;
  onDuplicate?: (p: Project) => void;
  onReorder?: (statusId: string, orderedIds: string[]) => void;
}

const getInitials = (name: string) =>
  name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

/* ── Sortable Card wrapper ── */
function SortableCard({ p, statusColor, onProjectClick, onToggleFlag, onToggleFreeze, onDuplicate }: {
  p: Project;
  statusColor: string;
  onProjectClick: (p: Project) => void;
  onToggleFlag?: (p: Project) => void;
  onToggleFreeze?: (p: Project) => void;
  onDuplicate?: (p: Project) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <CardContent
        p={p}
        statusColor={statusColor}
        onProjectClick={onProjectClick}
        onToggleFlag={onToggleFlag}
        onToggleFreeze={onToggleFreeze}
        onDuplicate={onDuplicate}
        dragListeners={listeners}
      />
    </div>
  );
}

/* ── Card content (shared between sortable and overlay) ── */
function CardContent({ p, statusColor, onProjectClick, onToggleFlag, onToggleFreeze, onDuplicate, dragListeners, isOverlay }: {
  p: Project;
  statusColor: string;
  onProjectClick: (p: Project) => void;
  onToggleFlag?: (p: Project) => void;
  onToggleFreeze?: (p: Project) => void;
  onDuplicate?: (p: Project) => void;
  dragListeners?: Record<string, unknown>;
  isOverlay?: boolean;
}) {
  const prio = PRIORITIES[p.priority];
  const dl = p.status !== "terminada" ? daysLeft(p.dueDate) : null;
  const isOverdue = dl !== null && dl < 0;
  const isDueSoon = dl !== null && dl >= 0 && dl <= 7;
  const antecedentes = getAntecedentesIncompletos(p);
  const isFlagged = !!p.flagged;
  const isFrozen = !!p.frozen;

  return (
    <div
      className={`rounded-xl cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 group relative ${
        isOverlay ? "shadow-xl rotate-1 scale-105" : ""
      } ${
        isFrozen
          ? "frozen-card border-2 border-blue-400 text-white"
          : isFlagged
            ? "flagged-blink border-2 border-red-700 text-white"
            : isOverdue
              ? "bg-white border-2 border-red-300"
              : isDueSoon
                ? "bg-white border-2 border-amber-300"
                : "bg-white border border-gray-100 hover:border-gray-200"
      }`}
    >
      {/* Frozen snowflake indicator */}
      {isFrozen && (
        <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
        </div>
      )}

      {/* Flagged pulse animation */}
      {isFlagged && !isFrozen && (
        <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
        </div>
      )}

      {/* Punto rojo: Antecedentes incompletos */}
      {antecedentes.incompleto && (
        <div className="absolute -top-1.5 -right-1.5 group/dot z-10">
          <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
            <span className="text-white text-[8px] font-bold">{antecedentes.faltantes.length}</span>
          </div>
          <div className="absolute right-0 top-5 hidden group-hover/dot:block z-50 w-48 bg-gray-900 text-white text-[10px] rounded-lg p-2 shadow-lg">
            <p className="font-semibold mb-1">Antecedentes incompletos:</p>
            {antecedentes.faltantes.map(f => <p key={f} className="text-gray-300">• {f}</p>)}
          </div>
        </div>
      )}

      {/* Drag handle + content area */}
      <div className="flex">
        {/* Drag handle */}
        <div
          {...dragListeners}
          className={`flex-shrink-0 flex items-center justify-center w-6 cursor-grab active:cursor-grabbing rounded-l-xl transition-colors ${
            isFrozen || isFlagged ? 'text-white/50 hover:text-white/80' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'
          }`}
          title="Arrastrar para reordenar"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Card body */}
        <div className="flex-1 p-3.5 pl-1" onClick={() => onProjectClick(p)}>
          {/* Top color accent bar */}
          <div className="h-1 rounded-full mb-3 -mx-1" style={{ background: `linear-gradient(to right, ${isFrozen || isFlagged ? '#ffffff' : isOverdue ? '#ef4444' : statusColor}, ${isFrozen || isFlagged ? '#ffffff80' : isOverdue ? '#ef444480' : statusColor + '80'})` }} />

          <div className="flex items-start justify-between gap-1 mb-2">
            <p className={`text-xs font-bold leading-snug transition-colors flex-1 ${isFrozen || isFlagged ? 'text-white' : 'text-gray-900 group-hover:text-[#F97316]'}`}>{p.title}</p>
            {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
            {isDueSoon && !isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
          </div>

          <div className="flex justify-between items-center mb-1">
            <Badge color={prio.color} bg={prio.bg}>{prio.label}</Badge>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isFrozen || isFlagged ? 'text-white bg-white/20' : 'text-gray-500 bg-gray-50'}`}>{p.requestingUnit}</span>
          </div>

          {/* Cuadrilla badges (obras projects) */}
          {p.cuadrillas && p.cuadrillas.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {p.cuadrillas.map(c => {
                const cuad = CUADRILLAS.find(q => q.value === c);
                return cuad ? (
                  <span key={c} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: cuad.color + '20', color: isFrozen || isFlagged ? 'white' : cuad.color }}>
                    {cuad.icon} {cuad.label.replace('Cuadrilla ', '')}
                  </span>
                ) : null;
              })}
            </div>
          )}

          <div className={`flex items-center justify-between mt-2.5 pt-2 border-t ${isFrozen || isFlagged ? 'border-white/30' : 'border-gray-100'}`}>
            {p.jefeProyectoId !== undefined && p.jefeProyectoId >= 0 && PROFESSIONALS[p.jefeProyectoId] ? (
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 text-white"
                  style={{ backgroundColor: statusColor }}
                >
                  {getInitials(PROFESSIONALS[p.jefeProyectoId].name)}
                </div>
                <span className={`text-[10px] truncate ${isFrozen || isFlagged ? 'text-white/90' : 'text-gray-600'}`}>{PROFESSIONALS[p.jefeProyectoId].name}</span>
              </div>
            ) : <div />}
            {(p.commentCount || 0) > 0 && (
              <div className="flex items-center gap-0.5 text-gray-400 flex-shrink-0">
                <MessageCircle className="w-3 h-3" />
                <span className="text-[10px] font-medium">{p.commentCount}</span>
              </div>
            )}
          </div>

          {/* Action buttons row — below jefe de proyecto */}
          <div className={`flex items-center gap-1 mt-2 pt-1.5 border-t ${isFrozen || isFlagged ? 'border-white/20' : 'border-gray-100'}`}>
            {/* Duplicate */}
            {onDuplicate && (
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicate(p); }}
                title="Duplicar proyecto"
                className={`p-1.5 rounded-lg transition-all duration-200 ${
                  isFrozen || isFlagged
                    ? 'text-white/60 hover:bg-white/20 hover:text-white'
                    : 'text-gray-300 hover:bg-gray-100 hover:text-gray-600'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Freeze toggle */}
            {onToggleFreeze && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFreeze(p); }}
                title={isFrozen ? "Descongelar proyecto" : "Congelar proyecto"}
                className={`p-1.5 rounded-lg transition-all duration-200 ${
                  isFrozen
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'text-gray-300 hover:bg-blue-50 hover:text-blue-500'
                }`}
              >
                <Snowflake className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Flag toggle */}
            {onToggleFlag && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFlag(p); }}
                title={isFlagged ? "Quitar alerta" : "Marcar con alerta"}
                className={`p-1.5 rounded-lg transition-all duration-200 ${
                  isFlagged
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : isFrozen
                      ? 'text-white/60 hover:bg-white/20 hover:text-white'
                      : 'text-gray-300 hover:bg-gray-100 hover:text-red-500'
                }`}
              >
                <Siren className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main KanbanBoard ── */
export default function KanbanBoard({ projects, statuses: statusesProp, onProjectClick, onToggleFlag, onToggleFreeze, onDuplicate, onReorder }: Props) {
  const activeStatuses = statusesProp || STATUSES;
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Sort projects within each column by sortOrder (fallback to createdAt)
  const sortedByColumn = useMemo(() => {
    const map: Record<string, Project[]> = {};
    for (const s of activeStatuses) {
      const colProjects = projects
        .filter((p) => p.status === s.id)
        .sort((a, b) => {
          const orderA = a.sortOrder ?? Infinity;
          const orderB = b.sortOrder ?? Infinity;
          if (orderA !== orderB) return orderA - orderB;
          // Fallback: newest first
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        });
      map[s.id] = colProjects;
    }
    return map;
  }, [projects, activeStatuses]);

  const activeProject = activeId ? projects.find(p => p.id === activeId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Find which column this card belongs to
    const activeProject = projects.find(p => p.id === active.id);
    if (!activeProject) return;

    const statusId = activeProject.status;
    const colProjects = sortedByColumn[statusId];
    if (!colProjects) return;

    const oldIndex = colProjects.findIndex(p => p.id === active.id);
    const newIndex = colProjects.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Only reorder within same column
    const overProject = projects.find(p => p.id === over.id);
    if (!overProject || overProject.status !== statusId) return;

    const reordered = arrayMove(colProjects, oldIndex, newIndex);
    const orderedIds = reordered.map(p => p.id);

    if (onReorder) {
      onReorder(statusId, orderedIds);
    }
  }, [projects, sortedByColumn, onReorder]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis]}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
        {activeStatuses.map((s) => {
          const cols = sortedByColumn[s.id] || [];
          return (
            <div key={s.id} className="min-w-[240px] max-w-[280px] flex-shrink-0">
              {/* Column header */}
              <div className="flex items-center gap-2 mb-3 py-2 px-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 0 2px white, 0 0 0 3.5px ${s.color}40` }} />
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{s.label}</span>
                <span
                  className="text-[10px] font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center"
                  style={{ backgroundColor: s.color + '15', color: s.color }}
                >
                  {cols.length}
                </span>
              </div>

              {/* Column body */}
              <SortableContext items={cols.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2.5 min-h-[100px] p-2 bg-white/40 backdrop-blur-sm rounded-xl border border-gray-200/50">
                  {cols.map((p) => (
                    <SortableCard
                      key={p.id}
                      p={p}
                      statusColor={s.color}
                      onProjectClick={onProjectClick}
                      onToggleFlag={onToggleFlag}
                      onToggleFreeze={onToggleFreeze}
                      onDuplicate={onDuplicate}
                    />
                  ))}
                  {cols.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                        <span className="text-xs">0</span>
                      </div>
                      <p className="text-xs">Sin proyectos</p>
                    </div>
                  )}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeProject ? (
          <CardContent
            p={activeProject}
            statusColor={activeStatuses.find(s => s.id === activeProject.status)?.color || "#999"}
            onProjectClick={() => {}}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
