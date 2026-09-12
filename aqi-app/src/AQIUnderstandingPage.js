import React from "react";

const bands = [
  { range: "0–50", label: "Good", color: "#22C55E", meaning: "Air quality is satisfactory and pollution poses little or no risk." },
  { range: "51–100", label: "Moderate", color: "#EAB308", meaning: "Air is generally acceptable, but unusually sensitive people may notice effects." },
  { range: "101–150", label: "Unhealthy for sensitive groups", color: "#F97316", meaning: "Children, older adults, and people with heart or lung disease may be affected." },
  { range: "151–200", label: "Unhealthy", color: "#EF4444", meaning: "Some members of every group may experience health effects." },
  { range: "201–300", label: "Very unhealthy", color: "#A855F7", meaning: "Health alert: the risk of health effects is increased for everyone." },
  { range: "301–500", label: "Hazardous", color: "#7F1D1D", meaning: "Health warning of emergency conditions. Everyone is more likely to be affected." },
];

const pollutants = [
  { name: "PM2.5", fullName: "Fine particulate matter", unit: "µg/m³", source: "Combustion, traffic, industry, and fires", effect: "Tiny particles that can travel deep into the lungs and bloodstream.", weather: "Inversions and calm air trap PM2.5 close to the ground." },
  { name: "PM10", fullName: "Coarse particulate matter", unit: "µg/m³", source: "Road dust, construction, mining, and windblown soil", effect: "Larger particles that irritate the eyes, nose, throat, and airways.", weather: "Dry, windy conditions can lift and resuspend dust." },
  { name: "NO₂", fullName: "Nitrogen dioxide", unit: "µg/m³", source: "Vehicle exhaust, generators, and power plants", effect: "A gas that irritates airways and helps form ozone and particles.", weather: "Low wind and rush-hour traffic increase concentrations." },
  { name: "O₃", fullName: "Ozone", unit: "µg/m³", source: "Created when sunlight reacts with NOx and VOC gases", effect: "A reactive gas that can reduce lung function and aggravate asthma.", weather: "Sunny, hot, stagnant afternoons often increase ozone." },
  { name: "SO₂", fullName: "Sulfur dioxide", unit: "µg/m³", source: "Coal, oil combustion, refineries, and heavy industry", effect: "A sharp-smelling gas that can trigger breathing difficulty and form particles.", weather: "Stable air and industrial plumes allow it to build up." },
  { name: "CO", fullName: "Carbon monoxide", unit: "µg/m³", source: "Incomplete combustion, traffic, fires, and generators", effect: "A colorless gas that reduces the blood's ability to carry oxygen.", weather: "Poor ventilation and enclosed traffic corridors increase exposure." },
];

const influences = [
  { title: "What improves air quality", items: ["Steady wind disperses pollution.", "Rain removes some particles from the air.", "Open terrain and ventilation dilute emissions.", "Lower traffic and industrial activity reduce new emissions.", "Trees and vegetation can capture some particles, especially when combined with good airflow."] },
  { title: "What deteriorates air quality", items: ["Temperature inversions hold pollution near breathing level.", "Traffic congestion increases NO₂, CO, and particle emissions.", "Construction and unpaved roads add PM10 and dust.", "Fires, crop burning, and generators add smoke and gases.", "Heat and sunlight can create more ground-level ozone."] },
];

const cardStyle = {
  padding: "1.25rem",
  background: "var(--color-bg-elevated)",
  border: "1px solid var(--color-border-subtle)",
};

export default function AQIUnderstandingPage() {
  return (
    <div style={{ maxWidth: "1180px", margin: "0 auto", padding: "2rem 1.5rem 3rem" }}>
      <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>AQI reference guide</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.8rem, 3vw, 2.6rem)", color: "var(--color-text-primary)", margin: "0 0 0.75rem" }}>
        Understand AQI
      </h1>
      <p style={{ maxWidth: "780px", fontSize: "1rem", color: "var(--color-text-secondary)", lineHeight: 1.75, margin: "0 0 1.75rem" }}>
        AQI is a communication scale that converts measured pollutant concentrations into one number. It helps you understand current exposure risk, compare places, and decide how much outdoor activity is appropriate.
      </p>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="aeris-card" style={cardStyle}>
          <div className="eyebrow">What the number means</div>
          <h2 style={{ fontSize: "1.1rem", color: "var(--color-text-primary)", margin: "0.45rem 0" }}>Higher AQI means higher health concern</h2>
          <ul style={{ color: "var(--color-text-secondary)", lineHeight: 1.6, paddingLeft: "1.1rem", margin: 0 }}>
            <li>It is not a percentage.</li>
            <li>It combines several pollutant measurements.</li>
            <li>Higher numbers mean greater health concern.</li>
          </ul>
        </div>
        <div className="aeris-card" style={cardStyle}>
          <div className="eyebrow">Why it can change quickly</div>
          <h2 style={{ fontSize: "1.1rem", color: "var(--color-text-primary)", margin: "0.45rem 0" }}>Emissions, weather, and time interact</h2>
          <ul style={{ color: "var(--color-text-secondary)", lineHeight: 1.6, paddingLeft: "1.1rem", margin: 0 }}>
            <li>Traffic adds pollution during busy periods.</li>
            <li>Rain and wind can remove or disperse pollution.</li>
            <li>Sunlight can create more ground-level ozone.</li>
          </ul>
        </div>
        <div className="aeris-card" style={cardStyle}>
          <div className="eyebrow">How to use it</div>
          <h2 style={{ fontSize: "1.1rem", color: "var(--color-text-primary)", margin: "0.45rem 0" }}>Use the category with the number</h2>
          <ul style={{ color: "var(--color-text-secondary)", lineHeight: 1.6, paddingLeft: "1.1rem", margin: 0 }}>
            <li>Read the color and health category.</li>
            <li>Check the dominant pollutant.</li>
            <li>Follow the advice for sensitive groups.</li>
          </ul>
        </div>
      </section>

      <section className="aeris-card" style={{ ...cardStyle, marginBottom: "1.5rem" }}>
        <div className="eyebrow">US EPA-style scale</div>
        <h2 style={{ fontFamily: "var(--font-display)", color: "var(--color-text-primary)", margin: "0.4rem 0 1rem" }}>AQI health bands</h2>
        <div style={{ display: "grid", gap: "0.65rem" }}>
          {bands.map((band) => (
            <div key={band.range} style={{ display: "grid", gridTemplateColumns: "90px minmax(150px, 0.7fr) 1fr", gap: "0.85rem", alignItems: "center", padding: "0.7rem 0.8rem", borderRadius: "8px", background: "var(--color-bg-overlay)" }}>
              <strong className="data-mono" style={{ color: band.color }}>{band.range}</strong>
              <strong style={{ color: "var(--color-text-primary)", fontSize: "0.9rem" }}>{band.label}</strong>
              <span style={{ color: "var(--color-text-secondary)", fontSize: "0.86rem", lineHeight: 1.45 }}>{band.meaning}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="aeris-card" style={{ ...cardStyle, marginBottom: "1.5rem" }}>
        <div className="eyebrow">Calculation</div>
        <h2 style={{ fontFamily: "var(--font-display)", color: "var(--color-text-primary)", margin: "0.4rem 0 0.7rem" }}>How AQI is calculated</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
          {["1. Measure concentrations", "2. Convert each pollutant to a sub-index", "3. Select the highest sub-index", "4. Assign the health category"].map((step, index) => (
            <div key={step} style={{ padding: "0.9rem", background: "var(--color-bg-overlay)", borderLeft: "2px solid var(--color-accent)" }}>
              <div className="eyebrow">Step {index + 1}</div>
              <div style={{ color: "var(--color-text-primary)", fontWeight: 600, marginTop: "0.35rem", lineHeight: 1.45 }}>{step}</div>
            </div>
          ))}
        </div>
        <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.7, margin: "1rem 0 0" }}>
          A simplified breakpoint calculation interpolates between concentration and AQI ranges: AQI = (high index − low index) × (concentration − low concentration) ÷ (high concentration − low concentration) + low index. Different pollutants use different breakpoints and averaging periods.
        </p>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <div className="eyebrow">Parameters</div>
        <h2 style={{ fontFamily: "var(--font-display)", color: "var(--color-text-primary)", margin: "0.4rem 0 1rem" }}>Pollutants that influence AQI</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
          {pollutants.map((pollutant) => (
            <div key={pollutant.name} className="aeris-card" style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "baseline" }}>
                <div>
                  <h3 style={{ color: "var(--color-text-primary)", margin: 0, fontSize: "1rem" }}>{pollutant.name}</h3>
                  <div style={{ color: "var(--color-accent)", fontSize: "0.82rem", marginTop: "0.15rem" }}>{pollutant.fullName}</div>
                </div>
                <span className="data-mono" style={{ color: "var(--color-accent)", fontSize: "0.75rem" }}>{pollutant.unit}</span>
              </div>
              <ul style={{ color: "var(--color-text-secondary)", fontSize: "0.82rem", lineHeight: 1.55, paddingLeft: "1.1rem", margin: "0.7rem 0 0" }}>
                <li><strong>What it is:</strong> {pollutant.effect}</li>
                <li><strong>Common sources:</strong> {pollutant.source}</li>
                <li><strong>Weather effect:</strong> {pollutant.weather}</li>
                <li><strong>Why it matters:</strong> Higher concentrations can increase health risk.</li>
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {influences.map((group) => (
          <div key={group.title} className="aeris-card" style={cardStyle}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "var(--color-text-primary)", margin: 0 }}>{group.title}</h2>
            <ol style={{ color: "var(--color-text-secondary)", lineHeight: 1.65, paddingLeft: "1.6rem", margin: "0.8rem 0 0", listStyleType: "decimal" }}>
              {group.items.map((item) => <li key={item} style={{ marginBottom: "0.45rem" }}>{item}</li>)}
            </ol>
          </div>
        ))}
      </section>

      <section className="aeris-card" style={{ ...cardStyle, borderColor: "var(--color-accent)" }}>
        <div className="eyebrow">Practical reading</div>
        <h2 style={{ fontFamily: "var(--font-display)", color: "var(--color-text-primary)", margin: "0.4rem 0 0.65rem" }}>A better interpretation than AQI alone</h2>
        <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.7, margin: 0 }}>
          Check the AQI trend, dominant pollutant, distance to a source, wind and humidity, time of day, and your own sensitivity. Shorter outdoor exposure, cleaner indoor air, avoiding heavy traffic, and choosing times with better dispersion can reduce personal exposure. People with asthma, heart or lung disease, children, older adults, and outdoor workers should follow local health guidance when AQI rises.
        </p>
      </section>
    </div>
  );
}