"use client";

import { LogOut } from "lucide-react";

interface HeaderProps {
  userEmail?: string | null;
  onLogout?: () => void;
}

export default function Header({ userEmail, onLogout }: HeaderProps) {
  return (
    <header className="bg-[#00A499] text-white px-6 py-3 flex items-center justify-between">
      <div>
        <h1 className="text-sm font-bold">
          Dirección de Planificación y Desarrollo Territorial
        </h1>
        <p className="text-xs opacity-85">
          USACH — Sistema de Seguimiento de Proyectos
        </p>
      </div>
      {userEmail && onLogout && (
        <div className="flex items-center gap-3">
          <span className="text-xs opacity-85">{userEmail}</span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>
      )}
    </header>
  );
}
