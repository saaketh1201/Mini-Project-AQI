import React, { useEffect, useMemo, useState } from "react";
import { getCityData, getNearby, getRanking } from "./services/api";
import AQIGauge from "./AQIGauge";
import AQIHeatmap from "./AQIHeatmap";
import TopCities from "./TopCities";
import DownloadReport from "./DownloadReport";
import SkeletonCard from "./SkeletonCard";
import EnvironmentalDiagnosis from "./EnvironmentalDiagnosis";
const AQIChart = React.lazy(() => import("./AQIChart"));
const CompositionChart = React.lazy(() => import("./CompositionChart"));
const PollutantIntelligence = React.lazy(() => import("./PollutantIntelligence"));
const PollutionSourcePanel = React.lazy(() => import("./PollutionSourceEngine"));
const NearbyAQIRanking = React.lazy(() => import("./NearbyAQIRanking"));
// Small, focused cards for the redesigned dashboard
const PrimaryDriverCard = React.memo(function PrimaryDriverCard({ risk, composition }) {
  const driver = risk?.dominant_pollutant || { label: 'PM2.5', value: composition?.pm2_5 || 0, unit: 'µg/m³' };
  return (
    <div className="eid-card">
      <div className="eyebrow">Primary AQI Driver</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>{driver.label}</div>
          <div style={{ color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>{driver.value} {driver.unit}</div>
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent)' }}>{risk?.score || '--'}</div>
      </div>
    </div>
  );
});

const DominantPollutantCard = React.memo(function DominantPollutantCard({ composition }) {
  const entries = Object.entries(composition || {}).filter(([,v]) => v != null);
  const dom = entries.sort((a,b)=> (b[1] - a[1]))[0] || [];
  const label = dom[0] ? (dom[0] === 'pm2_5' ? 'PM2.5' : dom[0].toUpperCase()) : '—';
  const val = dom[1] || '—';
  return (
    <div className="eid-card">
      <div className="eyebrow">Dominant Pollutant</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>{label}</div>
          <div style={{ color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>{Number(val).toFixed(1)} µg/m³</div>
        </div>
        <div style={{ fontSize: '1.5rem' }}>🧭</div>
      </div>
    </div>
  );
});

const PollutionSourcesCard = React.memo(function PollutionSourcesCard({ composition }) {
  const clues = [];
  if ((composition?.pm2_5 || 0) > 35) clues.push('Combustion & traffic');
  if ((composition?.pm10 || 0) > 80) clues.push('Dust / construction');
  if ((composition?.so2 || 0) > 40) clues.push('Industrial combustion');
  if ((composition?.o3 || 0) > 80) clues.push('Photochemical smog (O₃)');
  return (
    <div className="eid-card">
      <div className="eyebrow">Pollution Sources</div>
      <div style={{ marginTop: '0.4rem' }}>
        {clues.length ? clues.map((c) => (
          <div key={c} className="pill" style={{ marginBottom: '0.4rem' }}>{c}</div>
        )) : <div style={{ color: 'var(--color-text-secondary)' }}>No dominant source signatures detected</div>}
      </div>
    </div>
  );
});

function HealthRecommendationsCard({ prescriptive, risk }) {
  const pres = prescriptive || 'Follow standard precautions.';
  return (
    <div className="eid-card">
      <div className="eyebrow">Health Recommendations</div>
      <div style={{ marginTop: '0.5rem', color: 'var(--color-text-secondary)' }}>{pres}</div>
      <div style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Confidence: {risk?.confidence || 78}%</div>
    </div>
  );
}

function WHOComparisonCard({ composition }) {
  const checks = Object.keys(WHO_GUIDELINES).filter((k) => ["pm2_5", "pm10", "no2"].includes(k)).map((k) => ({ key: k, val: composition?.[k], thr: WHO_GUIDELINES[k] }));
  return (
    <div className="eid-card">
      <div className="eyebrow">WHO Comparison</div>
      <div style={{ marginTop: '0.5rem' }}>
        {checks.map((c) => (
          <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <div style={{ color: 'var(--color-text-secondary)' }}>{c.key === 'pm2_5' ? 'PM2.5' : c.key.toUpperCase()}</div>
            <div style={{ fontWeight: 800 }}>{c.val != null ? `${Number(c.val).toFixed(1)} µg/m³` : '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function compositionsToSourceInsight(composition) {
  const hints = [];
  if ((composition?.pm2_5 || 0) > 35) hints.push('Fine particles suggest combustion or transport emissions');
  if ((composition?.pm10 || 0) > 80) hints.push('High coarse particulate load indicates dust, construction, or road resuspension');
  if ((composition?.no2 || 0) > 50) hints.push('NO₂ elevation points to traffic and combustion sources');
  if ((composition?.so2 || 0) > 40) hints.push('SO₂ levels suggest industrial fuel burning');
  if ((composition?.o3 || 0) > 80) hints.push('Elevated O₃ indicates photochemical smog formation');
  return hints.join('; ');
}

function getAQIColor(aqi) {
  if (!aqi) return "var(--color-text-muted)";
  if (aqi <= 50)  return "var(--color-aqi-good)";
  if (aqi <= 100) return "var(--color-aqi-moderate)";
  if (aqi <= 150) return "var(--color-aqi-usg)";
  if (aqi <= 200) return "var(--color-aqi-unhealthy)";
  if (aqi <= 300) return "var(--color-aqi-very-unhealthy)";
  return "var(--color-aqi-hazardous)";
}

function getAQICategory(aqi) {
  if (!aqi) return "Unknown";
  if (aqi <= 50)  return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

function getAQIBadgeClass(aqi) {
  if (!aqi) return "aqi-badge";
  if (aqi <= 50)  return "aqi-badge aqi-badge-good";
  if (aqi <= 100) return "aqi-badge aqi-badge-moderate";
  if (aqi <= 150) return "aqi-badge aqi-badge-usg";
  if (aqi <= 200) return "aqi-badge aqi-badge-unhealthy";
  if (aqi <= 300) return "aqi-badge aqi-badge-very-unhealthy";
  return "aqi-badge aqi-badge-hazardous";
}

const POLLUTANT_META = {
  pm2_5: { label: "PM2.5", unit: "µg/m³", threshold: 12, desc: "Fine particulate matter" },
  pm10:  { label: "PM10",  unit: "µg/m³", threshold: 54, desc: "Coarse particulate matter" },
  no2:   { label: "NO₂",   unit: "µg/m³", threshold: 100,   desc: "Nitrogen dioxide" },
  so2:   { label: "SO₂",   unit: "µg/m³", threshold: 196,   desc: "Sulfur dioxide" },
  o3:    { label: "O₃",    unit: "µg/m³", threshold: 140,   desc: "Ground-level ozone" },
  co:    { label: "CO",    unit: "µg/m³", threshold: 10000, desc: "Carbon monoxide" },
  nh3:   { label: "NH₃",   unit: "µg/m³", threshold: 100,   desc: "Ammonia" },
};

const WHO_GUIDELINES = {
  pm2_5: 15,
  pm10: 45,
  no2: 25,
  so2: 40,
  o3: 100,
  co: 4000,
  nh3: 100,
};

function PollutantRow({ pollutant, value }) {
  const meta = POLLUTANT_META[pollutant] || { label: pollutant.toUpperCase(), unit: "µg/m³", threshold: 1 };
  const who = WHO_GUIDELINES[pollutant];
  const pct = Math.min((value / (meta.threshold * 3)) * 100, 100);
  const status = value > meta.threshold * 2 ? "var(--color-aqi-unhealthy)"
    : value > meta.threshold ? "var(--color-aqi-usg)"
    : "var(--color-aqi-good)";

  return (
    <div className="metric-row" style={{ alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "baseline" }}>
          <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--color-text-primary)" }}>
            {meta.label}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{meta.desc}</span>
        </div>
        {who != null && (
          <div style={{ marginTop: "0.35rem", display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--color-accent)", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700 }}>WHO</span>
            <span>safe &lt;{who} {meta.unit}</span>
          </div>
        )}
        <div className="compare-bar-wrap" style={{ marginTop: "0.65rem", width: "100%", maxWidth: "220px" }}>
          <div className="compare-bar-fill" style={{ width: `${pct}%`, background: status }} />
        </div>
      </div>
      <div className="data-mono" style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--color-text-primary)", minWidth: "70px", textAlign: "right" }}>
        {Number(value).toFixed(1)}
        <span style={{ fontSize: "0.6875rem", fontWeight: 400, color: "var(--color-text-muted)", marginLeft: "0.25rem" }}>
          {meta.unit}
        </span>
      </div>
    </div>
  );
}

function FreshnessMeta({ source, updatedAt, confidence }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: "0.75rem" }}>
      <span>Source: {source || "Live data"}</span>
      <span>Last Updated: {updatedAt || "just now"}</span>
      <span>Confidence: {confidence || 78}%</span>
    </div>
  );
}

function AnalyticsCard({ tag, tagClass, title, content, source, updatedAt, confidence }) {
  return (
    <div className="aeris-card animate-slide-up" style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <span className={`analytics-tag ${tagClass}`}>{tag}</span>
      </div>
      <h4 style={{
        fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.9375rem",
        color: "var(--color-text-primary)", margin: "0 0 0.625rem", letterSpacing: "-0.01em",
      }}>
        {title}
      </h4>
      <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", lineHeight: 1.7, margin: 0 }}>
        {content}
      </p>
      <FreshnessMeta source={source} updatedAt={updatedAt} confidence={confidence} />
    </div>
  );
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "intelligence", label: "Environmental Intelligence" },
  { id: "analytics", label: "Analytics" },
  { id: "maps", label: "Maps" },
  { id: "reports", label: "Reports" },
];

export default function AQIDashboard({ city, onCityChange }) {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [nearbyData, setNearbyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [error, setError] = useState(null);

  const cleanestAreas = useMemo(() => {
    const localities = nearbyData?.localities || [];
    return [...localities].sort((a, b) => (a.aqi || 0) - (b.aqi || 0)).slice(0, 5);
  }, [nearbyData]);

  const pollutedAreas = useMemo(() => {
    const localities = nearbyData?.localities || [];
    return [...localities].sort((a, b) => (b.aqi || 0) - (a.aqi || 0)).slice(0, 5);
  }, [nearbyData]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    setNearbyData(null);
    getCityData(city)
      .then((res) => {
        setData(res);
        setHistory(res.history || []);
        if (res.lat && res.lon) {
          getNearby(res.lat, res.lon, 50)
            .then((nearby) => setNearbyData(nearby))
            .catch(() => {});
        }
        setLoading(false);

        // lightweight background prefetches (don't block UI)
        try {
          setTimeout(() => {
            if (res.lat && res.lon) {
              getNearby(res.lat, res.lon).catch(() => {});
            }
            getRanking().catch(() => {});
          }, 200);
        } catch (e) {
          // ignore prefetch errors
        }
      })
      .catch((err) => {
        setError(err?.response?.data?.error || "Failed to fetch data for this location.");
        setLoading(false);
      });
  }, [city]);

  if (loading) {
    return (
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>
        <div className="aeris-card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "12px",
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1.25rem", color: "var(--color-aqi-unhealthy)",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.0625rem", color: "var(--color-text-primary)", margin: "0 0 0.5rem" }}>
            Location not found
          </h3>
          <p style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)", margin: "0 0 1.5rem" }}>{error}</p>
          <button className="aeris-btn-ghost" onClick={() => onCityChange && onCityChange("")}>
            Try another city
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const aqi = data.aqi;
  const composition = data.composition || {};
  const analytics = data.analytics || {};
  const narrative = analytics.narrative || {};
  const risk = analytics.risk || {};
  const aiSummary = analytics.summary || "Air quality conditions are being monitored in real time.";
  const kpis = analytics.kpis || {};
  const freshnessLabel = data.source === "IQAir AirVisual API" ? "IQAir" : data.source || "Live data";
  const freshnessAge = data.updatedAt ? new Date(data.updatedAt).toLocaleString() : "just now";
  const averageAqi = history.length > 0 ? Math.round(history.reduce((sum, item) => sum + (item.y || 0), 0) / history.length) : aqi;

  const reportData = {
    city: data.city,
    title: "Aeris Environmental Intelligence Report",
    date: new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
    time: new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    aqi,
    category: getAQICategory(aqi),
    primaryDriver: risk.dominant_pollutant?.label || "PM2.5",
    dominantPollutant: risk.dominant_pollutant?.label || "PM2.5",
    pollutionSources: [
      compositionsToSourceInsight(composition),
    ].filter(Boolean).join("; ") || "Not available",
    riskScore: risk.score || "N/A",
    healthRecommendation: narrative.prescriptive || analytics?.prescriptive || "Follow standard precautions.",
    decisionSupport: aiSummary,
    weatherSummary: data.weather ? `Humidity ${data.weather.humidity ?? "—"}% · Wind ${data.weather.wind_speed ?? "—"} km/h` : risk.weather || "Weather summary unavailable",
    forecastSummary: data.forecast?.length ? `Next 48 hours forecast range ${Math.min(...data.forecast.map((p) => p.y || 0))}–${Math.max(...data.forecast.map((p) => p.y || 0))} µg/m³` : "Forecast summary unavailable",
    cleanestAreas,
    pollutedAreas,
  };

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "2rem 1.5rem" }}>

      {/* ── City header ─────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1.5rem",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "2rem",
          paddingBottom: "1.5rem",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>Air quality report</div>
          <h1
            style={{
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)", letterSpacing: "-0.035em",
              color: "var(--color-text-primary)", margin: "0 0 0.5rem",
            }}
          >
            {data.city}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", flexWrap: "wrap" }}>
            <span className={getAQIBadgeClass(aqi)}>
              {getAQICategory(aqi)}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
              <span className="live-dot" />
              Live · Updated {freshnessAge}
            </span>
            {data.lat && (
              <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                {Number(data.lat).toFixed(2)}°N, {Number(data.lon).toFixed(2)}°E
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <DownloadReport city={data.city} reportData={reportData} buttonLabel="Download Executive Report" csvLabel="Export Environmental CSV" />
          <div style={{ textAlign: "right" }}>
            <div className="data-mono" style={{
              fontSize: "clamp(3rem, 8vw, 5rem)", fontWeight: 700,
              lineHeight: 1, color: getAQIColor(aqi),
              textShadow: `0 0 40px ${getAQIColor(aqi)}40`,
            }}>
              {aqi}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
              US AQI
            </div>
          </div>
          <AQIGauge value={aqi} size={88} />
        </div>
      </div>

      {/* ── Tab navigation ──────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: "2rem",
          borderBottom: "1px solid var(--color-border-subtle)",
          marginBottom: "2rem",
          overflowX: "auto",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-item ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
            style={{ background: "none", border: "none" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Descriptive tab ─────────────────────────────── */}
      {tab === "overview" && (
        <div className="animate-fade-in">
          {/* Redesigned Environmental Intelligence Dashboard Grid */}
          <div className="eid-grid" style={{ marginBottom: '1rem' }}>
            <PrimaryDriverCard risk={risk} composition={composition} />
            <DominantPollutantCard composition={composition} />
            <PollutionSourcesCard composition={composition} />
            <EnvironmentalDiagnosis composition={composition} aqi={aqi} city={data.city} />
            <HealthRecommendationsCard prescriptive={narrative.prescriptive} risk={risk} />
            <WHOComparisonCard composition={composition} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
            <div className="aeris-card animate-slide-up" style={{ padding: "1.5rem", gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div>
                  <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>Environmental Risk Score</div>
                  <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.125rem", color: "var(--color-text-primary)", margin: 0, letterSpacing: "-0.02em" }}>
                    Signature environmental intelligence
                  </h3>
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                  Source: {freshnessLabel}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "center" }}>
                <div style={{ minWidth: "180px" }}>
                  <div className="data-mono" style={{ fontSize: "3.25rem", fontWeight: 700, color: getAQIColor(aqi), lineHeight: 1 }}>
                    {risk.score || aqi}/100
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginTop: "0.35rem" }}>
                    {risk.level || getAQICategory(aqi)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {['Low','Moderate','High','Severe'].map((level, index) => {
                    const active = risk.level === level;
                    const colors = ["#22C55E", "#EAB308", "#F97316", "#EF4444"];
                    return (
                      <div key={level} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: active ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>
                        <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: colors[index], boxShadow: active ? `0 0 0 4px ${colors[index]}22` : "none" }} />
                        {level}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.85rem", marginTop: "1.25rem" }}>
                <div className="aeris-card" style={{ padding: "0.9rem 1rem", background: "var(--color-bg-overlay)" }}>
                  <div className="eyebrow" style={{ marginBottom: "0.35rem" }}>Biggest contributor</div>
                  <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{risk.dominant_pollutant?.label || "PM2.5"}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{risk.dominant_pollutant?.value || 0} {risk.dominant_pollutant?.unit || "µg/m³"}</div>
                </div>
                <div className="aeris-card" style={{ padding: "0.9rem 1rem", background: "var(--color-bg-overlay)" }}>
                  <div className="eyebrow" style={{ marginBottom: "0.35rem" }}>Weather influence</div>
                  <div style={{ fontSize: "0.86rem", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{risk.weather || "Weather data unavailable"}</div>
                </div>
                <div className="aeris-card" style={{ padding: "0.9rem 1rem", background: "var(--color-bg-overlay)" }}>
                  <div className="eyebrow" style={{ marginBottom: "0.35rem" }}>Trend</div>
                  <div style={{ fontSize: "0.86rem", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{risk.trend || "Trend data limited"}</div>
                </div>
                <div className="aeris-card" style={{ padding: "0.9rem 1rem", background: "var(--color-bg-overlay)" }}>
                  <div className="eyebrow" style={{ marginBottom: "0.35rem" }}>Confidence</div>
                  <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{risk.confidence || 78}%</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>Model confidence</div>
                </div>
              </div>
            </div>
            <div className="aeris-card animate-slide-up" style={{ padding: "1.25rem", gridColumn: "1 / -1" }}>
              <div className="eyebrow" style={{ marginBottom: "0.75rem" }}>Admin insights dashboard</div>
              <div className="aeris-card" style={{ padding: "1rem 1.1rem", marginBottom: "1rem", background: "rgba(0,194,184,0.08)" }}>
                <div className="eyebrow" style={{ marginBottom: "0.35rem" }}>Decision Support Summary</div>
                <div style={{ fontSize: "0.92rem", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>{aiSummary}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.85rem" }}>
                {[
                  { label: "Average AQI", value: kpis.average_aqi ?? averageAqi },
                  { label: "Average ERS", value: `${kpis.average_ers ?? risk.score ?? 0}/100` },
                  { label: "Cleanest city", value: kpis.cleanest_city || (aqi <= 50 ? data.city : "Not in clean band") },
                  { label: "Most polluted city", value: kpis.most_polluted_city || (aqi >= 200 ? data.city : "No severe hotspot") },
                  { label: "Trend", value: kpis.trend || (risk.trend || "Stable") },
                  { label: "Highest-risk region", value: kpis.highest_risk_region || (risk.level && risk.level !== "Low" ? data.city : "Low risk") },
                ].map((item) => (
                  <div key={item.label} className="aeris-card" style={{ padding: "0.9rem 1rem", background: "var(--color-bg-overlay)" }}>
                    <div className="eyebrow" style={{ marginBottom: "0.3rem" }}>{item.label}</div>
                    <div style={{ fontWeight: 600, color: "var(--color-text-primary)", fontSize: "0.95rem" }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.76rem", color: "var(--color-text-muted)" }}>
                ERS rationale: AQI carries the largest weight because it summarizes overall pollution pressure, while PM2.5, PM10, NO₂, weather, and forecast trend refine the risk estimate.
              </div>
              <FreshnessMeta source={freshnessLabel} updatedAt={freshnessAge} confidence={risk.confidence || 78} />
            </div>

            {/* AQI card */}
            <div className="aeris-card" style={{ padding: "1.5rem" }}>
              <div className="eyebrow" style={{ marginBottom: "0.75rem" }}>Air Quality Index</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem" }}>
                <span className="data-mono" style={{ fontSize: "3rem", fontWeight: 700, color: getAQIColor(aqi), lineHeight: 1 }}>
                  {aqi}
                </span>
                <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "0.375rem" }}>
                  US EPA scale
                </span>
              </div>
              <div style={{ marginTop: "1rem" }}>
                <div className="compare-bar-wrap" style={{ marginBottom: "0.5rem" }}>
                  <div className="compare-bar-fill" style={{ width: `${Math.min((aqi / 500) * 100, 100)}%`, background: getAQIColor(aqi) }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "var(--color-text-muted)" }}>
                  <span>0</span><span>100</span><span>200</span><span>300</span><span>500</span>
                </div>
              </div>
              <FreshnessMeta source={freshnessLabel} updatedAt={freshnessAge} confidence={risk.confidence || 78} />
            </div>

            {/* PM2.5 */}
            <div className="aeris-card animate-slide-up" style={{ padding: "1.5rem" }}>
              <div className="eyebrow" style={{ marginBottom: "0.75rem" }}>PM2.5 Concentration</div>
              <div className="data-mono" style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1 }}>
                {composition.pm2_5 ? Number(composition.pm2_5).toFixed(1) : "—"}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginTop: "0.375rem" }}>µg/m³ · WHO safe: &lt;15 µg/m³</div>
              <div style={{ marginTop: "1rem", fontSize: "0.8125rem", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                Fine particles penetrate deep into lung tissue. Primary driver of AQI in most urban environments.
              </div>
              <FreshnessMeta source={freshnessLabel} updatedAt={freshnessAge} confidence={risk.confidence || 78} />
            </div>

            {/* PM10 */}
            <div className="aeris-card animate-slide-up" style={{ padding: "1.5rem" }}>
              <div className="eyebrow" style={{ marginBottom: "0.75rem" }}>PM10 Concentration</div>
              <div className="data-mono" style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1 }}>
                {composition.pm10 ? Number(composition.pm10).toFixed(1) : "—"}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginTop: "0.375rem" }}>µg/m³ · WHO safe: &lt;45 µg/m³</div>
              <div style={{ marginTop: "1rem", fontSize: "0.8125rem", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                Coarser particles from dust, construction, and road abrasion. Contributes to respiratory stress.
              </div>
              <FreshnessMeta source={freshnessLabel} updatedAt={freshnessAge} confidence={risk.confidence || 78} />
            </div>

            {/* Model metrics */}
            {data.metrics && (
              <div className="aeris-card animate-slide-up" style={{ padding: "1.5rem" }}>
                <div className="eyebrow" style={{ marginBottom: "0.75rem" }}>Forecast Model Performance</div>
                <div style={{ display: "flex", gap: "1.5rem" }}>
                  {["MAE", "RMSE"].map((metric) => (
                    <div key={metric}>
                      <div className="data-mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                        {data.metrics[metric] ? Number(data.metrics[metric]).toFixed(2) : "—"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{metric}</div>
                    </div>
                  ))}
                  {data.metrics.MAPE != null && (
                    <div>
                      <div className="data-mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                        {Number(data.metrics.MAPE).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>MAPE</div>
                    </div>
                  )}
                </div>
                {data.metrics.model && (
                  <div style={{ marginTop: "0.875rem" }}>
                    <span className="model-badge best">Best: {data.metrics.model}</span>
                  </div>
                )}
                <FreshnessMeta source={freshnessLabel} updatedAt={freshnessAge} confidence={risk.confidence || 78} />
              </div>
            )}
          </div>

          {/* Pollutant quick list */}
          <div className="aeris-card animate-slide-up" style={{ padding: "1.5rem 1.75rem" }}>
            <div className="eyebrow" style={{ marginBottom: "1rem" }}>Pollutant readings</div>
            {Object.entries(composition)
              .filter(([key, val]) => val != null && POLLUTANT_META[key])
              .map(([key, val]) => (
                <PollutantRow key={key} pollutant={key} value={val} />
              ))}
            <FreshnessMeta source={freshnessLabel} updatedAt={freshnessAge} confidence={risk.confidence || 78} />
          </div>

          {/* Nearby AQI Ranking Module */}
          <React.Suspense fallback={<SkeletonCard />}>
            <NearbyAQIRanking lat={data.lat} lon={data.lon} city={data.city} />
          </React.Suspense>
        </div>
      )}

      {/* ── Pollution Intelligence tab ────────────────────── */}
      {tab === "intelligence" && (
        <div className="animate-fade-in">

          {/* Pollutant Intelligence Module */}
          <React.Suspense fallback={<SkeletonCard />}>
            <PollutantIntelligence composition={composition} aqi={aqi} />
          </React.Suspense>

          {/* Pollution Source Intelligence Engine */}
          <React.Suspense fallback={<SkeletonCard />}>
            <PollutionSourcePanel composition={composition} />
          </React.Suspense>

          {/* 48-Hour PM2.5 Forecast (kept) */}
          <div className="aeris-card" style={{ padding: "1.75rem", marginTop: "1.25rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>48-Hour PM2.5 Forecast</div>
                <h3 style={{
                  fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.125rem",
                  color: "var(--color-text-primary)", margin: 0, letterSpacing: "-0.02em",
                }}>
                  Predictive trajectory
                </h3>
              </div>
              {data.metrics?.model && (
                <span className="model-badge best">Model: {data.metrics.model}</span>
              )}
            </div>
            <React.Suspense fallback={<SkeletonCard />}>
              <AQIChart forecast={data.forecast} label="Forecast PM2.5 (µg/m³)" />
            </React.Suspense>
          </div>

          {history.length > 0 && (
            <div className="aeris-card" style={{ padding: "1.75rem" }}>
              <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>30-Day Historical Record</div>
              <h3 style={{
                fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.125rem",
                color: "var(--color-text-primary)", margin: "0 0 1.5rem", letterSpacing: "-0.02em",
              }}>
                PM2.5 observation window
              </h3>
              <React.Suspense fallback={<SkeletonCard />}>
                <AQIChart forecast={history} label="Historical PM2.5 (µg/m³)" isHistory />
              </React.Suspense>
            </div>
          )}
        </div>
      )}

      {/* ── Predictive tab ─────────────────────────────── */}
      {tab === "analytics" && (
        <div className="animate-fade-in">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }} className="flex-responsive">
            <div className="aeris-card" style={{ padding: "1.75rem" }}>
              <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>Composition breakdown</div>
              <h3 style={{
                fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.125rem",
                color: "var(--color-text-primary)", margin: "0 0 1.5rem", letterSpacing: "-0.02em",
              }}>
                Pollutant distribution
              </h3>
                <React.Suspense fallback={<SkeletonCard />}>
                  <CompositionChart composition={composition} />
                </React.Suspense>
            </div>

            <div className="aeris-card" style={{ padding: "1.75rem" }}>
              <div className="eyebrow" style={{ marginBottom: "1rem" }}>Detailed readings</div>
              {Object.entries(composition)
                .filter(([key, val]) => val != null && POLLUTANT_META[key])
                .sort(([, a], [, b]) => b - a)
                .map(([key, val]) => (
                  <PollutantRow key={key} pollutant={key} value={val} />
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Maps tab ─────────────────────────────── */}
      {tab === "maps" && (
        <div className="animate-fade-in">
          <div className="aeris-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>Geo-intelligence</div>
                <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.125rem", color: "var(--color-text-primary)", margin: 0, letterSpacing: "-0.02em" }}>
                  Global AQI heatmap & live rankings
                </h3>
              </div>
              <DownloadReport city={data.city} reportData={reportData} buttonLabel="Download Geo Report" csvLabel="Export Geo CSV" />
            </div>
          </div>
          <React.Suspense fallback={<SkeletonCard />}>
            <AQIHeatmap />
          </React.Suspense>
          <React.Suspense fallback={<SkeletonCard />}>
            <TopCities onCitySelect={onCityChange} />
          </React.Suspense>
        </div>
      )}

      {/* ── Reports tab ─────────────────────────────── */}
      {tab === "reports" && (
        <div className="animate-fade-in">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
            <AnalyticsCard
              tag="Descriptive"
              tagClass="tag-descriptive"
              title="Current conditions"
              content={narrative.descriptive}
              source={freshnessLabel}
              updatedAt={freshnessAge}
              confidence={risk.confidence || 78}
            />
            <AnalyticsCard
              tag="Diagnostic"
              tagClass="tag-diagnostic"
              title="Pollution drivers"
              content={narrative.diagnostic}
              source={freshnessLabel}
              updatedAt={freshnessAge}
              confidence={risk.confidence || 78}
            />
            <AnalyticsCard
              tag="Predictive"
              tagClass="tag-predictive"
              title="Trend outlook"
              content={narrative.predictive}
              source={freshnessLabel}
              updatedAt={freshnessAge}
              confidence={risk.confidence || 78}
            />
            <AnalyticsCard
              tag="Prescriptive"
              tagClass="tag-prescriptive"
              title="Health guidance"
              content={narrative.prescriptive}
              source={freshnessLabel}
              updatedAt={freshnessAge}
              confidence={risk.confidence || 78}
            />
          </div>

          {/* Geodemographic context */}
          {narrative.context && (
            <div className="aeris-card" style={{ padding: "1.75rem", marginBottom: "1.5rem" }}>
              <div className="eyebrow" style={{ marginBottom: "0.75rem" }}>Environmental context</div>
              <p style={{ fontSize: "0.9375rem", color: "var(--color-text-secondary)", lineHeight: 1.75, margin: 0 }}>
                {narrative.context}
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
            <DownloadReport city={data.city} reportData={reportData} buttonLabel="Download Report" csvLabel="Export CSV" />
          </div>
        </div>
      )}
    </div>
  );
}
