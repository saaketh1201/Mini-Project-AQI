import React from "react";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function AQIChart({ forecast, label = "PM2.5 (µg/m³)", isHistory = false }) {
  if (!forecast || forecast.length === 0) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "200px", borderRadius: "8px",
        background: "var(--color-bg-overlay)",
        border: "1px dashed var(--color-border-subtle)",
      }}>
        <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
          No {isHistory ? "historical" : "forecast"} data available
        </span>
      </div>
    );
  }

  const maxPoints = isHistory ? 60 : 48;
  const slice = forecast.slice(-maxPoints);

  const labels = slice.map((f) => {
    const date = typeof f.ds === "number" ? new Date(f.ds * 1000) : new Date(f.ds);
    if (isNaN(date.getTime())) return String(f.ds).slice(0, 10);
    return isHistory
      ? date.toLocaleDateString("en-GB", { month: "short", day: "numeric" })
      : date.toLocaleTimeString("en-US", { month: "short", day: "numeric", hour: "2-digit" });
  });

  const values = slice.map((f) => {
    const v = f.yhat ?? f.y ?? 0;
    return Math.max(0, Math.round(v * 10) / 10);
  });

  const accentColor = isHistory ? "#4A9EFF" : "#00C2B8";
  const glowColor   = isHistory ? "rgba(74,158,255,0.08)" : "rgba(0,194,184,0.08)";

  const chartData = {
    labels,
    datasets: [
      {
        label,
        data: values,
        borderColor: accentColor,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return glowColor;
          const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          grad.addColorStop(0, accentColor + "30");
          grad.addColorStop(1, accentColor + "04");
          return grad;
        },
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: accentColor,
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0C1E35",
        borderColor: "#1E3A5A",
        borderWidth: 1,
        titleColor: "#7BA5C4",
        bodyColor: "#E2EEF8",
        titleFont: { family: "Space Mono", size: 11 },
        bodyFont: { family: "Space Mono", size: 12, weight: "bold" },
        padding: 10,
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.y} µg/m³`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: "#1A3048", drawBorder: false },
        ticks: {
          color: "#3D6080",
          font: { family: "Inter", size: 11 },
          maxTicksLimit: 8,
          maxRotation: 0,
        },
        border: { color: "#1A3048" },
      },
      y: {
        beginAtZero: true,
        grid: { color: "#1A3048", drawBorder: false },
        ticks: {
          color: "#3D6080",
          font: { family: "Space Mono", size: 10 },
          maxTicksLimit: 6,
          callback: (v) => `${v}`,
        },
        border: { color: "#1A3048" },
      },
    },
  };

  return (
    <div style={{ width: "100%", height: "280px" }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
