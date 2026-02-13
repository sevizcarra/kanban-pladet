"use client";

import { LogOut, Building2 } from "lucide-react";

interface HeaderProps {
  userEmail?: string | null;
  onLogout?: () => void;
}

export default function Header({ userEmail, onLogout }: HeaderProps) {
  return (
    <header className="relative bg-gradient-to-r from-[#1f2937] via-[#374151] to-[#1f2937] text-white overflow-hidden">
      {/* Subtle geometric pattern */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      {/* Accent line top */}
      <div className="h-[3px] bg-gradient-to-r from-transparent via-[#F97316] to-transparent" />

      <div className="relative z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Logo mark */}
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#F97316] to-[#ea580c] flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-[#374151]" />
          </div>

          {/* Title block */}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-wide">
                PLADET
              </h1>
              <div className="hidden sm:block h-4 w-px bg-white/20" />
              <span className="hidden sm:block text-xs text-white/50 font-medium tracking-wider uppercase">
                Sistema de Seguimiento
              </span>
            </div>
            <p className="text-[11px] text-white/40 font-medium">
              Dirección de Planificación y Desarrollo Territorial — USACH
            </p>
          </div>
        </div>

        {userEmail && onLogout && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5 bg-white/[0.07] rounded-full px-4 py-1.5 border border-white/[0.06]">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                {userEmail.charAt(0)}
              </div>
              <span className="text-xs text-white/70 font-medium">{userEmail}</span>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg transition-all duration-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
