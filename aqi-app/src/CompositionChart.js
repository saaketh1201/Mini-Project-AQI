import React from "react";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip);

const POLLUTANT_LABELS = {
  pm2_5: "PM2.5", pm10: "PM10", no2: "NO₂",
  so2: "SO₂", o3: "O₃", co: "CO", nh3: "NH₃",
};

const COLORS = [
  "#00C2B8", "#4A9EFF", "#F5A623",
  "#A855F7", "#22C55E", "#EF4444", "#EAB308",
];

export default function CompositionChart({ composition }) {
  if (!composition || Object.keys(composition).length === 0) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "200px", borderRadius: "8px",
        background: "var(--color-bg-overlay)",
        border: "1px dashed var(--color-border-subtle)",
      }}>
        <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
          No composition data available
        </span>
      </div>
    );
  }

  const entries = Object.entries(composition).filter(([, v]) => v != null && v > 0);
  const labels  = entries.map(([k]) => POLLUTANT_LABELS[k] || k.toUpperCase());
  const values  = entries.map(([, v]) => Number(v).toFixed(2));
  const colors  = entries.map((_, i) => COLORS[i % COLORS.length]);

  const chartData = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: colors.map((c) => c + "CC"),
      borderColor: colors.map((c) => c),
      borderWidth: 1.5,
      hoverBorderWidth: 2,
    }],
  };

  const options = {
    responsive: true,
    cutout: "68%",
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0C1E35",
        borderColor: "#1E3A5A",
        borderWidth: 1,
        titleColor: "#7BA5C4",
        bodyColor: "#E2EEF8",
        titleFont: { family: "Space Mono", size: 11 },
        bodyFont: { family: "Space Mono", size: 12 },
        padding: 10,
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.parsed} µg/m³`,
        },
      },
    },
  };

  return (
    <div>
      <div style={{ width: "200px", height: "200px", margin: "0 auto 1.5rem" }}>
        <Doughnut data={chartData} options={options} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
        {entries.map(([key, val], i) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
              {POLLUTANT_LABELS[key] || key.toUpperCase()}
            </span>
            <span className="data-mono" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              {Number(val).toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
