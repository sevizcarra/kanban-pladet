"use client";

import { useState } from "react";
import { Mail, X, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface EmailConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onSkip: () => void;
  contactName: string;
  contactEmail: string;
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
  projectName,
  projectCode,
  type,
  previousStatus,
  newStatus,
}: EmailConfirmDialogProps) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);

  if (!isOpen) return null;

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      await onConfirm();
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

  const hasValidEmail = contactEmail && contactEmail !== "—" && contactEmail.includes("@");

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
          {!hasValidEmail ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Sin correo de contacto</p>
                  <p className="text-xs text-amber-600 mt-1">
                    Este proyecto no tiene un correo de contacto registrado. No se puede enviar la notificación.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                {type === "creation"
                  ? "¿Deseas notificar al contacto sobre la creación del proyecto?"
                  : "¿Deseas notificar al contacto sobre el cambio de etapa?"}
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

              {/* Recipient */}
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-blue-400 font-medium mb-1">DESTINATARIO</p>
                <p className="text-sm font-semibold text-gray-800">{contactName}</p>
                <p className="text-xs text-gray-500">{contactEmail}</p>
              </div>
            </>
          )}

          {/* Result message */}
          {result === "success" && (
            <div className="mt-4 flex items-center gap-2 text-green-600 bg-green-50 rounded-lg p-3">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">Correo enviado correctamente</span>
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
          {hasValidEmail && !result && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#F97316] to-[#ea580c] rounded-lg hover:from-[#ea580c] hover:to-[#c2410c] transition-all disabled:opacity-50 shadow-sm"
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
