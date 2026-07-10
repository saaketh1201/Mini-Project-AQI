import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getNearby } from "./services/api";
import { getHyderabadFallback, HYD_CENTER } from "./hyderabadFallback";

// ─────────────────────────────────────────────────────────────────────────────
// AQI helpers (pure — no hardcoded city data)
// ─────────────────────────────────────────────────────────────────────────────
function getAQIColor(aqi) {
  if (!aqi) return "#3D6080";
  if (aqi <= 50)  return "#22C55E";
  if (aqi <= 100) return "#EAB308";
  if (aqi <= 150) return "#F97316";
  if (aqi <= 200) return "#EF4444";
  if (aqi <= 300) return "#A855F7";
  return "#7F1D1D";
}

function getAQICategory(aqi) {
  if (!aqi) return "Unknown";
  if (aqi <= 50)  return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

function getTrendIcon(trend) {
  if (!trend) return { icon: "→", color: "#7BA5C4", label: "Stable" };
  const t = trend.toLowerCase();
  if (t.includes("ris") || t.includes("wors")) return { icon: "↑", color: "#EF4444", label: "Rising" };
  if (t.includes("impr") || t.includes("fall")) return { icon: "↓", color: "#22C55E", label: "Improving" };
  return { icon: "→", color: "#EAB308", label: "Stable" };
}

function getLocalityIcon(locality) {
  if (locality.landUseIcon) return locality.landUseIcon;
  const tag = (locality.landUseTag || "").toLowerCase();
  if (tag.includes("airport") || tag.includes("logistics")) return "✈️";
  if (tag.includes("lake") || tag.includes("green") || tag.includes("water") || tag.includes("park")) return "🌳";
  if (tag.includes("industrial") || tag.includes("factory") || tag.includes("manufacturing")) return "🏭";
  if (tag.includes("dense") || tag.includes("urban") || tag.includes("traffic") || tag.includes("residential")) return "🚗";
  if (tag.includes("it") || tag.includes("tech")) return "💻";

  const dominant = (locality.dominant_key || locality.dominant || "pm2_5").toLowerCase();
  switch (dominant) {
    case "pm10": return "🌪️";
    case "no2": return "🚗";
    case "so2": return "🏭";
    case "o3": return "☀️";
    case "co": return "🔥";
    case "pm2_5": return "🌫️";
    default: return "📍";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Locality environmental analytics heuristics
// ─────────────────────────────────────────────────────────────────────────────
function generateLocalityInsights(locality) {
  const { composition = {}, aqi, landUseTag, note, analytics } = locality;
  const pm25 = composition.pm2_5 || 0;
  const pm10 = composition.pm10 || 0;
  const no2  = composition.no2 || 0;
  const so2  = composition.so2 || 0;
  const o3   = composition.o3 || 0;
  const co   = composition.co || 0;

  const tags = [];
  const bullets = [];

  // Prefer backend-provided analytics summary and narrative when available
  if (analytics) {
    const nar = analytics.narrative || {};
    const risk = analytics.risk || {};
    if (analytics.summary) {
      bullets.push(analytics.summary);
    }
    if (analytics.narrative) {
      const cand = [nar.diagnostic, nar.predictive, nar.prescriptive, nar.context];
      cand.forEach((c) => { if (c && !bullets.includes(c)) bullets.push(c); });
    }
    if (risk && risk.level) tags.push(risk.level);
    if (analytics.kpis && analytics.kpis.highest_risk_region) tags.push("Region Insight");
    const summary = analytics.summary || nar.descriptive || nar.diagnostic || note || "Environmental analytics available.";
    return { tags: [...new Set(tags)], bullets, note, summary };
  }

  // Land-use classification from tag
  if (landUseTag) {
    tags.push(landUseTag);
  }

  // ── Pollutant-based heuristics ─────────────────────────────────────────────
  if (so2 > 40 && pm25 > 35) {
    bullets.push("Possible industrial emissions — high SO₂ and PM2.5 are commonly associated with manufacturing or power generation activity.");
  }

  if (no2 > 50 && co > 4000) {
    bullets.push("Likely traffic congestion — elevated NO₂ and CO are commonly observed near dense road corridors and traffic intersections.");
  } else if (no2 > 40) {
    bullets.push("Possible heavy traffic influence — NO₂ levels are commonly associated with vehicle exhaust from high-density roads.");
  }

  if (pm10 > 0 && pm25 > 0 && pm10 > pm25 * 2.5) {
    bullets.push("Possible road dust or construction activity — coarse particle dominance (PM10 >> PM2.5) suggests resuspension from unpaved surfaces or active earthwork.");
  }

  if (o3 > 80) {
    bullets.push("Photochemical smog conditions likely — elevated ozone is commonly associated with strong UV radiation and NOx/VOC photochemical reactions.");
  }

  if (so2 > 40) {
    bullets.push("SO₂ presence may indicate coal combustion or industrial fuel use — commonly observed near thermal plants or heavy industry.");
  }

  // ── Land-use contextual insights ──────────────────────────────────────────
  const tag = (landUseTag || "").toLowerCase();

  if (tag.includes("lake") || tag.includes("green")) {
    bullets.push("Proximity to a water body or green belt may support local humidity and natural particle washout — commonly observed to improve ventilation.");
    tags.push("High Green Cover");
  }

  if (tag.includes("industrial")) {
    bullets.push("Area profile suggests possible industrial emission contribution — heavy vehicles and stack emissions are commonly observed in industrial corridors.");
    tags.push("Heavy Truck Movement");
  }

  if (tag.includes("it") || tag.includes("tech")) {
    bullets.push("High commuter vehicle density from IT office traffic — NO₂ and CO patterns are commonly associated with peak-hour congestion in tech corridors.");
    tags.push("Peak-hour Congestion");
  }

  if (tag.includes("airport") || tag.includes("logistics")) {
    bullets.push("Airport proximity may contribute to aviation-related emissions — jet fuel combustion and ground support vehicles are commonly associated with PM2.5 and NOx.");
  }

  // ── AQI-level general insight ──────────────────────────────────────────────
  if (aqi <= 50) {
    bullets.push("Good air quality — lower pollution load may reflect favourable wind dispersion, lower traffic density, or nearby vegetation providing natural filtration.");
    tags.push("Better Natural Ventilation");
  } else if (aqi > 150) {
    bullets.push("Air quality is significantly elevated — reduced outdoor activity is advisable, particularly for sensitive individuals.");
  }

  // If nothing triggered, give a generic data-driven statement
  if (bullets.length === 0) {
    bullets.push("Pollution levels appear moderate — no single source signature strongly dominates the composition at this time.");
  }

  // Construct a concise, composition-aware summary to avoid repeating identical text
  const pollutantValues = [
    { key: "pm2_5", label: "PM2.5", val: pm25 },
    { key: "pm10", label: "PM10", val: pm10 },
    { key: "no2", label: "NO₂", val: no2 },
    { key: "so2", label: "SO₂", val: so2 },
    { key: "o3", label: "O₃", val: o3 },
    { key: "co", label: "CO", val: co },
  ];

  const dominant = pollutantValues.slice().sort((a, b) => (b.val || 0) - (a.val || 0))[0];

  let summary = note || "";
  if (!summary) {
    // Build a short, unique sentence reflecting dominant pollutant and AQI band
    const aqiPhrase = aqi <= 50 ? "Good air quality" : aqi <= 100 ? "Moderate air quality" : aqi <= 150 ? "Unhealthy for sensitive groups" : aqi <= 200 ? "Unhealthy" : "Poor air quality";
    if (dominant && dominant.val > 0) {
      // Special-case coarse-particle dominance
      if (dominant.key === "pm10" && pm10 > pm25 * 2.2) {
        summary = `${aqiPhrase} — coarse particles (PM10) dominate locally (${pm10} µg/m³), suggesting dust or construction-related resuspension.`;
      } else if (dominant.key === "pm2_5" && pm25 > 35) {
        summary = `${aqiPhrase} — elevated PM2.5 (${pm25} µg/m³) suggests combustion or traffic-related fine particulate pollution.`;
      } else if (dominant.key === "no2" && no2 > 40) {
        summary = `${aqiPhrase} — higher NO₂ (${no2} µg/m³) consistent with traffic emissions or dense road networks.`;
      } else if (dominant.key === "so2" && so2 > 40) {
        summary = `${aqiPhrase} — SO₂ levels (${so2} µg/m³) point to industrial or fuel combustion sources nearby.`;
      } else if (dominant.key === "o3" && o3 > 80) {
        summary = `${aqiPhrase} — elevated ozone (${o3} µg/m³) indicates photochemical smog conditions under strong sunlight.`;
      } else if (dominant.key === "co" && co > 2000) {
        summary = `${aqiPhrase} — CO is notably present (${co} µg/m³), often linked to combustion and congested traffic.`;
      } else {
        // Fallback concise summary including dominant pollutant/value
        summary = `${aqiPhrase} — dominant pollutant: ${dominant.label} (${dominant.val} µg/m³).`;
      }
    } else {
      summary = `${aqiPhrase} — no clear pollutant dominance detected.`;
    }
  }

  return { tags: [...new Set(tags)], bullets, note, summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom hook — manages geolocation + data fetching lifecycle
// ─────────────────────────────────────────────────────────────────────────────
function useNearbyAQI(propLat, propLon, propCity) {
  const [permissionState, setPermissionState] = useState("idle"); // idle | requesting | granted | denied | error
  const [userCoords, setUserCoords] = useState(null);
  const [localities, setLocalities] = useState([]);
  const [centerCity, setCenterCity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [dataSource, setDataSource] = useState(null);
  const [error, setError] = useState(null);

  const fetchNearbyData = useCallback(async (lat, lon) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNearby(lat, lon, 50);
      const locs = data.localities || [];

      if (locs.length > 0) {
        setLocalities(locs);
        setCenterCity(data.center_city || null);
        setDataSource(data.source || "Open-Meteo");
        setUsingFallback(false);
      } else {
        // Activate Hyderabad fallback when no live localities are available
        const fallback = getHyderabadFallback(lat, lon, 70);
        setLocalities(fallback);
        setCenterCity("Hyderabad (Demo)");
        setDataSource("fallback");
        setUsingFallback(true);
      }
    } catch {
      // API failed — use Hyderabad fallback
      const fallback = getHyderabadFallback(lat, lon, 70);
      setLocalities(fallback);
      setCenterCity("Hyderabad (Demo)");
      setDataSource("fallback");
      setUsingFallback(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (propLat != null && propLon != null && permissionState === "idle") {
      const lat = Number(propLat);
      const lon = Number(propLon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        setUserCoords({ lat, lon });
        setPermissionState("granted");
        setCenterCity(propCity || null);
        fetchNearbyData(lat, lon);
      }
    }
  }, [propLat, propLon, propCity, permissionState, fetchNearbyData]);

  const requestLocation = useCallback(() => {
    setPermissionState("requesting");
    if (!navigator.geolocation) {
      setPermissionState("error");
      setError("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserCoords(coords);
        setPermissionState("granted");
        fetchNearbyData(coords.lat, coords.lon);
      },
      (err) => {
        setPermissionState("denied");
        setError(err.message || "Location access was denied.");
      },
      { timeout: 12000, maximumAge: 300000 }
    );
  }, [fetchNearbyData]);

  const loadHyderabadDemo = useCallback(() => {
    const { lat, lon } = HYD_CENTER;
    setUserCoords({ lat, lon });
    setPermissionState("granted");
    fetchNearbyData(lat, lon);
  }, [fetchNearbyData]);

  return {
    permissionState, userCoords, localities, centerCity,
    loading, usingFallback, dataSource, error,
    requestLocation, loadHyderabadDemo, fetchNearbyData,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PermissionPrompt — geolocation request card
// ─────────────────────────────────────────────────────────────────────────────
function PermissionPrompt({ onRequest, onDemo, requesting, error }) {
  return (
    <div className="nearby-permission-card aeris-card animate-slide-up">
      <div className="nearby-perm-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="10" r="3"/>
          <path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 11.5 7.35 11.76a1 1 0 0 0 1.3 0C12.95 21.5 20 15.4 20 10a8 8 0 0 0-8-8z"/>
        </svg>
      </div>
      <div className="nearby-perm-body">
        <div className="eyebrow" style={{ marginBottom: "0.35rem" }}>Nearby AQI Ranking</div>
        <h3 className="nearby-perm-title">Discover Air Quality Near You</h3>
        <p className="nearby-perm-desc">
          Detect localities within ~50 km, compare AQI rankings, and get environmental insights for each area.
          Location data is used only for this query and is never stored.
        </p>
        {error && (
          <div className="nearby-error-msg">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}
        <div className="nearby-perm-actions">
          <button className="aeris-btn-primary" onClick={onRequest} disabled={requesting} id="btn-request-location">
            {requesting ? (
              <>
                <span className="nearby-spinner" />
                Detecting location…
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 11.5 7.35 11.76a1 1 0 0 0 1.3 0C12.95 21.5 20 15.4 20 10a8 8 0 0 0-8-8z"/>
                </svg>
                Share My Location
              </>
            )}
          </button>
          <button className="aeris-btn-ghost" onClick={onDemo} id="btn-hyderabad-demo">
            Try Hyderabad Demo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalityInsightPanel — expandable insight accordion
// ─────────────────────────────────────────────────────────────────────────────
function LocalityInsightPanel({ locality }) {
  const { tags, bullets, note, summary } = useMemo(() => generateLocalityInsights(locality), [locality]);

  return (
    <div className="nearby-insight-panel">
      <div className="nearby-insight-tags">
        {tags.map((tag) => (
          <span key={tag} className="nearby-insight-tag">{tag}</span>
        ))}
      </div>
      {summary && (
        <div className="nearby-insight-summary">
          {summary}
        </div>
      )}
      {note && (
        <div className="nearby-insight-note">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {note}
        </div>
      )}
      <ul className="nearby-insight-bullets">
        {bullets.map((b, i) => (
          <li key={i} className="nearby-insight-bullet">
            <span className="nearby-bullet-dot">•</span>
            {b}
          </li>
        ))}
      </ul>
      <div className="nearby-insight-disclaimer">
        Insights are inferred from pollutant composition using environmental heuristics — not confirmed measurements.
        Wording is intentionally cautious: "Likely", "Possible", "Commonly associated with".
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalityCard — a single ranked locality row
// ─────────────────────────────────────────────────────────────────────────────
function LocalityCard({ locality, rank, variant }) {
  const [expanded, setExpanded] = useState(false);
  const aqiColor = getAQIColor(locality.aqi);
  const trend = getTrendIcon(locality.trend);
  const isClean = variant === "clean";
  const { tags, summary, note } = useMemo(() => generateLocalityInsights(locality), [locality]);
  const subtitle = note || locality.landUseTag || locality.analytics?.narrative?.context || "";

  return (
    <div
      className={`nearby-locality-card aeris-card aeris-card-hover animate-slide-up ${expanded ? "expanded" : ""}`}
      style={{ "--locality-accent": aqiColor }}
    >
      {/* Main row */}
      <div
        className="nearby-locality-row"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {/* Rank */}
        <div className={`nearby-rank ${isClean ? "rank-clean" : "rank-polluted"}`}>#{rank}</div>

        {/* AQI circle */}
        <div className="nearby-aqi-circle" style={{ background: `${aqiColor}18`, borderColor: `${aqiColor}50` }}>
          <span className="nearby-aqi-num data-mono" style={{ color: aqiColor }}>{locality.aqi}</span>
          <span className="nearby-aqi-label">AQI</span>
        </div>

        {/* Info */}
        <div className="nearby-locality-info">
          <div className="nearby-locality-heading">
            <span className="nearby-locality-icon">{getLocalityIcon(locality)}</span>
            <div>
              <span className="nearby-locality-name">{locality.name}</span>
              {subtitle && <div className="nearby-locality-subtitle">{subtitle}</div>}
            </div>
          </div>
          <div className="nearby-locality-summary">{summary}</div>
          <div className="nearby-locality-meta">
            {tags.map((tag) => (
              <span key={tag} className="nearby-insight-tag">{tag}</span>
            ))}
            <span className="nearby-category-badge" style={{ background: `${aqiColor}18`, color: aqiColor, borderColor: `${aqiColor}40` }}>
              {locality.category || getAQICategory(locality.aqi)}
            </span>
          </div>
        </div>

        {/* Right column */}
        <div className="nearby-locality-right">
          {/* Dominant pollutant */}
          <div className="nearby-dominant-chip">
            <span className="nearby-dominant-label">Dominant</span>
            <span className="nearby-dominant-val">{locality.dominant || "PM2.5"}</span>
          </div>
          {/* Trend */}
          <div className="nearby-trend" style={{ color: trend.color }}>
            <span className="nearby-trend-icon">{trend.icon}</span>
            <span className="nearby-trend-text">{trend.label}</span>
          </div>
          {/* Distance */}
          {locality.distance_km != null && (
            <div className="nearby-distance">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 11.5 7.35 11.76a1 1 0 0 0 1.3 0C12.95 21.5 20 15.4 20 10a8 8 0 0 0-8-8z"/>
              </svg>
              {locality.distance_km} km
            </div>
          )}
          {/* Expand toggle */}
          <div className={`nearby-expand-icon ${expanded ? "open" : ""}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Expandable insight panel */}
      {expanded && <LocalityInsightPanel locality={locality} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RankingList — ordered list (cleanest or most polluted)
// ─────────────────────────────────────────────────────────────────────────────
function RankingList({ title, icon, localities, variant, emptyMsg }) {
  if (!localities || localities.length === 0) {
    return (
      <div className="nearby-ranking-panel aeris-card">
        <div className="nearby-ranking-header">
          <span className="nearby-ranking-icon">{icon}</span>
          <div>
            <div className="eyebrow" style={{ marginBottom: "0.2rem" }}>Nearby AQI</div>
            <div className="nearby-ranking-title">{title}</div>
          </div>
        </div>
        <div className="nearby-empty">{emptyMsg}</div>
      </div>
    );
  }

  return (
    <div className="nearby-ranking-panel aeris-card">
      <div className="nearby-ranking-header">
        <span className="nearby-ranking-icon">{icon}</span>
        <div>
          <div className="eyebrow" style={{ marginBottom: "0.2rem" }}>Nearby AQI</div>
          <div className="nearby-ranking-title">{title}</div>
        </div>
        <div className="nearby-ranking-count">{localities.length} areas</div>
      </div>
      <div className="nearby-cards-list">
        {localities.map((loc, idx) => (
          <LocalityCard
            key={loc.name}
            locality={loc}
            rank={idx + 1}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LoadingState — skeleton while fetching
// ─────────────────────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="nearby-loading-wrap">
      <div className="nearby-loading-header aeris-card">
        <div className="nearby-spinner-lg" />
        <div>
          <div className="nearby-loading-title">Discovering nearby localities…</div>
          <div className="nearby-loading-sub">Fetching air quality data for areas within 50 km</div>
        </div>
      </div>
      <div className="nearby-skeleton-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aeris-card skeleton" style={{ height: "90px", borderRadius: "14px" }} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NearbyAQIRanking — top-level export
// ─────────────────────────────────────────────────────────────────────────────
export default function NearbyAQIRanking({ lat: propLat, lon: propLon, city: propCity }) {
  const {
    permissionState, localities, centerCity,
    loading, usingFallback, dataSource, error,
    requestLocation, loadHyderabadDemo,
  } = useNearbyAQI(propLat, propLon, propCity);

  // Derive cleanest / most polluted lists from sorted localities
  const { cleanest, mostPolluted } = useMemo(() => {
    if (!localities || localities.length === 0) return { cleanest: [], mostPolluted: [] };
    const sorted = [...localities].sort((a, b) => a.aqi - b.aqi);
    return {
      cleanest: sorted.slice(0, 5),
      mostPolluted: sorted.slice(-5).reverse(),
    };
  }, [localities]);

  

  return (
    <div className="nearby-root animate-fade-in">
      {/* Module header */}
      <div className="nearby-module-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: "0.35rem" }}>Environmental Intelligence</div>
          <h3 className="nearby-module-title">Nearby AQI Ranking</h3>
          <p className="nearby-module-desc">
            Discover, compare, and understand air quality across localities within 50 km of your position.
          </p>
        </div>
        {centerCity && (
          <div className="nearby-center-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 11.5 7.35 11.76a1 1 0 0 0 1.3 0C12.95 21.5 20 15.4 20 10a8 8 0 0 0-8-8z"/>
            </svg>
            {centerCity}
            {usingFallback && <span className="nearby-fallback-chip">Demo</span>}
          </div>
        )}
      </div>

      {/* Permission prompt */}
      {permissionState === "idle" && (
        <PermissionPrompt
          onRequest={requestLocation}
          onDemo={loadHyderabadDemo}
          requesting={false}
          error={null}
        />
      )}

      {permissionState === "requesting" && (
        <PermissionPrompt
          onRequest={requestLocation}
          onDemo={loadHyderabadDemo}
          requesting={true}
          error={null}
        />
      )}

      {permissionState === "denied" && (
        <PermissionPrompt
          onRequest={requestLocation}
          onDemo={loadHyderabadDemo}
          requesting={false}
          error={error || "Location access was denied. Try the Hyderabad demo instead."}
        />
      )}

      {/* Loading state */}
      {(permissionState === "granted" || permissionState === "error") && loading && (
        <LoadingState />
      )}

      {/* Data fallback notice */}
      {!loading && usingFallback && localities.length > 0 && (
        <div className="nearby-fallback-notice">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Live nearby data was unavailable for this location. Showing Hyderabad locality data for demonstration.
          Composition values are derived from known area characteristics — not real-time measurements.
        </div>
      )}

      {/* Ranking grids */}
      {!loading && localities.length > 0 && (
        <>
          {/* Summary stats bar */}
          <div className="nearby-stats-bar aeris-card">
            {[
              { label: "Areas Analyzed", val: localities.length },
              { label: "Cleanest AQI", val: cleanest[0]?.aqi ?? "—", color: getAQIColor(cleanest[0]?.aqi) },
              { label: "Most Polluted AQI", val: mostPolluted[0]?.aqi ?? "—", color: getAQIColor(mostPolluted[0]?.aqi) },
              {
                label: "Data Source",
                val: usingFallback ? "Demo Fallback" : (dataSource || "Open-Meteo"),
              },
            ].map(({ label, val, color }) => (
              <div key={label} className="nearby-stat-item">
                <div className="nearby-stat-label">{label}</div>
                <div className="nearby-stat-val data-mono" style={color ? { color } : {}}>
                  {val}
                </div>
              </div>
            ))}
          </div>

          <div className="nearby-ranking-grid">
            <RankingList
              title="Cleanest Areas Nearby"
              icon="🌿"
              localities={cleanest}
              variant="clean"
              emptyMsg="No clean areas found in this radius."
            />
            <RankingList
              title="Most Polluted Areas"
              icon="⚠️"
              localities={mostPolluted}
              variant="polluted"
              emptyMsg="No heavily polluted areas found in this radius."
            />
          </div>

          {/* Click-to-expand hint */}
          <div className="nearby-expand-hint">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            Click any locality card to expand environmental analytics and source insights
          </div>
        </>
      )}
    </div>
  );
}
