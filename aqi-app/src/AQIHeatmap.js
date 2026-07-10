import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import { HeatmapLayer } from "react-leaflet-heatmap-layer-v3";

function getAQIColor(aqi) {
  if (aqi <= 50)  return "#22C55E";
  if (aqi <= 100) return "#EAB308";
  if (aqi <= 150) return "#F97316";
  if (aqi <= 200) return "#EF4444";
  if (aqi <= 300) return "#A855F7";
  return "#7F1D1D";
}

function getAQITextColor(aqi) {
  if (aqi <= 100) return "#000";
  return "#fff";
}

function getAQICategory(aqi) {
  if (aqi <= 50)  return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy — Sensitive";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

function makeAQIIcon(aqi) {
  const bg   = getAQIColor(aqi);
  const fg   = getAQITextColor(aqi);
  const size = aqi > 200 ? 42 : aqi > 100 ? 38 : 34;
  const fs   = aqi >= 100 ? 11 : 12;
  return L.divIcon({
    className: "",
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor:[0, -(size / 2) - 4],
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:${bg};
      border:2px solid rgba(255,255,255,0.55);
      box-shadow:0 2px 8px rgba(0,0,0,0.45),0 0 0 1px ${bg}40;
      display:flex;align-items:center;justify-content:center;
      font-family:'Space Mono',monospace;
      font-size:${fs}px;font-weight:700;
      color:${fg};
      line-height:1;
      cursor:pointer;
    ">${aqi}</div>`,
  });
}

const LEGEND = [
  { color: "#22C55E", label: "Good",           range: "0–50" },
  { color: "#EAB308", label: "Moderate",        range: "51–100" },
  { color: "#F97316", label: "Sensitive Groups",range: "101–150" },
  { color: "#EF4444", label: "Unhealthy",       range: "151–200" },
  { color: "#A855F7", label: "Very Unhealthy",  range: "201–300" },
  { color: "#7F1D1D", label: "Hazardous",       range: "301+" },
];

export default function AQIHeatmap({ fullscreen = false }) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHeat, setShowHeat] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);

  useEffect(() => {
    axios
      .get("/aqi-heatmap")
      .then((res) => {
        const formatted = (res.data || [])
          .filter((item) => item.aqi != null)
          .map((item) => ({ ...item, intensity: Math.min(item.aqi / 300, 1) }));
        setPoints(formatted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const worst  = points.reduce((a, b) => (!a || b.aqi > a.aqi ? b : a), null);
  const avgAqi = points.length ? Math.round(points.reduce((s, p) => s + p.aqi, 0) / points.length) : null;
  const mapH   = fullscreen ? "640px" : "520px";

  return (
    <div style={{ marginTop: "2.5rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.25rem", display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>Interactive map</div>
          <h2 style={{
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.03em",
            color: "var(--color-text-primary)", margin: 0,
          }}>
            Global AQI Heatmap
          </h2>
        </div>

        {/* Layer toggles */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          {[
            { label: "Heat layer",   state: showHeat,    set: setShowHeat },
            { label: "City markers", state: showMarkers, set: setShowMarkers },
          ].map(({ label, state, set }) => (
            <button
              key={label}
              onClick={() => set((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: "0.375rem",
                padding: "0.375rem 0.75rem",
                borderRadius: "100px",
                border: `1px solid ${state ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
                background: state ? "var(--color-accent-glow)" : "none",
                color: state ? "var(--color-accent)" : "var(--color-text-muted)",
                fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <span style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: state ? "var(--color-accent)" : "var(--color-border)",
              }} />
              {label}
            </button>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
            <span className="live-dot" style={{ width: "6px", height: "6px" }} />
            {loading ? "Loading…" : `${points.length} stations`}
          </div>
        </div>
      </div>

      {/* Map */}
      <div
        className="aeris-card"
        style={{ overflow: "hidden", padding: 0, position: "relative", height: mapH }}
      >
        {loading ? (
          <div className="skeleton" style={{ width: "100%", height: "100%" }} />
        ) : (
          <MapContainer
            center={[25, 20]}
            zoom={2}
            minZoom={2}
            style={{ height: "100%", width: "100%" }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {showHeat && points.length > 0 && (
              <HeatmapLayer
                points={points}
                longitudeExtractor={(m) => m.lon}
                latitudeExtractor={(m) => m.lat}
                intensityExtractor={(m) => m.intensity}
                max={1}
                radius={45}
                blur={40}
                gradient={{
                  0.0: "rgba(34,197,94,0)",
                  0.2: "rgba(34,197,94,0.6)",
                  0.4: "rgba(234,179,8,0.7)",
                  0.6: "rgba(249,115,22,0.75)",
                  0.8: "rgba(239,68,68,0.8)",
                  1.0: "rgba(168,85,247,0.85)",
                }}
              />
            )}

            {showMarkers && points.map((city, i) => (
              <Marker key={i} position={[city.lat, city.lon]} icon={makeAQIIcon(city.aqi)}>
                <Popup>
                  <div style={{ fontFamily: "var(--font-body)", minWidth: "150px", padding: "0.25rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: "0.375rem", color: "var(--color-text-primary)" }}>
                      {city.city}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                      <span className="data-mono" style={{ fontSize: "1.875rem", fontWeight: 700, color: getAQIColor(city.aqi) }}>
                        {city.aqi}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>US AQI</span>
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: getAQIColor(city.aqi), fontWeight: 600 }}>
                      {getAQICategory(city.aqi)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.375rem", fontFamily: "var(--font-mono)" }}>
                      {Number(city.lat).toFixed(2)}°, {Number(city.lon).toFixed(2)}°
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}

        {/* Legend overlay */}
        <div
          style={{
            position: "absolute", right: "12px", top: "12px", zIndex: 1000,
            background: "rgba(7,21,38,0.9)",
            backdropFilter: "blur(10px)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "10px", padding: "0.875rem",
            minWidth: "155px",
            pointerEvents: "none",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: "0.625rem" }}>AQI scale</div>
          {LEGEND.map(({ color, label, range }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
              <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(255,255,255,0.6)" }} />
              </span>
              <span style={{ fontSize: "0.75rem", color: "#E2EEF8", flex: 1 }}>{label}</span>
              <span style={{ fontSize: "0.6875rem", color: "#7BA5C4", fontFamily: "var(--font-mono)" }}>{range}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
        {[
          {
            eyebrow: "Stations tracked",
            value: points.length,
            mono: true,
            sub: "Cities with live AQI data",
          },
          {
            eyebrow: "Worst air quality",
            value: worst?.city || "—",
            mono: false,
            sub: worst ? `AQI ${worst.aqi} · ${getAQICategory(worst.aqi)}` : "—",
            valueColor: worst ? getAQIColor(worst.aqi) : undefined,
          },
          {
            eyebrow: "Global average AQI",
            value: avgAqi ?? "—",
            mono: true,
            sub: avgAqi ? getAQICategory(avgAqi) : "—",
            valueColor: avgAqi ? getAQIColor(avgAqi) : undefined,
          },
        ].map((card) => (
          <div key={card.eyebrow} className="aeris-card" style={{ padding: "1.25rem" }}>
            <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>{card.eyebrow}</div>
            <div
              className={card.mono ? "data-mono" : ""}
              style={{
                fontSize: card.mono ? "2rem" : "1.25rem",
                fontWeight: 700,
                color: card.valueColor || "var(--color-text-primary)",
                lineHeight: 1.1,
                marginBottom: "0.375rem",
                fontFamily: card.mono ? "var(--font-mono)" : "var(--font-display)",
              }}
            >
              {card.value}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{card.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
