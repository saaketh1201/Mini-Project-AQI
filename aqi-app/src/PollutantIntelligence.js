import React, { useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// WHO 2021 Air Quality Guidelines (annual / 24-hr means in µg/m³)
// ─────────────────────────────────────────────────────────────────────────────
export const WHO_GUIDELINES = {
  pm2_5: { label: "PM2.5",  unit: "µg/m³", who: 15,    desc: "Fine particulate matter",   note: "24-hr mean" },
  pm10:  { label: "PM10",   unit: "µg/m³", who: 45,    desc: "Coarse particulate matter", note: "24-hr mean" },
  no2:   { label: "NO₂",    unit: "µg/m³", who: 25,    desc: "Nitrogen dioxide",          note: "24-hr mean" },
  so2:   { label: "SO₂",    unit: "µg/m³", who: 40,    desc: "Sulfur dioxide",            note: "24-hr mean" },
  o3:    { label: "O₃",     unit: "µg/m³", who: 100,   desc: "Ground-level ozone",        note: "peak-season" },
  co:    { label: "CO",     unit: "µg/m³", who: 4000,  desc: "Carbon monoxide",           note: "24-hr mean" },
  nh3:   { label: "NH₃",    unit: "µg/m³", who: 100,   desc: "Ammonia",                   note: "guideline" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Health badge logic (ratio = value / WHO threshold)
// ─────────────────────────────────────────────────────────────────────────────
function getHealthBadge(ratio) {
  if (ratio < 0.5)  return { label: "Excellent", cls: "pi-badge-excellent" };
  if (ratio < 1.0)  return { label: "Good",      cls: "pi-badge-good"      };
  if (ratio < 2.0)  return { label: "Moderate",  cls: "pi-badge-moderate"  };
  if (ratio < 4.0)  return { label: "Poor",      cls: "pi-badge-poor"      };
  return              { label: "Severe",    cls: "pi-badge-severe"    };
}

function getBarColor(ratio) {
  if (ratio < 0.5)  return "#22C55E";
  if (ratio < 1.0)  return "#84CC16";
  if (ratio < 2.0)  return "#EAB308";
  if (ratio < 4.0)  return "#F97316";
  return "#EF4444";
}

// ─────────────────────────────────────────────────────────────────────────────
// EPA AQI sub-index calculators (replicated from backend for frontend use)
// ─────────────────────────────────────────────────────────────────────────────
function linearAQI(val, cLow, cHigh, iLow, iHigh) {
  return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (val - cLow) + iLow);
}

function subAQI(key, value) {
  if (value == null || value < 0) return 0;
  const breakpoints = {
    pm2_5: [[0,12,0,50],[12.1,35.4,51,100],[35.5,55.4,101,150],[55.5,150.4,151,200],[150.5,250.4,201,300],[250.5,350.4,301,400],[350.5,500.4,401,500]],
    pm10:  [[0,54,0,50],[55,154,51,100],[155,254,101,150],[255,354,151,200],[355,424,201,300],[425,504,301,400],[505,604,401,500]],
    no2:   [[0,100,0,50],[101,189,51,100],[190,677,101,150],[678,1221,151,200],[1222,2350,201,300],[2351,3100,301,400],[3101,3853,401,500]],
    o3:    [[0,108,0,50],[109,140,51,100],[141,170,101,150],[171,210,151,200],[211,400,201,300]],
    so2:   [[0,93,0,50],[94,196,51,100],[197,484,101,150],[485,796,151,200],[797,1583,201,300],[1584,2105,301,400],[2106,2630,401,500]],
    co:    [[0,5000,0,50],[5001,10000,51,100],[10001,14286,101,150],[14287,17143,151,200],[17144,34286,201,300],[34287,45714,301,400],[45715,57143,401,500]],
    nh3:   [[0,100,0,50],[101,200,51,100],[201,400,101,150],[401,800,151,200],[801,1200,201,300]],
  };
  const bps = breakpoints[key];
  if (!bps) return 0;
  for (const [cLow, cHigh, iLow, iHigh] of bps) {
    if (value >= cLow && value <= cHigh) return linearAQI(value, cLow, cHigh, iLow, iHigh);
  }
  return value > bps[bps.length - 1][1] ? 500 : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compute all sub-AQIs and contributions from composition
// ─────────────────────────────────────────────────────────────────────────────
export function computePollutantMetrics(composition) {
  const keys = Object.keys(WHO_GUIDELINES);
  const metrics = {};
  let totalSubAQI = 0;

  for (const key of keys) {
    const value = composition?.[key];
    if (value == null) continue;
    const meta = WHO_GUIDELINES[key];
    const ratio = value / meta.who;
    const sa = subAQI(key, value);
    metrics[key] = { key, value, ratio, subAQI: sa, ...meta };
    totalSubAQI += sa;
  }

  const maxRatio = Object.values(metrics).reduce((max, metric) => Math.max(max, metric.ratio), 0);

  // Compute contribution percentages
  for (const key of Object.keys(metrics)) {
    metrics[key].contribution = totalSubAQI > 0
      ? Math.round((metrics[key].subAQI / totalSubAQI) * 100)
      : 0;
  }

  // Dominant pollutant = highest sub-AQI
  const dominant = Object.values(metrics).sort((a, b) => b.subAQI - a.subAQI)[0] || null;

  return { metrics, dominant, totalSubAQI, maxRatio };
}

// ─────────────────────────────────────────────────────────────────────────────
// PollutantCard — individual card for one pollutant
// ─────────────────────────────────────────────────────────────────────────────
function PollutantCard({ data, maxRatio }) {
  const { label, unit, value, ratio, who, desc, note } = data;
  const badge = getHealthBadge(ratio);
  const barColor = getBarColor(ratio);
  const normalizedMax = Math.max(maxRatio, 1);
  const barWidth = Math.min((ratio / normalizedMax) * 100, 100);

  return (
    <div className="pi-pollutant-card aeris-card aeris-card-hover animate-slide-up">
      <div className="pi-card-header">
        <div>
          <div className="pi-pollutant-name">{label}</div>
          <div className="pi-pollutant-desc">{desc}</div>
        </div>
        <span className={`pi-badge ${badge.cls}`}>{badge.label}</span>
      </div>

      <div className="pi-value-row">
        <div className="pi-value-main">
          <span className="pi-value-num data-mono">{Number(value).toFixed(1)}</span>
          <span className="pi-value-unit">{unit}</span>
          {ratio >= 1.0 && (
            <span className="pi-exceedance">{ratio.toFixed(1)}× WHO</span>
          )}
        </div>
        <div className="pi-who-chip">
          <span className="pi-who-label">WHO</span>
          <span className="pi-who-value">&lt;{who} {unit}</span>
          <span className="pi-who-note">{note}</span>
        </div>
      </div>

      <div className="pi-bar-track">
        <div
          className="pi-bar-fill"
          style={{ width: `${barWidth}%`, background: barColor }}
        />
        <div className="pi-bar-who-marker" />
      </div>
      <div className="pi-bar-labels">
        <span style={{ color: barColor, fontSize: "0.7rem", fontWeight: 600 }}>
          {ratio < 1 ? `${Math.round(ratio * 100)}% of WHO limit` : `${ratio.toFixed(1)}× WHO limit`}
        </span>
        <span style={{ color: "var(--color-text-muted)", fontSize: "0.65rem" }}>
          Safe: {who} {unit}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PrimaryDriverCard — highlights the dominant pollutant
// ─────────────────────────────────────────────────────────────────────────────
function PrimaryDriverCard({ dominant }) {
  if (!dominant) return null;

  const { label, value, unit, ratio, who, contribution } = dominant;
  const exceedTimes = ratio.toFixed(1);

  const reason = ratio >= 2
    ? `${label} exceeds WHO guidelines by ${exceedTimes}× and contributes ${contribution}% to today's AQI — the single largest pollution pressure on this city.`
    : ratio >= 1
    ? `${label} is above the WHO safe limit (${Number(value).toFixed(1)} µg/m³ vs. ${who} µg/m³ guideline) and contributes ${contribution}% to the current AQI reading.`
    : `${label} is within WHO limits and is the primary measurable pollutant, contributing ${contribution}% of the total AQI calculation.`;

  return (
    <div className="pi-driver-card aeris-card animate-slide-up">
      <div className="pi-driver-header">
        <div className="pi-driver-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ marginBottom: "0.2rem" }}>Primary AQI Driver</div>
          <div className="pi-driver-subtitle">Dominant pollution factor identified</div>
        </div>
        <div className="pi-driver-contribution-badge">{contribution}% share</div>
      </div>

      <div className="pi-driver-pollutant">
        <div className="pi-driver-pollutant-name">{label}</div>
        <div className="pi-driver-value-row">
          <span className="pi-driver-value data-mono">{Number(value).toFixed(1)}</span>
          <span className="pi-driver-unit">{unit}</span>
          {ratio >= 1 && (
            <span className="pi-driver-exceed">{exceedTimes}× WHO limit</span>
          )}
        </div>
      </div>

      <div className="pi-driver-reason-block">
        <div className="pi-driver-reason-label">Reason</div>
        <div className="pi-driver-reason-text">{reason}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ContributionBars — horizontal bar chart of each pollutant's AQI share
// ─────────────────────────────────────────────────────────────────────────────
function ContributionBars({ metrics }) {
  const sorted = useMemo(() =>
    Object.values(metrics)
      .filter(m => m.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution),
    [metrics]
  );

  if (sorted.length === 0) return null;

  return (
    <div className="pi-contribution-panel aeris-card animate-slide-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: "0.25rem" }}>AQI Breakdown</div>
          <div className="pi-contribution-title">Pollutant Contribution to AQI</div>
        </div>
        <div className="pi-contribution-info">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Based on EPA sub-indices
        </div>
      </div>

      <div className="pi-contribution-list">
        {sorted.map((m) => {
          const color = getBarColor(m.ratio);
          const badge = getHealthBadge(m.ratio);
          return (
            <div key={m.key} className="pi-contrib-row">
              <div className="pi-contrib-label">
                <span className="pi-contrib-name">{m.label}</span>
                <span className={`pi-badge-xs ${badge.cls}`}>{badge.label}</span>
              </div>
              <div className="pi-contrib-bar-wrap">
                <div
                  className="pi-contrib-bar-fill"
                  style={{ width: `${m.contribution}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }}
                />
              </div>
              <div className="pi-contrib-pct" style={{ color }}>{m.contribution}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PollutantIntelligence — top-level export
// ─────────────────────────────────────────────────────────────────────────────
export default function PollutantIntelligence({ composition }) {
  const { metrics, dominant, maxRatio } = useMemo(
    () => computePollutantMetrics(composition),
    [composition]
  );

  const availableKeys = Object.keys(metrics);

  if (availableKeys.length === 0) {
    return (
      <div className="aeris-card animate-fade-in" style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-muted)" }}>
        Detailed pollutant data is not available for this location.
      </div>
    );
  }

  return (
    <div className="pi-root animate-fade-in">
      {/* Primary Driver Card */}
      <PrimaryDriverCard dominant={dominant} />

      {/* Contribution Bars */}
      <ContributionBars metrics={metrics} />

      {/* Per-Pollutant Cards Grid */}
      <div className="pi-section-header">
        <div className="eyebrow" style={{ marginBottom: "0.25rem" }}>Individual Readings</div>
        <div className="pi-section-title">Pollutant Intelligence Dashboard</div>
        <div className="pi-section-sub">Each value compared against WHO 2021 Air Quality Guidelines</div>
      </div>

      <div className="pi-cards-grid">
        {availableKeys.map((key) => (
          <PollutantCard key={key} data={metrics[key]} maxRatio={maxRatio} />
        ))}
      </div>
    </div>
  );
}
