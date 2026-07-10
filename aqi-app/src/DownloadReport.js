import React, { useState } from "react";
import axios from "axios";
import { createAerisReport, exportReportCsv } from "./reportUtils";

export default function DownloadReport({ city, reportData, buttonLabel = "Download Report", csvLabel = "Export CSV" }) {
  const [loading, setLoading] = useState(false);

  const handleBackendDownload = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await axios.get(`/report/${encodeURIComponent(city)}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${city}_Environmental_Report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Report generation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFrontendDownload = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const doc = createAerisReport(reportData);
      doc.save(`${reportData.city || city || "Environmental_Report"}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      if (city) {
        await handleBackendDownload();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCsvExport = () => {
    if (!reportData) return;
    const { url, filename } = exportReportCsv(reportData);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
      <button
        onClick={reportData ? handleFrontendDownload : handleBackendDownload}
        disabled={loading}
        className="aeris-btn-primary"
        style={{ fontSize: "0.875rem", opacity: loading ? 0.7 : 1 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {loading ? "Generating…" : buttonLabel}
      </button>
      {reportData && (
        <button
          onClick={handleCsvExport}
          className="aeris-btn-ghost"
          style={{ fontSize: "0.875rem" }}
        >
          {csvLabel}
        </button>
      )}
    </div>
  );
}
