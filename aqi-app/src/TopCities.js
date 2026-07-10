import React, { useEffect, useState } from "react";
import axios from "axios";
import AQICategory from "./AQICategory";

function getAQIColor(aqi) {
  if (!aqi) return "var(--color-text-muted)";
  if (aqi <= 50)  return "var(--color-aqi-good)";
  if (aqi <= 100) return "var(--color-aqi-moderate)";
  if (aqi <= 150) return "var(--color-aqi-usg)";
  if (aqi <= 200) return "var(--color-aqi-unhealthy)";
  if (aqi <= 300) return "var(--color-aqi-very-unhealthy)";
  return "var(--color-aqi-hazardous)";
}

export default function TopCities({ onCitySelect }) {
  const [loading, setLoading] = useState(true);
  const [sorted, setSorted] = useState([]);

  useEffect(() => {
    axios
      .get("/aqi-ranking")
      .then((res) => {
        setSorted([...(res.data || [])].sort((a, b) => b.aqi - a.aqi));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ marginTop: "3rem" }}>
      <div style={{ marginBottom: "1.5rem", display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>Live global rankings</div>
          <h2 style={{
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.03em",
            color: "var(--color-text-primary)", margin: 0,
          }}>
            Most polluted cities
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
          <span className="live-dot" />
          Real-time · Ranked by AQI
        </div>
      </div>

      {loading ? (
        <div className="aeris-card" style={{ padding: "1.5rem" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: "52px", marginBottom: "0.75rem", borderRadius: "8px" }} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="aeris-card" style={{ padding: "2.5rem", textAlign: "center" }}>
          <p style={{ fontSize: "0.9375rem", color: "var(--color-text-muted)" }}>
            No ranking data available. Ensure the backend is running.
          </p>
        </div>
      ) : (
        <div className="aeris-card" style={{ overflow: "hidden" }}>
          {sorted.map((city, i) => (
            <button
              key={i}
              onClick={() => onCitySelect && onCitySelect(city.name)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                width: "100%",
                padding: "1rem 1.5rem",
                background: "none",
                border: "none",
                borderBottom: i < sorted.length - 1 ? "1px solid var(--color-border-subtle)" : "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-bg-overlay)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
            >
              {/* Rank */}
              <span className="data-mono" style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", width: "28px", flexShrink: 0 }}>
                {String(i + 1).padStart(2, "0")}
              </span>

              {/* Color bar */}
              <div style={{
                width: "3px", height: "36px", borderRadius: "2px",
                background: getAQIColor(city.aqi), flexShrink: 0,
              }} />

              {/* City info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--color-text-primary)" }}>
                  {city.name}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.125rem", fontFamily: "var(--font-mono)" }}>
                  {Number(city.lat).toFixed(2)}°, {Number(city.lon).toFixed(2)}°
                </div>
              </div>

              {/* AQI bar */}
              <div style={{ width: "120px", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)" }}>0</span>
                  <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)" }}>500</span>
                </div>
                <div className="compare-bar-wrap">
                  <div
                    className="compare-bar-fill"
                    style={{
                      width: `${Math.min((city.aqi / 500) * 100, 100)}%`,
                      background: getAQIColor(city.aqi),
                    }}
                  />
                </div>
              </div>

              {/* AQI value */}
              <div style={{ textAlign: "right", flexShrink: 0, minWidth: "80px" }}>
                <div className="data-mono" style={{ fontSize: "1.375rem", fontWeight: 700, color: getAQIColor(city.aqi) }}>
                  {city.aqi}
                </div>
                <AQICategory value={city.aqi} />
              </div>

              {/* Arrow */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
