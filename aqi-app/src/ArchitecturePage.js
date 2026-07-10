import React from "react";

const blocks = [
  { title: "User", body: "City search, dashboard navigation, and comparison requests" },
  { title: "React Frontend", body: "Interactive dashboard, charts, heatmap, and comparison experience" },
  { title: "Flask API", body: "Routes for AQI, ranking, comparison, and report generation" },
  { title: "Cache Layer", body: "TTL-based caching for geocoding and route responses" },
  { title: "Background Scheduler", body: "Refreshes ranking and heatmap city data in the background" },
  { title: "Data Providers", body: "IQAir, AQI.in, Open-Meteo, and fallback logic" },
  { title: "Analytics Engine", body: "Pollutant analysis, forecasting, and ERS scoring" },
  { title: "Decision Support", body: "Rule-based environmental summaries and KPI generation" },
];

export default function ArchitecturePage() {
  return (
    <div style={{ maxWidth: "1180px", margin: "0 auto", padding: "2rem 1.5rem 3rem" }}>
      <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>System architecture</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.6rem, 3vw, 2.2rem)", letterSpacing: "-0.03em", color: "var(--color-text-primary)", margin: "0 0 0.75rem" }}>
        Platform flow and engineering structure
      </h2>
      <p style={{ fontSize: "0.95rem", color: "var(--color-text-secondary)", lineHeight: 1.7, marginBottom: "1.5rem" }}>
        The platform is structured as a layered environmental intelligence system: the frontend collects user context, the backend aggregates data, and the analytics layer transforms that data into comparison, forecasting, and decision-support outputs.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        {blocks.map((block, index) => (
          <div key={block.title} className="aeris-card" style={{ padding: "1.15rem", background: index % 2 === 0 ? "var(--color-bg-overlay)" : "var(--color-bg-elevated)" }}>
            <div className="eyebrow" style={{ marginBottom: "0.45rem" }}>Layer {index + 1}</div>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1rem", color: "var(--color-text-primary)", margin: "0 0 0.45rem" }}>{block.title}</h3>
            <p style={{ fontSize: "0.86rem", color: "var(--color-text-secondary)", lineHeight: 1.6, margin: 0 }}>{block.body}</p>
          </div>
        ))}
      </div>

      <div className="aeris-card" style={{ marginTop: "1.5rem", padding: "1.25rem 1.4rem" }}>
        <div className="eyebrow" style={{ marginBottom: "0.35rem" }}>Flow summary</div>
        <div style={{ fontSize: "0.92rem", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
          User requests flow into the React interface, are handled by the Flask API, cached for speed, enriched by background refresh jobs, and then passed through the analytics engine to produce AQI, risk, forecasting, and decision-support outputs.
        </div>
      </div>
    </div>
  );
}
