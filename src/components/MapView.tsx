"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Project } from "@/types/project";
import {
  PROFESSIONALS,
  PRIORITIES,
  getStatusObj,
  getProgress,
  fmtDate,
  fmt,
  daysLeft,
} from "@/lib/constants";
import { MapPin, Layers, AlertTriangle } from "lucide-react";

interface MapViewProps {
  projects: Project[];
  onProjectClick: (p: Project) => void;
}

// Dynamically import Map to prevent SSR issues with Leaflet
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

// USACH main campus coordinates
const USACH_CENTER: [number, number] = [-33.4489, -70.6818];
const DEFAULT_ZOOM = 15;

export default function MapView({ projects, onProjectClick }: MapViewProps) {
  const [isClient, setIsClient] = useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Projects that have coordinates
  const geoProjects = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.ubicacionLat !== undefined &&
          p.ubicacionLng !== undefined &&
          p.ubicacionLat !== 0 &&
          p.ubicacionLng !== 0
      ),
    [projects]
  );

  const noGeoProjects = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.ubicacionLat === undefined ||
          p.ubicacionLng === undefined ||
          p.ubicacionLat === 0 ||
          p.ubicacionLng === 0
      ),
    [projects]
  );

  // Create custom icon based on status color
  const createIcon = (color: string, isOverdue: boolean) => {
    if (typeof window === "undefined") return undefined;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet");
    const borderColor = isOverdue ? "#ef4444" : color;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="${borderColor}"/>
      <circle cx="14" cy="14" r="8" fill="white"/>
      <circle cx="14" cy="14" r="5" fill="${color}"/>
      ${isOverdue ? '<text x="14" y="17" text-anchor="middle" font-size="10" font-weight="bold" fill="#ef4444">!</text>' : ""}
    </svg>`;
    return L.divIcon({
      html: svg,
      className: "",
      iconSize: [28, 36],
      iconAnchor: [14, 36],
      popupAnchor: [0, -36],
    });
  };

  if (!isClient) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#00A499] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Cargando mapa...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Map container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#00A499]" />
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Mapa de Proyectos
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-[#00A499]" />
              {geoProjects.length} con ubicación
            </span>
            <span className="flex items-center gap-1 text-gray-400">
              {noGeoProjects.length} sin ubicación
            </span>
          </div>
        </div>

        {/* Leaflet Map */}
        <div style={{ height: 520 }}>
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          />
          <MapContainer
            center={USACH_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {geoProjects.map((p) => {
              const statusObj = getStatusObj(p.status, p.tipoDesarrollo);
              const dl = daysLeft(p.dueDate);
              const isOverdue =
                p.status !== "terminada" && dl !== null && dl < 0;
              const progress = getProgress(
                p.status,
                p.subEtapas,
                p.tipoDesarrollo
              );
              const prof =
                p.jefeProyectoId !== undefined && p.jefeProyectoId >= 0
                  ? PROFESSIONALS[p.jefeProyectoId]?.name || "—"
                  : "—";
              const prioConfig = PRIORITIES[p.priority];
              const icon = createIcon(statusObj.color, isOverdue);

              return (
                <Marker
                  key={p.id}
                  position={[p.ubicacionLat!, p.ubicacionLng!]}
                  icon={icon}
                >
                  <Popup>
                    <div style={{ minWidth: 220, fontFamily: "inherit" }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          marginBottom: 6,
                          color: "#111",
                        }}
                      >
                        {p.title}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          marginBottom: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            backgroundColor: `${statusObj.color}20`,
                            color: statusObj.color,
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {statusObj.label}
                        </span>
                        <span
                          style={{
                            backgroundColor: prioConfig.bg,
                            color: prioConfig.color,
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {prioConfig.label}
                        </span>
                        {isOverdue && (
                          <span
                            style={{
                              backgroundColor: "#fef2f2",
                              color: "#ef4444",
                              padding: "2px 8px",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {Math.abs(dl!)}d atraso
                          </span>
                        )}
                      </div>
                      <table
                        style={{
                          fontSize: 11,
                          width: "100%",
                          borderCollapse: "collapse",
                        }}
                      >
                        <tbody>
                          <tr>
                            <td
                              style={{ color: "#999", padding: "2px 0" }}
                            >
                              Avance
                            </td>
                            <td
                              style={{
                                fontWeight: 600,
                                padding: "2px 0",
                              }}
                            >
                              {progress}%
                            </td>
                          </tr>
                          <tr>
                            <td style={{ color: "#999", padding: "2px 0" }}>
                              Jefe Proy.
                            </td>
                            <td
                              style={{
                                fontWeight: 500,
                                padding: "2px 0",
                              }}
                            >
                              {prof.split(" ").slice(0, 2).join(" ")}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ color: "#999", padding: "2px 0" }}>
                              Vencimiento
                            </td>
                            <td
                              style={{
                                fontWeight: 500,
                                padding: "2px 0",
                              }}
                            >
                              {fmtDate(p.dueDate)}
                            </td>
                          </tr>
                          {p.ubicacionNombre && (
                            <tr>
                              <td
                                style={{
                                  color: "#999",
                                  padding: "2px 0",
                                }}
                              >
                                Ubicación
                              </td>
                              <td
                                style={{
                                  fontWeight: 500,
                                  padding: "2px 0",
                                }}
                              >
                                {p.ubicacionNombre}
                              </td>
                            </tr>
                          )}
                          {p.budget && (
                            <tr>
                              <td
                                style={{
                                  color: "#999",
                                  padding: "2px 0",
                                }}
                              >
                                Presupuesto
                              </td>
                              <td
                                style={{
                                  fontWeight: 500,
                                  padding: "2px 0",
                                }}
                              >
                                {fmt(Number(p.budget))}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      <button
                        onClick={() => onProjectClick(p)}
                        style={{
                          marginTop: 8,
                          width: "100%",
                          padding: "6px 0",
                          backgroundColor: "#00A499",
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Ver Proyecto
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Projects without location */}
      {noGeoProjects.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Proyectos sin ubicación asignada ({noGeoProjects.length})
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {noGeoProjects.map((p) => {
              const statusObj = getStatusObj(p.status, p.tipoDesarrollo);
              return (
                <button
                  key={p.id}
                  onClick={() => onProjectClick(p)}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 hover:bg-teal-50/40 transition-colors text-left"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: statusObj.color }}
                  />
                  <span className="text-xs text-gray-800 truncate flex-1 font-medium">
                    {p.title}
                  </span>
                  <MapPin size={12} className="text-gray-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
