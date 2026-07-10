import React from "react";

function getAQIColor(aqi) {
  if (!aqi) return "#3D6080";
  if (aqi <= 50)  return "#22C55E";
  if (aqi <= 100) return "#EAB308";
  if (aqi <= 150) return "#F97316";
  if (aqi <= 200) return "#EF4444";
  if (aqi <= 300) return "#A855F7";
  return "#991B1B";
}

export default function AQIGauge({ value, size = 96 }) {
  const color = getAQIColor(value);
  const pct = Math.min((value || 0) / 500, 1);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) - 7;
  const startAngle = -210;
  const sweepAngle = 240;

  const toXY = (deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const trackStart = toXY(startAngle);
  const trackEnd   = toXY(startAngle + sweepAngle);
  const fillEnd    = toXY(startAngle + sweepAngle * pct);
  const largeArc   = sweepAngle * pct > 180 ? 1 : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <defs>
        <filter id="gauge-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Track */}
      <path
        d={`M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 1 1 ${trackEnd.x} ${trackEnd.y}`}
        fill="none" stroke="#1A3048" strokeWidth="4.5" strokeLinecap="round"
      />
      {/* Fill */}
      {pct > 0.01 && (
        <path
          d={`M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`}
          fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round"
          filter="url(#gauge-glow)"
        />
      )}
      {/* Center */}
      <circle cx={cx} cy={cy} r="3.5" fill={color} />
    </svg>
  );
}
