import React, { useState } from "react";
import api from "./services/api";

export default function DownloadComparisonReport({ city1, city2 }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await api.get(
        `/report/compare?city1=${encodeURIComponent(city1)}&city2=${encodeURIComponent(city2)}`,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${city1}_vs_${city2}_Comparison_Report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Comparison report generation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="aeris-btn-primary"
      style={{ width: "100%", padding: "0.75rem 1rem", fontSize: "0.875rem", opacity: loading ? 0.6 : 1 }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: "0.375rem", display: "inline" }}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {loading ? "Generating…" : "Download Comparison Report"}
    </button>
  );
}
