"use client";

import { useState, useEffect } from "react";
import { Mail, X, Send, Loader2, CheckCircle2, AlertCircle, Pencil } from "lucide-react";

interface EmailConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (editedName: string, editedEmail: string, editedName2?: string, editedEmail2?: string) => Promise<void>;
  onSkip: () => void;
  contactName: string;
  contactEmail: string;
  contactoDirectoName?: string;
  contactoDirectoEmail?: string;
  projectName: string;
  projectCode: string;
  type: "creation" | "status_change";
  previousStatus?: string;
  newStatus?: string;
}

export default function EmailConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  onSkip,
  contactName,
  contactEmail,
  contactoDirectoName,
  contactoDirectoEmail,
  projectName,
  projectCode,
  type,
  previousStatus,
  newStatus,
}: EmailConfirmDialogProps) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  // Jefe Unidad Mayor
  const [editName, setEditName] = useState(contactName);
  const [editEmail, setEditEmail] = useState(contactEmail);
  const [editing, setEditing] = useState(false);
  // Contacto Directo
  const [editName2, setEditName2] = useState(contactoDirectoName || "");
  const [editEmail2, setEditEmail2] = useState(contactoDirectoEmail || "");
  const [editing2, setEditing2] = useState(false);

  // Sync with props when dialog opens
  useEffect(() => {
    if (isOpen) {
      setEditName(contactName);
      setEditEmail(contactEmail);
      setEditName2(contactoDirectoName || "");
      setEditEmail2(contactoDirectoEmail || "");
      setEditing(false);
      setEditing2(false);
      setResult(null);
      setSending(false);
    }
  }, [isOpen, contactName, contactEmail, contactoDirectoName, contactoDirectoEmail]);

  if (!isOpen) return null;

  const hasValidEmail1 = editEmail && editEmail !== "—" && editEmail.includes("@");
  const hasValidEmail2 = editEmail2 && editEmail2 !== "—" && editEmail2.includes("@");
  const hasAnyValidEmail = hasValidEmail1 || hasValidEmail2;

  const handleSend = async () => {
    if (!hasAnyValidEmail) return;
    setSending(true);
    setResult(null);
    try {
      await onConfirm(editName, editEmail, editName2, editEmail2);
      setResult("success");
      setTimeout(() => {
        setResult(null);
        onClose();
      }, 1500);
    } catch {
      setResult("error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1f2937] to-[#374151] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#F97316] to-[#ea580c] flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Notificación por correo</h3>
              <p className="text-white/60 text-xs">
                {type === "creation" ? "Proyecto creado" : "Cambio de etapa"}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setResult(null); onClose(); }}
            className="text-white/40 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600 mb-4">
            {type === "creation"
              ? "¿Deseas notificar a los contactos sobre la creación del proyecto?"
              : "¿Deseas notificar a los contactos sobre el cambio de etapa?"}
          </p>

          {/* Project info */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white px-2 py-0.5 rounded">
                {projectCode}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-800">{projectName}</p>

            {type === "status_change" && previousStatus && newStatus && (
              <div className="flex items-center gap-2 mt-2 text-xs">
                <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded-md">{previousStatus}</span>
                <span className="text-[#F97316] font-bold">→</span>
                <span className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white px-2 py-1 rounded-md">{newStatus}</span>
              </div>
            )}
          </div>

          {/* Recipient 1 — Jefe Unidad Mayor */}
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 mb-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-blue-400 font-medium">JEFE UNIDAD MAYOR</p>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Editar
                </button>
              )}
            </div>
            {editing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nombre (ej: Decano)"
                  className="w-full text-sm border border-blue-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 bg-white"
                />
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="correo@ejemplo.cl"
                  className="w-full text-sm border border-blue-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 bg-white"
                />
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-800">{editName || "—"}</p>
                <p className="text-xs text-gray-500">{editEmail || "—"}</p>
              </>
            )}
          </div>

          {/* Recipient 2 — Contacto Directo */}
          <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-orange-400 font-medium">CONTACTO DIRECTO</p>
              {!editing2 && (
                <button
                  onClick={() => setEditing2(true)}
                  className="flex items-center gap-1 text-[10px] text-orange-500 hover:text-orange-700 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Editar
                </button>
              )}
            </div>
            {editing2 ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editName2}
                  onChange={(e) => setEditName2(e.target.value)}
                  placeholder="Nombre (ej: Jefe de Departamento)"
                  className="w-full text-sm border border-orange-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 bg-white"
                />
                <input
                  type="email"
                  value={editEmail2}
                  onChange={(e) => setEditEmail2(e.target.value)}
                  placeholder="correo@ejemplo.cl"
                  className="w-full text-sm border border-orange-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 bg-white"
                />
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-800">{editName2 || "Sin asignar"}</p>
                <p className="text-xs text-gray-500">{editEmail2 || "—"}</p>
              </>
            )}
          </div>

          {!hasAnyValidEmail && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Ingresa al menos un correo válido para poder enviar la notificación.
                </p>
              </div>
            </div>
          )}

          {/* Result message */}
          {result === "success" && (
            <div className="mt-4 flex items-center gap-2 text-green-600 bg-green-50 rounded-lg p-3">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">Correo(s) enviado(s) correctamente</span>
            </div>
          )}
          {result === "error" && (
            <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Error al enviar el correo</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={() => { setResult(null); onSkip(); }}
            disabled={sending}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            No enviar
          </button>
          {!result && (
            <button
              onClick={handleSend}
              disabled={sending || !hasAnyValidEmail}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#F97316] to-[#ea580c] rounded-lg hover:from-[#ea580c] hover:to-[#c2410c] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar correo
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
