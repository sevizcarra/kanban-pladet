"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { Project } from "@/types/project";
import { getStatusObj } from "@/lib/constants";
import { MapPin, AlertTriangle } from "lucide-react";

const MapViewInner = dynamic(() => import("./MapViewInner"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-[#00A499] rounded-full animate-spin" />
    </div>
  ),
});

interface MapViewProps {
  projects: Project[];
  onProjectClick: (p: Project) => void;
}

export default function MapView({ projects, onProjectClick }: MapViewProps) {
  const geoProjects = useMemo(
    () => projects.filter((p) => p.ubicacionLat && p.ubicacionLng && (p.ubicacionLat !== 0 || p.ubicacionLng !== 0)),
    [projects]
  );

  const noGeoProjects = useMemo(
    () => projects.filter((p) => !p.ubicacionLat || !p.ubicacionLng || (p.ubicacionLat === 0 && p.ubicacionLng === 0)),
    [projects]
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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

        <div style={{ height: 520 }}>
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <MapViewInner projects={projects} onProjectClick={onProjectClick} />
        </div>
      </div>

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
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: statusObj.color }} />
                  <span className="text-xs text-gray-800 truncate flex-1 font-medium">{p.title}</span>
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
