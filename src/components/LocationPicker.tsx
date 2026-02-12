"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { MapPin, Search, X, Navigation } from "lucide-react";

interface LocationPickerProps {
  lat?: number;
  lng?: number;
  nombre?: string;
  onLocationChange: (lat: number, lng: number, nombre: string) => void;
}

// Dynamic imports for react-leaflet
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
const useMapEvents = dynamic(
  () => import("react-leaflet").then((mod) => {
    // Return a wrapper component that uses the hook
    const ClickHandler = ({ onClick }: { onClick: (lat: number, lng: number) => void }) => {
      const hook = mod.useMapEvents;
      hook({
        click(e: { latlng: { lat: number; lng: number } }) {
          onClick(e.latlng.lat, e.latlng.lng);
        },
      });
      return null;
    };
    return ClickHandler;
  }),
  { ssr: false }
) as unknown as React.ComponentType<{ onClick: (lat: number, lng: number) => void }>;

// USACH campus center
const USACH_CENTER: [number, number] = [-33.4489, -70.6818];

export default function LocationPicker({
  lat,
  lng,
  nombre,
  onLocationChange,
}: LocationPickerProps) {
  const [isClient, setIsClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [localNombre, setLocalNombre] = useState(nombre || "");
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(
    lat && lng ? [lat, lng] : null
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Reverse geocode using Nominatim (free, no API key)
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
        }
      } catch {
        onLocationChange(latitude, longitude, localNombre);
      }
    },
    [localNombre, onLocationChange]
  );

  // Search by address
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
        const shortName = data[0].display_name.split(",").slice(0, 2).join(",");
        setLocalNombre(shortName);
        onLocationChange(newLat, newLng, shortName);
      }
    } catch {
      // silently fail
    }
    setSearching(false);
  };

  const handleMapClick = (clickLat: number, clickLng: number) => {
    setMarkerPos([clickLat, clickLng]);
    reverseGeocode(clickLat, clickLng);
  };

  const handleClearLocation = () => {
    setMarkerPos(null);
    setLocalNombre("");
    onLocationChange(0, 0, "");
  };

  const createMarkerIcon = () => {
    if (typeof window === "undefined") return undefined;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26C32 7.163 24.837 0 16 0z" fill="#00A499"/>
      <circle cx="16" cy="16" r="8" fill="white"/>
      <circle cx="16" cy="16" r="4" fill="#00A499"/>
    </svg>`;
    return L.divIcon({
      html: svg,
      className: "",
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -42],
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <MapPin className="w-4 h-4 text-[#00A499]" />
        <h3 className="text-sm font-bold text-gray-800">Ubicación del Proyecto</h3>
      </div>

      <div className="p-4 space-y-3">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Buscar dirección o edificio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-3 py-2 bg-[#00A499] text-white rounded-lg text-xs font-medium hover:bg-[#008F85] transition-colors disabled:opacity-50"
          >
            {searching ? "..." : "Buscar"}
          </button>
        </div>

        {/* Current location display */}
        {markerPos && localNombre && (
          <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 rounded-lg border border-teal-100">
            <Navigation size={12} className="text-[#00A499] flex-shrink-0" />
            <span className="text-xs text-gray-700 flex-1 truncate">
              {localNombre}
            </span>
            <button
              onClick={handleClearLocation}
              className="p-0.5 hover:bg-teal-100 rounded transition-colors"
            >
              <X size={12} className="text-gray-400" />
            </button>
          </div>
        )}

        {/* Location name input */}
        <input
          type="text"
          placeholder="Nombre de ubicación (ej: Edificio CITECAMP, Sala 302)"
          value={localNombre}
          onChange={(e) => {
            setLocalNombre(e.target.value);
            if (markerPos) {
              onLocationChange(markerPos[0], markerPos[1], e.target.value);
            }
          }}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
        />

        {/* Map */}
        {isClient && (
          <div
            className="rounded-lg overflow-hidden border border-gray-200"
            style={{ height: 260 }}
          >
            <link
              rel="stylesheet"
              href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            />
            <MapContainer
              center={markerPos || USACH_CENTER}
              zoom={markerPos ? 17 : 15}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {/* Click handler */}
              {useMapEvents && React.createElement(useMapEvents, { onClick: handleMapClick })}
              {markerPos && (
                <Marker position={markerPos} icon={createMarkerIcon()} />
              )}
            </MapContainer>
          </div>
        )}

        <p className="text-[10px] text-gray-400 text-center">
          Haz clic en el mapa para marcar la ubicación del proyecto
        </p>
      </div>
    </div>
  );
}
