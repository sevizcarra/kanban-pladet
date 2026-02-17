"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, FileText, MessageSquare, Plus, Eye, History } from "lucide-react";

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
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Historical processing state
  const [historicalRunning, setHistoricalRunning] = useState(false);
  const [historicalProgress, setHistoricalProgress] = useState<{
    offset: number;
    total: number;
    created: number;
    commented: number;
    skipped: number;
    error?: string;
  } | null>(null);

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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/email-sync-trigger", { method: "POST" });
      if (res.ok) {
        await fetchLogs();
      }
    } catch (err) {
      console.error("Error triggering sync:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleHistoricalSync = async () => {
    if (!confirm("Esto procesará TODOS los correos del buzón y creará tarjetas para cada memorándum encontrado. ¿Continuar?")) return;

    setHistoricalRunning(true);
    setHistoricalProgress({ offset: 0, total: 0, created: 0, commented: 0, skipped: 0 });

    let offset = 0;
    let totalCreated = 0;
    let totalCommented = 0;
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
        totalCommented += data.commented || 0;
        totalSkipped += data.skipped || 0;

        setHistoricalProgress({
          offset: data.nextOffset || data.total || offset,
          total: data.total || 0,
          created: totalCreated,
          commented: totalCommented,
          skipped: totalSkipped,
        });

        if (data.done) break;

        offset = data.nextOffset;

        // Small delay between batches to avoid rate limits
        await new Promise(r => setTimeout(r, 1000));
      }

      await fetchLogs();
    } catch (err) {
      console.error("Historical sync error:", err);
      setHistoricalProgress(prev => prev ? { ...prev, error: "Error de conexión" } : null);
    } finally {
      setHistoricalRunning(false);
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
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

  // Stats
  const totalActions = logs.reduce((sum, l) => sum + l.actions.filter(a => a.type !== "ignore" && a.type !== "info").length, 0);
  const totalCreated = logs.reduce((sum, l) => sum + l.actions.filter(a => a.type === "create_project" && a.success).length, 0);
  const totalComments = logs.reduce((sum, l) => sum + l.actions.filter(a => a.type === "add_comment" && a.success).length, 0);
  const lastSync = logs[0]?.timestamp;

  return (
    <div className="space-y-4">
      {/* Header + manual sync */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#F97316]" />
            Sincronización de Correo
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            pladet@usach.cl — Lectura automática diaria + sincronización manual
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHistoricalSync}
            disabled={historicalRunning || syncing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              historicalRunning || syncing
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-purple-600 text-white hover:bg-purple-700"
            }`}
          >
            <History className={`w-4 h-4 ${historicalRunning ? "animate-spin" : ""}`} />
            {historicalRunning ? "Procesando..." : "Procesar Histórico"}
          </button>
          <button
            onClick={handleManualSync}
            disabled={syncing || historicalRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              syncing || historicalRunning
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-[#F97316] text-white hover:bg-[#F97316]/90"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar Ahora"}
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
            <span className="text-green-700 font-bold">Creados: {historicalProgress.created}</span>
            <span className="text-blue-700">Comentarios: {historicalProgress.commented}</span>
            <span className="text-gray-600">Ignorados: {historicalProgress.skipped}</span>
          </div>
          {historicalProgress.error && (
            <p className="text-xs text-red-600 font-semibold">{historicalProgress.error}</p>
          )}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-semibold">Última Sincronización</p>
          <p className="text-sm font-bold text-gray-900 mt-1">
            {lastSync ? formatTime(lastSync) : "—"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-semibold">Acciones Realizadas</p>
          <p className="text-xl font-bold text-[#F97316] mt-1">{totalActions}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-semibold">Proyectos Creados</p>
          <p className="text-xl font-bold text-green-600 mt-1">{totalCreated}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-semibold">Comentarios Agregados</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{totalComments}</p>
        </div>
      </div>

      {/* Activity log */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Registro de Actividad</h3>
          <span className="text-xs text-gray-500">Últimas 20 sincronizaciones</span>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">Cargando registros...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <Mail className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No hay registros de sincronización aún</p>
            <p className="text-xs text-gray-400 mt-1">El sistema se sincronizará automáticamente cuando esté configurado</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {logs.map((log) => {
              const isExpanded = expanded === log.id;
              const hasErrors = log.actions.some(a => !a.success);
              const meaningfulActions = log.actions.filter(a => a.type !== "ignore" && a.type !== "info");

              return (
                <div key={log.id} className="hover:bg-gray-50 transition">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : log.id)}
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
                          {getActionIcon(action.type)}
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
  );
}
