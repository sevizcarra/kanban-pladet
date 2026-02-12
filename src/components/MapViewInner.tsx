"use client";

import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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

interface MapViewInnerProps {
  projects: Project[];
  onProjectClick: (p: Project) => void;
}

const USACH_CENTER: [number, number] = [-33.4489, -70.6818];

function createIcon(color: string, isOverdue: boolean) {
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
}

export default function MapViewInner({ projects, onProjectClick }: MapViewInnerProps) {
  return (
    <MapContainer
      center={USACH_CENTER}
      zoom={15}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {projects.map((p) => {
        if (!p.ubicacionLat || !p.ubicacionLng || (p.ubicacionLat === 0 && p.ubicacionLng === 0)) return null;

        const statusObj = getStatusObj(p.status, p.tipoDesarrollo);
        const dl = daysLeft(p.dueDate);
        const isOverdue = p.status !== "terminada" && dl !== null && dl < 0;
        const progress = getProgress(p.status, p.subEtapas, p.tipoDesarrollo);
        const prof =
          p.jefeProyectoId !== undefined && p.jefeProyectoId >= 0
            ? PROFESSIONALS[p.jefeProyectoId]?.name || "—"
            : "—";
        const prioConfig = PRIORITIES[p.priority];
        const icon = createIcon(statusObj.color, isOverdue);

        return (
          <Marker key={p.id} position={[p.ubicacionLat, p.ubicacionLng]} icon={icon}>
            <Popup>
              <div style={{ minWidth: 220, fontFamily: "inherit" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: "#111" }}>
                  {p.title}
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{
                    backgroundColor: `${statusObj.color}20`, color: statusObj.color,
                    padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                  }}>
                    {statusObj.label}
                  </span>
                  <span style={{
                    backgroundColor: prioConfig.bg, color: prioConfig.color,
                    padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                  }}>
                    {prioConfig.label}
                  </span>
                  {isOverdue && (
                    <span style={{
                      backgroundColor: "#fef2f2", color: "#ef4444",
                      padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                    }}>
                      {Math.abs(dl!)}d atraso
                    </span>
                  )}
                </div>
                <table style={{ fontSize: 11, width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <td style={{ color: "#999", padding: "2px 0" }}>Avance</td>
                      <td style={{ fontWeight: 600, padding: "2px 0" }}>{progress}%</td>
                    </tr>
                    <tr>
                      <td style={{ color: "#999", padding: "2px 0" }}>Jefe Proy.</td>
                      <td style={{ fontWeight: 500, padding: "2px 0" }}>
                        {prof.split(" ").slice(0, 2).join(" ")}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: "#999", padding: "2px 0" }}>Vencimiento</td>
                      <td style={{ fontWeight: 500, padding: "2px 0" }}>{fmtDate(p.dueDate)}</td>
                    </tr>
                    {p.ubicacionNombre && (
                      <tr>
                        <td style={{ color: "#999", padding: "2px 0" }}>Ubicación</td>
                        <td style={{ fontWeight: 500, padding: "2px 0" }}>{p.ubicacionNombre}</td>
                      </tr>
                    )}
                    {p.budget && (
                      <tr>
                        <td style={{ color: "#999", padding: "2px 0" }}>Presupuesto</td>
                        <td style={{ fontWeight: 500, padding: "2px 0" }}>{fmt(Number(p.budget))}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <button
                  onClick={() => onProjectClick(p)}
                  style={{
                    marginTop: 8, width: "100%", padding: "6px 0",
                    backgroundColor: "#00A499", color: "white", border: "none",
                    borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
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
  );
}
