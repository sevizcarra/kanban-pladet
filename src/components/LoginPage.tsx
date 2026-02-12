"use client";

import { useState } from "react";
import { login } from "@/lib/auth";

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.endsWith("@usach.cl")) {
      setError("Solo se permiten correos @usach.cl");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      onLogin();
    } catch {
      setError("Credenciales incorrectas. Contacte al administrador.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00A499] to-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background shapes */}
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -40px) scale(1.1); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-25px, 30px) scale(1.05); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, 20px) scale(0.95); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="absolute top-[-80px] left-[-80px] w-[300px] h-[300px] rounded-full bg-[#00A499]/20 blur-3xl" style={{ animation: "float1 8s ease-in-out infinite" }} />
      <div className="absolute bottom-[-60px] right-[-60px] w-[250px] h-[250px] rounded-full bg-white/30 blur-3xl" style={{ animation: "float2 10s ease-in-out infinite" }} />
      <div className="absolute top-[40%] right-[10%] w-[180px] h-[180px] rounded-full bg-[#F97316]/10 blur-2xl" style={{ animation: "float3 12s ease-in-out infinite" }} />

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative z-10" style={{ animation: "fadeSlideUp 0.6s ease-out" }}>
        {/* Header */}
        <div className="bg-[#F97316] px-8 py-6 text-center">
          <h1 className="text-xl font-bold text-white tracking-wide">
            Dirección de Planificación y Desarrollo Territorial
          </h1>
          <p className="text-sm text-white/80 mt-1">
            Sistema de seguimiento de proyectos
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Iniciar Sesión
            </h2>
            <p className="text-sm text-gray-500">
              Ingrese sus credenciales institucionales
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-600 font-semibold mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@usach.cl"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] focus:ring-2 focus:ring-[#00A499]/20 outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 font-semibold mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] focus:ring-2 focus:ring-[#00A499]/20 outline-none transition"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-semibold text-sm transition ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#00A499] hover:bg-[#00A499]/90 active:scale-[0.98]"
            }`}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            Acceso restringido. Solicite credenciales al administrador.
          </p>
        </form>
      </div>
    </div>
  );
}
