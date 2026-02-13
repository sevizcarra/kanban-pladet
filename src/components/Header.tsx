"use client";

import { LogOut, Building2 } from "lucide-react";

interface HeaderProps {
  userEmail?: string | null;
  onLogout?: () => void;
}

export default function Header({ userEmail, onLogout }: HeaderProps) {
  return (
    <header className="relative bg-gradient-to-r from-[#374151] via-[#4B5563] to-[#374151] text-white px-6 py-4 flex items-center justify-between overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-[-30px] left-[-20px] w-[100px] h-[100px] rounded-full bg-white/5" />
      <div className="absolute bottom-[-40px] left-[200px] w-[80px] h-[80px] rounded-full bg-white/5" />
      <div className="absolute top-[-20px] right-[30%] w-[60px] h-[60px] rounded-full bg-white/5" />
      <div className="absolute bottom-[-25px] right-[15%] w-[90px] h-[90px] rounded-full bg-white/5" />

      <div className="flex items-center gap-3 relative z-10">
        <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-wide">
            Dirección de Planificación y Desarrollo Territorial
          </h1>
          <p className="text-xs text-white/70">
            USACH — Sistema de Seguimiento de Proyectos
          </p>
        </div>
      </div>

      {userEmail && onLogout && (
        <div className="flex items-center gap-3 relative z-10">
          <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
            <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
            <span className="text-xs text-white/90">{userEmail}</span>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 px-3 py-2 rounded-lg transition backdrop-blur-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>
      )}
    </header>
  );
}
