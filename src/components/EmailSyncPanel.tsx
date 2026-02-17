"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  MessageSquare,
  Plus,
  Eye,
  History,
  Inbox,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Send,
  Paperclip,
  Search,
  Trash2,
  Filter,
} from "lucide-react";
import { PROJECT_CATEGORIES, PRIORITIES } from "@/lib/constants";

// ── Types ──

interface EmailDraft {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  body: string;
  emailDate: string;
  attachments: { filename: string; contentType: string; size: number }[];
  suggestedAction: string;
  suggestedTitle: string;
  suggestedMemo: string;
  suggestedUnit: string;
  suggestedPriority: "alta" | "media" | "baja";
  suggestedDashboardType: "compras" | "obras";
  suggestedCategory: string;
  suggestedSector: string;
  suggestedProjectRef: string;
  suggestedDetail: string;
  status: "pending" | "approved" | "dismissed";
  approvedProjectId?: string;
  createdAt: string;
  reviewedAt?: string;
}

interface SyncAction {
  type: string;
  detail: string;
  success: boolean;
  error?: string;
}

interface SyncLog {
  id: string;
  timestamp: string;
  emailsRead: number;
  actions: SyncAction[];
  duration: number;
}

export default function EmailSyncPanel() {
  const [activeTab, setActiveTab] = useState<"bandeja" | "historial">("bandeja");

  // Draft state
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [approving, setApproving] = useState<string | null>(null);

  // Filter/search state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterSender, setFilterSender] = useState<string>("all");
  const [dismissingFiltered, setDismissingFiltered] = useState(false);
  const [dismissingAll, setDismissingAll] = useState(false);

  // Sync log state
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Historical processing state
  const [historicalRunning, setHistoricalRunning] = useState(false);
  const [historicalProgress, setHistoricalProgress] = useState<{
    offset: number;
    total: number;
    created: number;
    skipped: number;
    error?: string;
  } | null>(null);

  // ── Fetch drafts ──
  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch("/api/email-drafts");
      if (res.ok) {
        const data = await res.json();
        setDrafts(data);
      }
    } catch (err) {
      console.error("Error fetching drafts:", err);
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  // ── Fetch logs ──
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/email-sync-logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Error fetching sync logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
    fetchLogs();
    const interval = setInterval(() => {
      fetchDrafts();
      fetchLogs();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDrafts, fetchLogs]);

  // ── Sync actions ──
  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/email-sync-trigger", { method: "POST" });
      if (res.ok) {
        await fetchDrafts();
        await fetchLogs();
      }
    } catch (err) {
      console.error("Error triggering sync:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleHistoricalSync = async () => {
    if (!confirm("Esto procesará TODOS los correos del buzón y creará borradores para revisión. ¿Continuar?")) return;

    setHistoricalRunning(true);
    setHistoricalProgress({ offset: 0, total: 0, created: 0, skipped: 0 });

    let offset = 0;
    let totalCreated = 0;
    let totalSkipped = 0;

    try {
      while (true) {
        const res = await fetch("/api/email-sync-historical-trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset }),
        });

        if (!res.ok) {
          const err = await res.json();
          setHistoricalProgress(prev => prev ? { ...prev, error: err.error || "Error desconocido" } : null);
          break;
        }

        const data = await res.json();
        totalCreated += data.created || 0;
        totalSkipped += data.skipped || 0;

        setHistoricalProgress({
          offset: data.nextOffset || data.total || offset,
          total: data.total || 0,
          created: totalCreated,
          skipped: totalSkipped,
        });

        if (data.done) break;
        offset = data.nextOffset;

        await new Promise(r => setTimeout(r, 1000));
      }

      await fetchDrafts();
      await fetchLogs();
    } catch (err) {
      console.error("Historical sync error:", err);
      setHistoricalProgress(prev => prev ? { ...prev, error: "Error de conexión" } : null);
    } finally {
      setHistoricalRunning(false);
    }
  };

  // ── Draft actions ──
  const handleApproveDraft = async (draft: EmailDraft) => {
    setApproving(draft.id);
    try {
      const form = editingDraft === draft.id ? editForm : {};
      const payload = {
        draftId: draft.id,
        title: form.title || draft.suggestedTitle || draft.subject,
        memorandumNumber: form.memorandumNumber || draft.suggestedMemo || "",
        requestingUnit: form.requestingUnit || draft.suggestedUnit || "",
        priority: form.priority || draft.suggestedPriority || "media",
        dashboardType: form.dashboardType || draft.suggestedDashboardType || "compras",
        categoriaProyecto: form.categoriaProyecto || draft.suggestedCategory || "",
        sector: form.sector || draft.suggestedSector || "",
        description: draft.body?.slice(0, 500) || "",
        contactName: draft.fromName || "",
        contactEmail: draft.from || "",
      };

      const res = await fetch("/api/email-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setDrafts(prev => prev.filter(d => d.id !== draft.id));
        setEditingDraft(null);
        setExpandedDraft(null);
      }
    } catch (err) {
      console.error("Error approving draft:", err);
    } finally {
      setApproving(null);
    }
  };

  const handleDismissDraft = async (draftId: string) => {
    try {
      const res = await fetch(`/api/email-drafts?id=${draftId}`, { method: "DELETE" });
      if (res.ok) {
        setDrafts(prev => prev.filter(d => d.id !== draftId));
      }
    } catch (err) {
      console.error("Error dismissing draft:", err);
    }
  };

  const handleDismissFiltered = async () => {
    const ids = filteredDrafts.map(d => d.id);
    if (ids.length === 0) return;
    if (!confirm(`¿Descartar ${ids.length} borradores filtrados?`)) return;

    setDismissingFiltered(true);
    try {
      // Send in chunks of 100 IDs to avoid URL length limits
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        await fetch(`/api/email-drafts?ids=${chunk.join(",")}`, { method: "DELETE" });
      }
      setDrafts(prev => prev.filter(d => !ids.includes(d.id)));
    } catch (err) {
      console.error("Error dismissing filtered:", err);
    } finally {
      setDismissingFiltered(false);
    }
  };

  const handleDismissAll = async () => {
    if (!confirm(`¿Descartar TODOS los ${drafts.length} borradores pendientes? Esta acción no se puede deshacer.`)) return;

    setDismissingAll(true);
    try {
      const res = await fetch("/api/email-drafts?all=true", { method: "DELETE" });
      if (res.ok) {
        setDrafts([]);
      }
    } catch (err) {
      console.error("Error dismissing all:", err);
    } finally {
      setDismissingAll(false);
    }
  };

  const startEditing = (draft: EmailDraft) => {
    setEditingDraft(draft.id);
    setEditForm({
      title: draft.suggestedTitle || draft.subject,
      memorandumNumber: draft.suggestedMemo || "",
      requestingUnit: draft.suggestedUnit || "",
      priority: draft.suggestedPriority || "media",
      dashboardType: draft.suggestedDashboardType || "compras",
      categoriaProyecto: draft.suggestedCategory || "",
      sector: draft.suggestedSector || "",
    });
  };

  // ── Helpers ──
  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Hace un momento";
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "create_project":
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Crear Tarjeta</span>;
      case "add_comment":
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Agregar Comentario</span>;
      case "update_status":
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Cambio Estado</span>;
      case "attach_document":
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">Documento</span>;
      default:
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">Sin Clasificar</span>;
    }
  };

  const getLogActionIcon = (type: string) => {
    switch (type) {
      case "create_draft": return <Plus className="w-3.5 h-3.5 text-green-500" />;
      case "create_project": return <Plus className="w-3.5 h-3.5 text-green-500" />;
      case "add_comment": return <MessageSquare className="w-3.5 h-3.5 text-blue-500" />;
      case "update_status": return <RefreshCw className="w-3.5 h-3.5 text-amber-500" />;
      case "attach_document": return <FileText className="w-3.5 h-3.5 text-purple-500" />;
      case "ignore": return <Eye className="w-3.5 h-3.5 text-gray-400" />;
      case "info": return <CheckCircle className="w-3.5 h-3.5 text-gray-400" />;
      case "error": return <XCircle className="w-3.5 h-3.5 text-red-500" />;
      default: return <Mail className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  // ── Filtered drafts ──
  const uniqueSenders = Array.from(new Set(drafts.map(d => d.fromName || d.from))).sort();

  const filteredDrafts = drafts.filter(d => {
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchSubject = (d.subject || "").toLowerCase().includes(q);
      const matchFrom = (d.from || "").toLowerCase().includes(q);
      const matchFromName = (d.fromName || "").toLowerCase().includes(q);
      if (!matchSubject && !matchFrom && !matchFromName) return false;
    }
    // Action filter
    if (filterAction !== "all" && d.suggestedAction !== filterAction) return false;
    // Sender filter
    if (filterSender !== "all") {
      const senderKey = d.fromName || d.from;
      if (senderKey !== filterSender) return false;
    }
    return true;
  });

  // ── Stats ──
  const pendingCount = drafts.length;
  const lastSync = logs[0]?.timestamp;

  return (
    <div className="space-y-4">
      {/* Header + actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#F97316]" />
            Correo Automático
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            pladet@usach.cl — Los correos se guardan como borradores para revisión
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHistoricalSync}
            disabled={historicalRunning || syncing}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
              historicalRunning || syncing
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-purple-600 text-white hover:bg-purple-700"
            }`}
          >
            <History className={`w-3.5 h-3.5 ${historicalRunning ? "animate-spin" : ""}`} />
            {historicalRunning ? "Procesando..." : "Histórico"}
          </button>
          <button
            onClick={handleManualSync}
            disabled={syncing || historicalRunning}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
              syncing || historicalRunning
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-[#F97316] text-white hover:bg-[#F97316]/90"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </button>
        </div>
      </div>

      {/* Historical processing progress */}
      {historicalProgress && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-purple-900">
              {historicalRunning ? "Procesando correos históricos..." : historicalProgress.error ? "Error en procesamiento" : "Procesamiento completado"}
            </p>
            {!historicalRunning && (
              <button onClick={() => setHistoricalProgress(null)} className="text-xs text-purple-600 hover:underline">
                Cerrar
              </button>
            )}
          </div>
          {historicalProgress.total > 0 && (
            <div className="w-full bg-purple-200 rounded-full h-2.5">
              <div
                className="bg-purple-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (historicalProgress.offset / historicalProgress.total) * 100)}%` }}
              />
            </div>
          )}
          <div className="flex gap-4 text-xs text-purple-800">
            <span>Procesados: {historicalProgress.offset} / {historicalProgress.total}</span>
            <span className="text-green-700 font-bold">Borradores: {historicalProgress.created}</span>
            <span className="text-gray-600">Ignorados: {historicalProgress.skipped}</span>
          </div>
          {historicalProgress.error && (
            <p className="text-xs text-red-600 font-semibold">{historicalProgress.error}</p>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("bandeja")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === "bandeja"
              ? "border-[#F97316] text-[#F97316]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Inbox className="w-4 h-4" />
          Bandeja
          {pendingCount > 0 && (
            <span className="bg-[#F97316] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("historial")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === "historial"
              ? "border-[#F97316] text-[#F97316]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <History className="w-4 h-4" />
          Historial
        </button>
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* BANDEJA TAB */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === "bandeja" && (
        <div className="space-y-3">
          {loadingDrafts ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Cargando borradores...</p>
            </div>
          ) : drafts.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No hay borradores pendientes</p>
              <p className="text-xs text-gray-400 mt-1">Sincroniza correos para ver borradores aquí</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Search + Filters */}
              <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
                {/* Search bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por asunto o remitente..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                    </button>
                  )}
                </div>

                {/* Filter row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-gray-400" />

                  {/* Action filter chips */}
                  {[
                    { key: "all", label: "Todos" },
                    { key: "create_project", label: "Crear Tarjeta" },
                    { key: "add_comment", label: "Comentario" },
                    { key: "update_status", label: "Estado" },
                    { key: "ignore", label: "Sin Clasificar" },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setFilterAction(f.key)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                        filterAction === f.key
                          ? "bg-[#F97316] text-white border-[#F97316]"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}

                  {/* Sender dropdown */}
                  <select
                    value={filterSender}
                    onChange={(e) => setFilterSender(e.target.value)}
                    className="text-[11px] font-semibold px-2 py-1 rounded-full border border-gray-200 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#F97316]/40 max-w-[200px]"
                  >
                    <option value="all">Todos los remitentes</option>
                    {uniqueSenders.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Counter + Mass actions */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Mostrando <span className="font-bold text-gray-700">{filteredDrafts.length}</span> de{" "}
                    <span className="font-bold text-gray-700">{drafts.length}</span> borradores
                  </p>
                  <div className="flex items-center gap-2">
                    {filteredDrafts.length > 0 && filteredDrafts.length < drafts.length && (
                      <button
                        onClick={handleDismissFiltered}
                        disabled={dismissingFiltered}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                          dismissingFiltered
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                        {dismissingFiltered ? "Descartando..." : `Descartar ${filteredDrafts.length} filtrados`}
                      </button>
                    )}
                    <button
                      onClick={handleDismissAll}
                      disabled={dismissingAll}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                        dismissingAll
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                          : "bg-red-600 text-white hover:bg-red-700"
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                      {dismissingAll ? "Descartando..." : "Descartar Todos"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Draft list */}
              <div className="space-y-2">
              {filteredDrafts.map((draft) => {
                const isExpanded = expandedDraft === draft.id;
                const isEditing = editingDraft === draft.id;
                const isApproving = approving === draft.id;

                return (
                  <div key={draft.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Draft header row */}
                    <div className="px-4 py-3 flex items-center gap-3">
                      {/* Icon */}
                      <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-[#F97316]" />
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900 truncate max-w-[300px]">
                            {draft.subject || "(sin asunto)"}
                          </span>
                          {getActionBadge(draft.suggestedAction)}
                          {draft.suggestedDashboardType === "obras" ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Obras</span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">Compras</span>
                          )}
                          {draft.attachments?.length > 0 && (
                            <Paperclip className="w-3 h-3 text-gray-400" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          De: <span className="font-medium">{draft.fromName || draft.from}</span> · {formatTime(draft.emailDate)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => {
                            setExpandedDraft(isExpanded ? null : draft.id);
                            if (!isExpanded) startEditing(draft);
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                          title="Ver detalle"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                        </button>
                        <button
                          onClick={() => handleDismissDraft(draft.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition"
                          title="Descartar"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </button>
                        <button
                          onClick={() => {
                            if (!isExpanded) {
                              setExpandedDraft(draft.id);
                              startEditing(draft);
                            } else {
                              handleApproveDraft(draft);
                            }
                          }}
                          disabled={isApproving}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            isApproving
                              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                              : "bg-green-600 text-white hover:bg-green-700"
                          }`}
                          title="Aprobar y crear tarjeta"
                        >
                          {isApproving ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          {isExpanded ? "Crear Tarjeta" : "Aprobar"}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail + edit form */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50">
                        {/* Email body preview */}
                        <div className="bg-white rounded-lg border border-gray-200 p-3">
                          <p className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Contenido del correo</p>
                          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
                            {draft.body?.slice(0, 1000) || "(sin contenido)"}
                          </p>
                          {draft.attachments?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {draft.attachments.map((att, i) => (
                                <span key={i} className="flex items-center gap-1 text-[10px] bg-gray-100 rounded px-2 py-1 text-gray-600">
                                  <Paperclip className="w-3 h-3" />
                                  {att.filename}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Editable fields */}
                        {isEditing && (
                          <div className="space-y-3">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Datos de la tarjeta (editables)</p>
                            <div className="grid grid-cols-2 gap-3">
                              {/* Title */}
                              <div className="col-span-2">
                                <label className="text-xs font-semibold text-gray-600 block mb-1">Título</label>
                                <input
                                  type="text"
                                  value={editForm.title || ""}
                                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
                                />
                              </div>

                              {/* Memo number */}
                              <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">N° Memorándum</label>
                                <input
                                  type="text"
                                  value={editForm.memorandumNumber || ""}
                                  onChange={(e) => setEditForm({ ...editForm, memorandumNumber: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
                                  placeholder="MEM-2026-001"
                                />
                              </div>

                              {/* Requesting unit */}
                              <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">Unidad Solicitante</label>
                                <input
                                  type="text"
                                  value={editForm.requestingUnit || ""}
                                  onChange={(e) => setEditForm({ ...editForm, requestingUnit: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
                                />
                              </div>

                              {/* Dashboard type */}
                              <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">Dashboard</label>
                                <select
                                  value={editForm.dashboardType || "compras"}
                                  onChange={(e) => setEditForm({ ...editForm, dashboardType: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 bg-white"
                                >
                                  <option value="compras">Compras</option>
                                  <option value="obras">Obras</option>
                                </select>
                              </div>

                              {/* Priority */}
                              <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">Prioridad</label>
                                <select
                                  value={editForm.priority || "media"}
                                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 bg-white"
                                >
                                  {Object.entries(PRIORITIES).map(([key, val]) => (
                                    <option key={key} value={key}>{val.label}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Category */}
                              <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">Categoría</label>
                                <select
                                  value={editForm.categoriaProyecto || ""}
                                  onChange={(e) => setEditForm({ ...editForm, categoriaProyecto: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 bg-white"
                                >
                                  <option value="">Sin categoría</option>
                                  {PROJECT_CATEGORIES.map((cat) => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Sector */}
                              <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">Sector</label>
                                <input
                                  type="text"
                                  value={editForm.sector || ""}
                                  onChange={(e) => setEditForm({ ...editForm, sector: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* HISTORIAL TAB */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === "historial" && (
        <div className="space-y-3">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-semibold">Última Sincronización</p>
              <p className="text-sm font-bold text-gray-900 mt-1">
                {lastSync ? formatTime(lastSync) : "—"}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-semibold">Borradores Pendientes</p>
              <p className="text-xl font-bold text-[#F97316] mt-1">{pendingCount}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-semibold">Sincronizaciones</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{logs.length}</p>
            </div>
          </div>

          {/* Activity log */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Registro de Actividad</h3>
              <span className="text-xs text-gray-500">Últimas 20 sincronizaciones</span>
            </div>

            {loadingLogs ? (
              <div className="p-8 text-center">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Cargando registros...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center">
                <Mail className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No hay registros de sincronización aún</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {logs.map((log) => {
                  const isExpanded = expandedLog === log.id;
                  const hasErrors = log.actions.some(a => !a.success);
                  const meaningfulActions = log.actions.filter(a => a.type !== "ignore" && a.type !== "info");

                  return (
                    <div key={log.id} className="hover:bg-gray-50 transition">
                      <button
                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                        className="w-full px-5 py-3 flex items-center gap-3 text-left"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          hasErrors ? "bg-red-100" : log.emailsRead === 0 ? "bg-gray-100" : "bg-green-100"
                        }`}>
                          {hasErrors ? (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          ) : log.emailsRead === 0 ? (
                            <Clock className="w-4 h-4 text-gray-400" />
                          ) : (
                            <Mail className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {log.emailsRead === 0 ? "Sin correos nuevos" : `${log.emailsRead} correo${log.emailsRead > 1 ? "s" : ""} procesado${log.emailsRead > 1 ? "s" : ""}`}
                            </span>
                            {meaningfulActions.length > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F97316]/10 text-[#F97316]">
                                {meaningfulActions.length} {meaningfulActions.length === 1 ? "acción" : "acciones"}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{formatTime(log.timestamp)} · {log.duration}ms</p>
                        </div>
                        <span className="text-xs text-gray-400">{isExpanded ? "▲" : "▼"}</span>
                      </button>

                      {isExpanded && (
                        <div className="px-5 pb-3 pl-16 space-y-1.5">
                          {log.actions.map((action, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs">
                              {getLogActionIcon(action.type)}
                              <span className={`flex-1 ${action.success ? "text-gray-700" : "text-red-600"}`}>
                                {action.detail}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
