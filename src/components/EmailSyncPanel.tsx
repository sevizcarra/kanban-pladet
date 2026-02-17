"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, FileText, MessageSquare, Plus, Eye } from "lucide-react";

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
        <button
          onClick={handleManualSync}
          disabled={syncing}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            syncing
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-[#F97316] text-white hover:bg-[#F97316]/90"
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar Ahora"}
        </button>
      </div>

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
