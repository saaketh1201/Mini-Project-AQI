import React from "react";

export default function SkeletonCard({ height = 160 }) {
  return (
    <div
      className="aeris-card"
      style={{ padding: "1.5rem", height: `${height}px`, overflow: "hidden" }}
    >
      <div className="skeleton" style={{ height: "10px", width: "40%", marginBottom: "1rem" }} />
      <div className="skeleton" style={{ height: "36px", width: "55%", marginBottom: "1rem" }} />
      <div className="skeleton" style={{ height: "10px", width: "80%", marginBottom: "0.625rem" }} />
      <div className="skeleton" style={{ height: "10px", width: "60%" }} />
    </div>
  );
}
