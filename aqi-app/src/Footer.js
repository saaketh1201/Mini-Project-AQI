import React from "react";

const LINKS = [
  { label: "WHO Air Quality Guidelines",   href: "https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health" },
  { label: "US EPA AQI Basics",            href: "https://www.airnow.gov/aqi/aqi-basics/" },
  { label: "IQAir AirVisual API", href: "https://www.iqair.com/us/air-pollution-data-api" },
  { label: "IQAir World Rankings",         href: "https://www.iqair.com/world-most-polluted-countries" },
];

export default function Footer() {
  return (
    <footer
      style={{
        marginTop: "4rem",
        paddingTop: "2rem",
        borderTop: "1px solid var(--color-border-subtle)",
        display: "flex",
        flexWrap: "wrap",
        gap: "1.5rem",
        alignItems: "flex-start",
        justifyContent: "space-between",
        paddingBottom: "2rem",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.625rem" }}>
          <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="var(--color-accent)" strokeWidth="1.5" />
            <circle cx="14" cy="14" r="2.5" fill="var(--color-accent)" />
          </svg>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
            aeris
          </span>
        </div>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", maxWidth: "300px", lineHeight: 1.6, margin: 0 }}>
          Environmental intelligence platform. AQI calculations follow US EPA standards. Data via IQAir.
        </p>
      </div>

      <div>
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.75rem", fontFamily: "var(--font-mono)" }}>
          References
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "0.8125rem",
                color: "var(--color-text-muted)",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => e.target.style.color = "var(--color-accent)"}
              onMouseLeave={(e) => e.target.style.color = "var(--color-text-muted)"}
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", alignSelf: "flex-end" }}>
        AQI scale: US EPA · Forecast: Facebook Prophet · Map: OpenStreetMap
      </div>
    </footer>
  );
}
