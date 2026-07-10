import React from "react";

export default function AQICategory({ value }) {
  let label = "Unknown";
  let cls = "aqi-badge";

  if (value <= 50)       { label = "Good";                            cls += " aqi-badge-good"; }
  else if (value <= 100) { label = "Moderate";                        cls += " aqi-badge-moderate"; }
  else if (value <= 150) { label = "Unhealthy for Sensitive Groups";  cls += " aqi-badge-usg"; }
  else if (value <= 200) { label = "Unhealthy";                       cls += " aqi-badge-unhealthy"; }
  else if (value <= 300) { label = "Very Unhealthy";                  cls += " aqi-badge-very-unhealthy"; }
  else                   { label = "Hazardous";                       cls += " aqi-badge-hazardous"; }

  return <span className={cls}>{label}</span>;
}
