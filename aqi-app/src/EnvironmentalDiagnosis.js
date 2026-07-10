import React, { useMemo } from "react";

// Simple thresholds used for heuristic scoring (µg/m³)
const THRESHOLDS = {
  pm2_5: 12,
  pm10: 54,
  no2: 100,
  so2: 196,
  o3: 140,
  co: 10000,
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

function round1(v) { return Math.round(v * 10) / 10; }

function getDominant(composition = {}) {
  let best = { key: null, ratio: 0, value: 0 };
  Object.entries(composition).forEach(([k, v]) => {
    if (v == null) return;
    const thr = THRESHOLDS[k] || 1;
    const ratio = thr > 0 ? v / thr : 0;
    if (ratio > best.ratio) best = { key: k, ratio, value: v };
  });
  return best;
}

function buildCauses(dom, comp) {
  const causes = new Set();
  const { key, ratio } = dom || {};

  if (!dom || !key) return causes;

  if (key === "pm2_5") {
    if (ratio >= 3) causes.add("Combustion emissions (vehicles, biomass, or industrial sources)");
    else causes.add("Urban combustion and traffic-related emissions");
  }

  if (key === "pm10") {
    causes.add("Resuspended road dust, construction, or unpaved surfaces");
  }

  if (comp.no2 != null && comp.no2 / THRESHOLDS.no2 > 1) {
    causes.add("High vehicle exhaust / traffic congestion");
  }

  if (comp.so2 != null && comp.so2 / THRESHOLDS.so2 > 0.5) {
    causes.add("Industrial or fuel-combustion sources (possible SO₂ contribution)");
  }

  if (comp.o3 != null && comp.o3 / THRESHOLDS.o3 > 0.8) {
    causes.add("Photochemical smog formation (ozone-driven)");
  }

  return Array.from(causes);
}

function healthRecommendationFromAqi(aqi) {
  if (aqi == null) return { text: "Data limited — take usual precautions.", short: "Unknown" };
  if (aqi >= 301) return { text: "Hazardous — avoid outdoor activity and seek shelter.", short: "Not Recommended" };
  if (aqi >= 201) return { text: "Very unhealthy — minimise outdoor exposure; sensitive groups should remain indoors.", short: "Not Recommended" };
  if (aqi >= 151) return { text: "Unhealthy — reduce prolonged outdoor exertion, especially for sensitive groups.", short: "Not Recommended" };
  if (aqi >= 101) return { text: "Unhealthy for sensitive groups — consider limiting prolonged outdoor activity.", short: "Caution" };
  if (aqi >= 51) return { text: "Moderate — unusually sensitive individuals may wish to reduce prolonged exertion.", short: "Caution" };
  return { text: "Air quality is satisfactory for the general population.", short: "Allowed" };
}

export default function EnvironmentalDiagnosis({ composition = {}, aqi = null, city = null }) {
  const diagnosis = useMemo(() => {
    const dom = getDominant(composition);
    const causes = buildCauses(dom, composition);

    // Confidence heuristic: based on number of pollutant signals and dominant ratio
    const presentCount = Object.values(composition).filter((v) => v != null).length;
    const confidence = Math.min(95, Math.max(45, Math.round(50 + Math.min(30, dom.ratio * 8) + presentCount * 4)));

    // Health guidance derived from AQI
    const health = healthRecommendationFromAqi(aqi);

    // Compose explanation (avoid generic text; include numbers where available)
    const expl = [];
    if (dom && dom.key) {
      const label = dom.key === "pm2_5" ? "PM2.5" : dom.key === "pm10" ? "PM10" : dom.key.toUpperCase();
      expl.push(`Today's AQI is mainly influenced by elevated ${label} concentrations.`);
      if (dom.value != null && THRESHOLDS[dom.key]) {
        const times = round1(dom.value / THRESHOLDS[dom.key]);
        expl.push(`${label} is approximately ${times}× higher than the guideline used for screening.`);
      }
    } else {
      expl.push("Pollutant composition is incomplete — diagnosis is limited.");
    }

    // Summarize other notable pollutants (mention low/within-limits where sensible)
    const others = [];
    Object.entries(composition).forEach(([k, v]) => {
      if (!v || !THRESHOLDS[k]) return;
      if (k === (dom && dom.key)) return;
      const ratio = v / THRESHOLDS[k];
      if (ratio >= 2.0) others.push(`${k.toUpperCase()} is also elevated`);
      else if (ratio < 0.9) others.push(`${k.toUpperCase()} remains within typical limits`);
      else others.push(`${k.toUpperCase()} is moderately elevated`);
    });
    if (others.length) expl.push(others.join('. ') + '.');

    if (causes.length) {
      const phr = causes.length === 1 ? causes[0] : `${causes.slice(0,2).join('; ')} (among others)`;
      expl.push(`This pollution pattern is commonly associated with ${phr}.`);
    }

    // Targeted advice
    if (aqi != null) {
      if (aqi > 150) expl.push(`Sensitive individuals should avoid prolonged outdoor activity until conditions improve.`);
      else if (aqi > 100) expl.push(`Consider reducing outdoor exertion during peak hours.`);
      else expl.push(`General population may continue normal outdoor activities; monitor conditions.`);
    }

    const explanation = expl.join(' ');
    const sentences = explanation.split('. ').filter(Boolean);
    const shortExplanation = sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '...' : '');
    return { dom, causes, confidence, health, explanation, shortExplanation };
  }, [composition, aqi]);

  const labelMap = { pm2_5: 'PM2.5', pm10: 'PM10', no2: 'NO₂', so2: 'SO₂', o3: 'O₃', co: 'CO', nh3: 'NH₃' };

  return (
    <div className="env-diag-card aeris-card animate-slide-up">
      <div className="env-diag-header">
        <div>
          <div className="eyebrow">Environmental Diagnosis</div>
          <h3 className="env-diag-title">{city ? `${city} · Diagnosis` : 'Environmental Diagnosis'}</h3>
          {diagnosis.dom && diagnosis.dom.key && WHO_GUIDELINES[diagnosis.dom.key] != null && (
            <div className="env-diag-safe">
              {labelMap[diagnosis.dom.key] || diagnosis.dom.key.toUpperCase()} WHO safe: <strong>&lt;{WHO_GUIDELINES[diagnosis.dom.key]} µg/m³</strong>
            </div>
          )}
        </div>
        <div className="env-diag-confidence">
          <div className="env-diag-confidence-val">{diagnosis.confidence}%</div>
          <div className="env-diag-confidence-label">Confidence</div>
        </div>
      </div>

      <div className="env-diag-grid">
        <div className="env-diag-main">
          <div className="env-diag-key">Main Contributor</div>
          <div className="env-diag-value">{diagnosis.dom && diagnosis.dom.key ? (labelMap[diagnosis.dom.key] || diagnosis.dom.key.toUpperCase()) : 'Unknown'}</div>
        </div>

        <div className="env-diag-main">
          <div className="env-diag-key">Likely Cause</div>
          <div className="env-diag-value">{diagnosis.causes.length ? diagnosis.causes[0] : 'Multiple / unclear sources'}</div>
        </div>

        <div className="env-diag-main">
          <div className="env-diag-key">Health Risk</div>
          <div className="env-diag-value">{diagnosis.health.short}</div>
        </div>

        <div className="env-diag-main">
          <div className="env-diag-key">Outdoor Activity</div>
          <div className="env-diag-value">{diagnosis.health.short === 'Not Recommended' ? 'Not Recommended' : diagnosis.health.short === 'Caution' ? 'Use Caution' : 'Allowed'}</div>
        </div>
      </div>

      <div className="env-diag-explanation">
        {diagnosis.shortExplanation}
        {diagnosis.explanation !== diagnosis.shortExplanation && (
          <div style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
            Detailed analysis is available in the Pollution Intelligence tab.
          </div>
        )}
      </div>
    </div>
  );
}
