"use client";

import React, { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { MapPin, Search, X, Navigation } from "lucide-react";

const LocationPickerMap = dynamic(() => import("./LocationPickerMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-50">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-[#F97316] rounded-full animate-spin" />
    </div>
  ),
});

interface LocationPickerProps {
  lat?: number;
  lng?: number;
  nombre?: string;
  onLocationChange: (lat: number, lng: number, nombre: string) => void;
}

const USACH_CENTER: [number, number] = [-33.4489, -70.6818];

export default function LocationPicker({
  lat,
  lng,
  nombre,
  onLocationChange,
}: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [localNombre, setLocalNombre] = useState(nombre || "");
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(
    lat && lng && (lat !== 0 || lng !== 0) ? [lat, lng] : null
  );
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    lat && lng && (lat !== 0 || lng !== 0) ? [lat, lng] : USACH_CENTER
  );
  const [mapZoom, setMapZoom] = useState(lat && lng && (lat !== 0 || lng !== 0) ? 17 : 15);

  const reverseGeocode = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          { headers: { "Accept-Language": "es" } }
        );
        const data = await res.json();
        if (data.display_name) {
          const shortName =
            data.address?.road
              ? `${data.address.road}${data.address.house_number ? ` ${data.address.house_number}` : ""}, ${data.address.suburb || data.address.city || ""}`
              : data.display_name.split(",").slice(0, 2).join(",");
          setLocalNombre(shortName);
          onLocationChange(latitude, longitude, shortName);
        } else {
          onLocationChange(latitude, longitude, localNombre);
        }
      } catch {
        onLocationChange(latitude, longitude, localNombre);
      }
    },
    [localNombre, onLocationChange]
  );

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ", Santiago, Chile")}&limit=1`,
        { headers: { "Accept-Language": "es" } }
      );
      const data = await res.json();
      if (data.length > 0) {
        const newLat = parseFloat(data[0].lat);
        const newLng = parseFloat(data[0].lon);
        setMarkerPos([newLat, newLng]);
        setMapCenter([newLat, newLng]);
        setMapZoom(17);
        const shortName = data[0].display_name.split(",").slice(0, 2).join(",");
        setLocalNombre(shortName);
        onLocationChange(newLat, newLng, shortName);
      }
    } catch {
      // silently fail
    }
    setSearching(false);
  };

  const handleMapClick = useCallback(
    (clickLat: number, clickLng: number) => {
      setMarkerPos([clickLat, clickLng]);
      reverseGeocode(clickLat, clickLng);
    },
    [reverseGeocode]
  );

  const handleClearLocation = () => {
    setMarkerPos(null);
    setLocalNombre("");
    setMapCenter(USACH_CENTER);
    setMapZoom(15);
    onLocationChange(0, 0, "");
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <MapPin className="w-4 h-4 text-[#F97316]" />
        <h3 className="text-sm font-bold text-gray-800">Ubicación del Proyecto</h3>
      </div>

      <div className="p-4 space-y-3">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar dirección o edificio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-3 py-2 bg-[#F97316] text-white rounded-lg text-xs font-medium hover:bg-[#008F85] transition-colors disabled:opacity-50"
          >
            {searching ? "..." : "Buscar"}
          </button>
        </div>

        {/* Current location display */}
        {markerPos && localNombre && (
          <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-lg border border-orange-100">
            <Navigation size={12} className="text-[#F97316] flex-shrink-0" />
            <span className="text-xs text-gray-700 flex-1 truncate">{localNombre}</span>
            <button onClick={handleClearLocation} className="p-0.5 hover:bg-orange-100 rounded transition-colors">
              <X size={12} className="text-gray-400" />
            </button>
          </div>
        )}

        {/* Location name input */}
        <input
          type="text"
          placeholder="Nombre de ubicación (ej: Edificio CITECAMP)"
          value={localNombre}
          onChange={(e) => {
            setLocalNombre(e.target.value);
            if (markerPos) {
              onLocationChange(markerPos[0], markerPos[1], e.target.value);
            }
          }}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
        />

        {/* Map */}
        <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: 240 }}>
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <LocationPickerMap
            markerPos={markerPos}
            center={mapCenter}
            zoom={mapZoom}
            onMapClick={handleMapClick}
          />
        </div>

        <p className="text-[10px] text-gray-400 text-center">
          Haz clic en el mapa para marcar la ubicación del proyecto
        </p>
      </div>
    </div>
  );
}
