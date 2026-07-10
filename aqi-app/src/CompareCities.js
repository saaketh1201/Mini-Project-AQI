import React, { useState } from "react";
import axios from "axios";
import AQICategory from "./AQICategory";
import SkeletonCard from "./SkeletonCard";
import DownloadReport from "./DownloadReport";
import DownloadComparisonReport from "./DownloadComparisonReport";


const POLLUTANT_LABELS = {
  pm2_5: "PM2.5", pm10: "PM10", no2: "NO₂",
  so2: "SO₂", o3: "O₃", co: "CO", nh3: "NH₃",
};

function CityCard({ cityData, color }) {
  if (cityData.error) {
    return (
      <div className="aeris-card" style={{ padding: "1.75rem", textAlign: "center" }}>
        <p style={{ color: "var(--color-aqi-unhealthy)", fontSize: "0.9rem" }}>{cityData.error}</p>
      </div>
    );
  }

  return (
    <div className="aeris-card animate-slide-up" style={{ padding: "1.75rem", borderTop: `3px solid ${color}` }}>
      {/* City name + AQI */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h3 style={{
          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.375rem",
          letterSpacing: "-0.025em", color: "var(--color-text-primary)", margin: "0 0 0.5rem",
        }}>
          {cityData.city}
        </h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem" }}>
          <span className="data-mono" style={{ fontSize: "3.5rem", fontWeight: 700, color, lineHeight: 1 }}>
            {cityData.aqi}
          </span>
          <div style={{ marginBottom: "0.5rem" }}>
            <AQICategory value={cityData.aqi} />
          </div>
        </div>
      </div>

      <div className="divider" style={{ marginBottom: "1.25rem" }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <div className="aeris-card" style={{ padding: "0.8rem 0.9rem", background: "var(--color-bg-overlay)" }}>
          <div className="eyebrow" style={{ marginBottom: "0.28rem" }}>Source</div>
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{cityData.source || "Live data"}</div>
        </div>
        <div className="aeris-card" style={{ padding: "0.8rem 0.9rem", background: "var(--color-bg-overlay)" }}>
          <div className="eyebrow" style={{ marginBottom: "0.28rem" }}>Confidence</div>
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{cityData.risk?.confidence || 78}%</div>
        </div>
      </div>

      {/* AQI bar */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>AQI</span>
          <span className="data-mono" style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
            {cityData.aqi} / 500
          </span>
        </div>
        <div className="compare-bar-wrap">
          <div
            className="compare-bar-fill"
            style={{ width: `${Math.min((cityData.aqi / 500) * 100, 100)}%`, background: color }}
          />
        </div>
      </div>

      {/* Weather context */}
      {cityData.weather && (
        <div style={{ marginBottom: "1.25rem", padding: "0.9rem 1rem", borderRadius: "10px", background: "rgba(74,158,255,0.08)" }}>
          <div className="eyebrow" style={{ marginBottom: "0.3rem" }}>Weather influence</div>
          <div style={{ fontSize: "0.82rem", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
            Humidity {cityData.weather.humidity ?? "—"}% · Wind {cityData.weather.wind_speed ?? "—"} km/h
          </div>
        </div>
      )}

      {/* Analytics */}
      {cityData.analytics && cityData.analytics.narrative && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {[
            { tag: "Diagnostic",   tagClass: "tag-diagnostic",   key: "diagnostic" },
            { tag: "Predictive",   tagClass: "tag-predictive",   key: "predictive" },
            { tag: "Prescriptive", tagClass: "tag-prescriptive", key: "prescriptive" },
          ].map(({ tag, tagClass, key }) => (
            cityData.analytics.narrative[key] && (
              <div key={key}>
                <span className={`analytics-tag ${tagClass}`} style={{ marginBottom: "0.375rem", display: "inline-flex" }}>
                  {tag}
                </span>
                <p style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                  {cityData.analytics.narrative[key]}
                </p>
              </div>
            )
          ))}
        </div>
      )}

      <div className="divider" style={{ marginBottom: "1.25rem" }} />

      {/* Pollutants */}
      {cityData.composition && (
        <div>
          <div className="eyebrow" style={{ marginBottom: "0.875rem" }}>Pollutant readings</div>
          {Object.entries(cityData.composition)
            .filter(([k, v]) => v != null && POLLUTANT_LABELS[k])
            .sort(([, a], [, b]) => b - a)
            .map(([key, val]) => (
              <div key={key} className="metric-row">
                <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                  {POLLUTANT_LABELS[key]}
                </span>
                <span className="data-mono" style={{ fontSize: "0.875rem", color: "var(--color-text-primary)", fontWeight: 700 }}>
                  {Number(val).toFixed(1)}
                  <span style={{ fontSize: "0.6875rem", fontWeight: 400, color: "var(--color-text-muted)", marginLeft: "0.25rem" }}>µg/m³</span>
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Download */}
      <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid var(--color-border-subtle)" }}>
        <DownloadReport city={cityData.city} />
      </div>
    </div>
  );
}

export default function CompareCities() {
  const [city1, setCity1] = useState("");
  const [city2, setCity2] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCompare = () => {
    if (!city1.trim() || !city2.trim()) {
      setError("Enter both city names to compare.");
      return;
    }
    setError("");
    setLoading(true);
    setData(null);
    axios
      .get(`/compare?city1=${encodeURIComponent(city1)}&city2=${encodeURIComponent(city2)}`)
      .then((res) => { setData(res.data); setLoading(false); })
      .catch(() => { setError("Comparison failed. Please try again."); setLoading(false); });
  };

  const color1 = "#00C2B8";
  const color2 = "#4A9EFF";

  return (
    <div style={{ marginTop: "3rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>Environmental comparison</div>
        <h2 style={{
          fontFamily: "var(--font-display)", fontWeight: 700,
          fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.03em",
          color: "var(--color-text-primary)", margin: "0 0 0.5rem",
        }}>
          Compare cities
        </h2>
        <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", margin: 0 }}>
          Side-by-side AQI, pollutant breakdown, and environmental intelligence.
        </p>
      </div>

      {/* Input row */}
      <div className="aeris-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: "180px" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", display: "block", marginBottom: "0.375rem" }}>
              First city
            </label>
            <input
              className="aeris-input"
              style={{ height: "44px" }}
              placeholder="e.g. Delhi"
              value={city1}
              onChange={(e) => setCity1(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCompare()}
            />
          </div>
          <div style={{ flexShrink: 0, paddingBottom: "2px" }}>
            <span style={{ fontSize: "1.25rem", color: "var(--color-text-muted)" }}>vs</span>
          </div>
          <div style={{ flex: 1, minWidth: "180px" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", display: "block", marginBottom: "0.375rem" }}>
              Second city
            </label>
            <input
              className="aeris-input"
              style={{ height: "44px" }}
              placeholder="e.g. London"
              value={city2}
              onChange={(e) => setCity2(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCompare()}
            />
          </div>
          <button
            onClick={handleCompare}
            disabled={loading}
            className="aeris-btn-primary"
            style={{ height: "44px", padding: "0 1.5rem", flexShrink: 0, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Comparing…" : "Compare"}
          </button>
        </div>
        {error && (
          <p style={{ fontSize: "0.875rem", color: "var(--color-aqi-unhealthy)", marginTop: "0.75rem", marginBottom: 0 }}>
            {error}
          </p>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
          <SkeletonCard height={380} />
          <SkeletonCard height={380} />
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
            {[
              { d: data.city1, color: color1 },
              { d: data.city2, color: color2 },
            ].map(({ d, color }, i) => (
              <CityCard key={i} cityData={d} color={color} />
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginTop: "1.25rem" }}>
            <div className="aeris-card" style={{ padding: "1rem" }}>
              <div className="eyebrow" style={{ marginBottom: "0.35rem" }}>AQI delta</div>
              <div className="data-mono" style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                {Math.abs(data.city1.aqi - data.city2.aqi)}
              </div>
            </div>
            <div className="aeris-card" style={{ padding: "1rem" }}>
              <div className="eyebrow" style={{ marginBottom: "0.35rem" }}>Higher-risk city</div>
              <div style={{ fontSize: "0.95rem", color: "var(--color-text-secondary)" }}>
                {data.city1.aqi > data.city2.aqi ? data.city1.city : data.city2.city}
              </div>
            </div>
            <div className="aeris-card" style={{ padding: "1rem" }}>
              <div className="eyebrow" style={{ marginBottom: "0.35rem" }}>Best comparison lens</div>
              <div style={{ fontSize: "0.95rem", color: "var(--color-text-secondary)" }}>AQI · PM2.5 · Weather</div>
            </div>
          </div>

          {/* Quick diff summary */}
          {data.city1?.aqi && data.city2?.aqi && !data.city1.error && !data.city2.error && (
            <div className="aeris-card" style={{ marginTop: "1.25rem", padding: "1.5rem" }}>
              <div className="eyebrow" style={{ marginBottom: "0.75rem" }}>Comparison summary</div>
              <p style={{ fontSize: "0.9375rem", color: "var(--color-text-secondary)", lineHeight: 1.7, margin: "0 0 1.25rem" }}>
                {data.city1.city} has an AQI of {data.city1.aqi} vs {data.city2.city} at {data.city2.aqi}.
                {" "}
                {data.city1.aqi > data.city2.aqi
                  ? `${data.city1.city} has ${data.city1.aqi - data.city2.aqi} points higher pollution concentration.`
                  : data.city2.aqi > data.city1.aqi
                  ? `${data.city2.city} has ${data.city2.aqi - data.city1.aqi} points higher pollution concentration.`
                  : "Both cities have equivalent air quality levels."}
                {" "}
                {Math.abs(data.city1.aqi - data.city2.aqi) > 100
                  ? "The gap is significant — populations in the higher-AQI city face substantially elevated respiratory risk."
                  : ""}
              </p>
              <DownloadComparisonReport city1={data.city1.city} city2={data.city2.city} />
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && (
        <div
          className="aeris-card"
          style={{ padding: "3rem 2rem", textAlign: "center", borderStyle: "dashed" }}
        >
          <div style={{
            width: "44px", height: "44px", borderRadius: "10px",
            background: "var(--color-bg-overlay)", border: "1px solid var(--color-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem", color: "var(--color-text-muted)",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <p style={{ fontSize: "0.9375rem", color: "var(--color-text-muted)", margin: 0 }}>
            Enter two city names to generate a comparison
          </p>
        </div>
      )}
    </div>
  );
}
