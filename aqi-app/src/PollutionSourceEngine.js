import React, { useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Source Icons (SVG paths)
// ─────────────────────────────────────────────────────────────────────────────
const SOURCE_ICONS = {
  traffic: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="2"/><path d="m16 8 4 1 2 4v3h-2"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  construction: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h20"/><path d="m6 20 4-10 4 10"/><path d="M14 20V8l2-2 4 4-4 4v6"/><path d="M6 10 4 8l4-4 2 2"/>
    </svg>
  ),
  biomass: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c0 6-4 10-4 10h8S12 8 12 2z"/><path d="M8 22c0-4 4-4 4-8 0 4 4 4 4 8"/><line x1="12" y1="22" x2="12" y2="12"/>
    </svg>
  ),
  industrial: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h20V10L14 4l-4 6-3-2v12z"/><path d="M6 20v-4h4v4"/><circle cx="17" cy="13" r="1"/>
    </svg>
  ),
  dust: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12H3"/><path d="M21 6H6"/><path d="M21 18H9"/>
    </svg>
  ),
  diesel: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H14"/><path d="M7 21v-6.5A3.5 3.5 0 0 1 10.5 11H11V8a3 3 0 1 0-6 0v3h.5A3.5 3.5 0 0 1 9 14.5v.5"/><path d="M5 21h14"/>
    </svg>
  ),
  photochemical: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  coal: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Source definitions — heuristic rules and metadata
// ─────────────────────────────────────────────────────────────────────────────
const SOURCE_DEFINITIONS = [
  {
    id: "traffic",
    name: "Traffic Congestion",
    icon: "traffic",
    pollutants: ["NO₂", "CO"],
    language: "Likely contributor",
    causes: ["Vehicle exhaust emissions", "Traffic intersection buildup", "Urban road networks"],
    confidence: (c) => {
      const no2 = c.no2 || 0, co = c.co || 0;
      if (no2 < 10 && co < 500) return 0;
      return Math.min(95, 15 + (no2 / 25) * 35 + (co / 2000) * 25);
    },
  },
  {
    id: "construction",
    name: "Construction Activity",
    icon: "construction",
    pollutants: ["PM10", "PM2.5"],
    language: "Possible source",
    causes: ["Earthmoving & excavation", "Building demolition debris", "Cement & concrete dust"],
    confidence: (c) => {
      const pm10 = c.pm10 || 0, pm25 = c.pm2_5 || 0;
      if (pm10 < 20) return 0;
      const ratio = pm25 > 0 ? pm10 / pm25 : 1;
      return Math.min(90, 10 + (pm10 / 45) * 40 + (ratio > 2 ? 15 : 0));
    },
  },
  {
    id: "biomass",
    name: "Biomass / Open Burning",
    icon: "biomass",
    pollutants: ["PM2.5", "CO"],
    language: "Commonly associated with",
    causes: ["Agricultural stubble burning", "Crop residue combustion", "Biomass cooking fires", "Waste incineration"],
    confidence: (c) => {
      const pm25 = c.pm2_5 || 0, co = c.co || 0, pm10 = c.pm10 || 0;
      if (pm25 < 15) return 0;
      const fineRatio = pm10 > 0 ? pm25 / pm10 : 0;
      return Math.min(90, 10 + (pm25 / 35) * 45 + (fineRatio > 0.5 ? 15 : 0) + (co > 1000 ? 10 : 0));
    },
  },
  {
    id: "industrial",
    name: "Industrial Emissions",
    icon: "industrial",
    pollutants: ["SO₂", "NO₂", "PM2.5"],
    language: "Possible source",
    causes: ["Manufacturing & smelting", "Chemical processing plants", "Refinery operations"],
    confidence: (c) => {
      const so2 = c.so2 || 0, no2 = c.no2 || 0;
      if (so2 < 15 && no2 < 30) return 0;
      return Math.min(90, 10 + (so2 / 40) * 45 + (no2 / 50) * 20);
    },
  },
  {
    id: "dust",
    name: "Road Dust & Soil Resuspension",
    icon: "dust",
    pollutants: ["PM10", "PM2.5"],
    language: "Commonly associated with",
    causes: ["Unpaved road surfaces", "Wind-resuspended soil particles", "Dry weather conditions", "Low-lying open land"],
    confidence: (c) => {
      const pm10 = c.pm10 || 0, pm25 = c.pm2_5 || 0;
      if (pm10 < 45) return 0;
      const ratio = pm25 > 0 ? pm10 / pm25 : 1;
      return Math.min(85, 10 + (pm10 / 80) * 50 + (ratio > 2.5 ? 15 : 0));
    },
  },
  {
    id: "diesel",
    name: "Diesel Vehicle Exhaust",
    icon: "diesel",
    pollutants: ["NO₂", "PM2.5", "CO"],
    language: "Likely contributor",
    causes: ["Heavy goods vehicles", "Buses & public transport", "Diesel generators", "Port & freight activity"],
    confidence: (c) => {
      const no2 = c.no2 || 0, co = c.co || 0, pm25 = c.pm2_5 || 0;
      if (no2 < 20 && co < 800) return 0;
      return Math.min(88, 10 + (no2 / 40) * 38 + (co / 1000) * 18 + (pm25 > 25 ? 10 : 0));
    },
  },
  {
    id: "photochemical",
    name: "Photochemical Smog",
    icon: "photochemical",
    pollutants: ["O₃", "NO₂"],
    language: "Commonly associated with",
    causes: ["Strong sunlight & UV radiation", "NOx + VOC photochemical reactions", "Warm, stagnant air masses", "High-traffic urban basins"],
    confidence: (c) => {
      const o3 = c.o3 || 0, no2 = c.no2 || 0;
      if (o3 < 60) return 0;
      return Math.min(90, 10 + (o3 / 100) * 60 + (no2 > 30 ? 10 : 0));
    },
  },
  {
    id: "coal",
    name: "Coal & Thermal Power",
    icon: "coal",
    pollutants: ["SO₂", "PM2.5", "NO₂"],
    language: "Possible source",
    causes: ["Coal-fired power stations", "Domestic coal heating", "Coking & steel production", "Thermal industrial furnaces"],
    confidence: (c) => {
      const so2 = c.so2 || 0, pm25 = c.pm2_5 || 0;
      if (so2 < 40) return 0;
      return Math.min(92, 10 + (so2 / 60) * 58 + (pm25 > 35 ? 12 : 0));
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic inference engine
// ─────────────────────────────────────────────────────────────────────────────
export function inferSources(composition) {
  if (!composition) return [];

  return SOURCE_DEFINITIONS
    .map((src) => ({
      ...src,
      confidenceScore: Math.round(src.confidence(composition)),
    }))
    .filter((src) => src.confidenceScore >= 25)
    .sort((a, b) => b.confidenceScore - a.confidenceScore);
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence badge color
// ─────────────────────────────────────────────────────────────────────────────
function getConfidenceStyle(score) {
  if (score >= 75) return { bg: "rgba(239,68,68,0.12)", color: "#EF4444", border: "rgba(239,68,68,0.25)" };
  if (score >= 55) return { bg: "rgba(249,115,22,0.12)", color: "#F97316", border: "rgba(249,115,22,0.25)" };
  if (score >= 40) return { bg: "rgba(234,179,8,0.12)", color: "#EAB308", border: "rgba(234,179,8,0.25)" };
  return { bg: "rgba(74,158,255,0.12)", color: "#4A9EFF", border: "rgba(74,158,255,0.25)" };
}

// ─────────────────────────────────────────────────────────────────────────────
// SourceCard — a single inferred pollution source
// ─────────────────────────────────────────────────────────────────────────────
function SourceCard({ source, rank }) {
  const { name, icon, pollutants, language, causes, confidenceScore } = source;
  const confStyle = getConfidenceStyle(confidenceScore);

  return (
    <div className="pse-source-card aeris-card aeris-card-hover animate-slide-up">
      <div className="pse-source-header">
        <div className="pse-source-rank">#{rank}</div>
        <div className="pse-source-icon-wrap">
          {SOURCE_ICONS[icon]}
        </div>
        <div className="pse-source-meta">
          <div className="pse-source-name">{name}</div>
          <div className="pse-source-language">{language}</div>
        </div>
        <div
          className="pse-confidence-badge"
          style={{ background: confStyle.bg, color: confStyle.color, borderColor: confStyle.border }}
        >
          {confidenceScore}%
        </div>
      </div>

      {/* Confidence bar */}
      <div className="pse-conf-bar-track">
        <div
          className="pse-conf-bar-fill"
          style={{ width: `${confidenceScore}%`, background: `linear-gradient(90deg, ${confStyle.color}80, ${confStyle.color})` }}
        />
      </div>

      {/* Associated pollutants */}
      <div className="pse-pollutant-tags">
        {pollutants.map((p) => (
          <span key={p} className="pse-pollutant-tag">{p}</span>
        ))}
      </div>

      {/* Possible causes list */}
      <ul className="pse-causes-list">
        {causes.map((cause) => (
          <li key={cause} className="pse-cause-item">
            <span className="pse-cause-bullet">•</span>
            {cause}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SourceSummaryChips — the top-level "quick glance" chip row
// ─────────────────────────────────────────────────────────────────────────────
function SourceSummaryChips({ sources }) {
  return (
    <div className="pse-summary-chips">
      {sources.slice(0, 4).map((src) => {
        const confStyle = getConfidenceStyle(src.confidenceScore);
        return (
          <div key={src.id} className="pse-summary-chip" style={{ borderColor: confStyle.border }}>
            <span className="pse-chip-icon">{SOURCE_ICONS[src.icon]}</span>
            <span className="pse-chip-name">{src.name}</span>
            <span className="pse-chip-score" style={{ color: confStyle.color }}>{src.confidenceScore}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PollutionSourcePanel — top-level export
// ─────────────────────────────────────────────────────────────────────────────
export default function PollutionSourcePanel({ composition }) {
  const sources = useMemo(() => inferSources(composition), [composition]);

  return (
    <div className="pse-root animate-fade-in">
      {/* Panel header */}
      <div className="pse-panel-header aeris-card">
        <div className="pse-panel-header-inner">
          <div>
            <div className="eyebrow" style={{ marginBottom: "0.3rem" }}>Heuristic Analysis</div>
            <h3 className="pse-panel-title">Likely Pollution Sources</h3>
            <p className="pse-panel-desc">
              Inferred from pollutant composition using environmental heuristics.
              Results indicate probable contributors — not confirmed facts.
            </p>
          </div>
          <div className="pse-disclaimer-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Probabilistic model
          </div>
        </div>

        {sources.length > 0 ? (
          <SourceSummaryChips sources={sources} />
        ) : (
          <div className="pse-panel-empty">
            Insufficient pollutant data to infer likely sources for this location.
          </div>
        )}
      </div>

      {/* Source cards grid */}
      {sources.length > 0 && (
        <div className="pse-sources-grid">
          {sources.map((src, idx) => (
            <SourceCard key={src.id} source={src} rank={idx + 1} />
          ))}
        </div>
      )}

      {/* Scientific note */}
      <div className="pse-scientific-note">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Confidence scores are calculated from pollutant composition ratios relative to WHO guidelines. Higher scores indicate stronger statistical association with the source type. This is a heuristic model — on-ground measurements and receptor modeling are required for authoritative source attribution.
      </div>
    </div>
  );
}
