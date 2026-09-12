import React from "react";

const blocks = [
  { title: "City search", body: "Accepts a city or area, geocodes it, and starts a complete environmental analysis." },
  { title: "AQI providers", body: "Combines configured live providers with Open-Meteo pollutant measurements and transparent source labels." },
  { title: "Annual history", body: "Aggregates the previous 12 complete months of PM2.5 into monthly AQI estimates for tourism timing." },
  { title: "Geographic context", body: "Uses curated city geography plus a cached OpenStreetMap fallback for industrial areas, traffic corridors, and water bodies." },
  { title: "Analytics engine", body: "Calculates dominant pollutants, source signatures, trends, health guidance, and the Environmental Risk Score." },
  { title: "City intelligence", body: "Presents pollution sources, factories, traffic corridors, water features, health advice, and best times to visit." },
  { title: "Caching", body: "Stores complete city responses and heatmap snapshots so repeat searches are fast and provider load is controlled." },
  { title: "Frontend experience", body: "React renders the dashboard, reports, comparison tools, heatmap, nearby rankings, and Understand AQI guide." },
];

export default function ArchitecturePage() {
  return (
    <div style={{ maxWidth: "1180px", margin: "0 auto", padding: "2rem 1.5rem 3rem" }}>
      <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>System architecture</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.6rem, 3vw, 2.2rem)", letterSpacing: "-0.03em", color: "var(--color-text-primary)", margin: "0 0 0.75rem" }}>
        Platform flow and engineering structure
      </h2>
      <p style={{ fontSize: "0.95rem", color: "var(--color-text-secondary)", lineHeight: 1.7, marginBottom: "1.5rem" }}>
        Aeris turns a searched location into a traceable environmental brief. A first uncached search may take up to 90 seconds while it gathers AQI, twelve months of history, geographic context, and tourism timing. The complete response is then cached for fast repeat visits.
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
        <div className="eyebrow" style={{ marginBottom: "0.35rem" }}>Reliability principles</div>
        <ul style={{ fontSize: "0.92rem", color: "var(--color-text-secondary)", lineHeight: 1.7, margin: 0, paddingLeft: "1.2rem" }}>
          <li>Measured AQI and pollutant values are kept separate from inferred pollution sources.</li>
          <li>Geographic names are shown only when available from curated or mapped data; the system does not invent factories or roads.</li>
          <li>Tourism recommendations show the monthly AQI evidence and explain when history is incomplete.</li>
          <li>Cached responses reduce repeat latency while preserving the source and update metadata.</li>
        </ul>
      </div>
    </div>
  );
}
