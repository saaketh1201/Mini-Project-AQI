import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { getCitySuggestions } from "./services/api";

const FEATURED_CITIES = [
  "Delhi", "Jakarta", "Beijing", "Hyderabad", "Santiago",
  "Los Angeles", "London", "Tokyo", "Mumbai", "Seoul",
];

const SAMPLE_RANKING = [
  { name: "Delhi", aqi: 320 },
  { name: "Lahore", aqi: 280 },
  { name: "Dhaka", aqi: 265 },
  { name: "Beijing", aqi: 230 },
  { name: "Karachi", aqi: 215 },
];

function getAQIColor(aqi) {
  if (!aqi) return "var(--color-text-muted)";
  if (aqi <= 50)  return "var(--color-aqi-good)";
  if (aqi <= 100) return "var(--color-aqi-moderate)";
  if (aqi <= 150) return "var(--color-aqi-usg)";
  if (aqi <= 200) return "var(--color-aqi-unhealthy)";
  if (aqi <= 300) return "var(--color-aqi-very-unhealthy)";
  return "var(--color-aqi-hazardous)";
}

function getAQILabel(aqi) {
  if (!aqi) return "—";
  if (aqi <= 50)  return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Sensitive";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${5 + (i * 5.5) % 90}%`,
  bottom: `${(i * 7) % 40}%`,
  delay: `${(i * 0.7) % 8}s`,
  duration: `${10 + (i * 1.3) % 8}s`,
  size: i % 3 === 0 ? "4px" : "2.5px",
  opacity: 0.3 + (i % 4) * 0.12,
}));

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: "48-Hour Forecasting",
    body: "Prophet time series models trained on 30-day PM2.5 histories, compared against linear and ensemble baselines. Best model auto-selected by RMSE.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    title: "Global Heatmap",
    body: "Live AQI intensity layer across major metropolitan areas. Interactive markers with pollutant breakdowns and historical context per city.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
    title: "Pollutant Intelligence",
    body: "Full breakdown of PM2.5, PM10, NO₂, SO₂, O₃, CO, and NH₃ with EPA-standard AQI calculations and source attribution analysis.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Health Advisories",
    body: "Risk-tiered recommendations for outdoor activity, sensitive groups, and emergency protocols — generated from EPA and WHO exposure guidelines.",
  },
];

const STATS = [
  { value: "8", label: "Cities monitored" },
  { value: "30d", label: "Historical window" },
  { value: "48h", label: "Forecast horizon" },
  { value: "6", label: "Pollutants tracked" },
];

export default function LandingPage({ onSearch, theme, toggleTheme }) {
  const [query, setQuery] = useState("");
  const [rankingData, setRankingData] = useState([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const inputRef = useRef(null);

  useEffect(() => {
    axios
      .get("/aqi-ranking")
      .then((res) => {
        setRankingData(res.data || []);
        setRankingLoading(false);
      })
      .catch(() => {
        // If the backend is not running (dev) or the request fails,
        // fall back to a small sample so the UI remains informative.
        setRankingData(SAMPLE_RANKING);
        setRankingLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setActiveSuggestion(-1);
      return;
    }

    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const results = await getCitySuggestions(query, 6);
        if (!cancelled) {
          setSuggestions(results);
          setActiveSuggestion(-1);
        }
      } catch (e) {
        // ignore network errors while typing
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  const selectSuggestion = (value) => {
    setQuery(value);
    setSuggestions([]);
    onSearch(value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
      selectSuggestion(suggestions[activeSuggestion]);
      return;
    }
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg-base)", overflowX: "hidden" }}>
      {/* ── Minimal header ─────────────────────────────── */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2rem",
          height: "64px",
          background: "var(--color-navbar-bg, rgba(3,13,24,0.75))",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--color-border-subtle)",
          transition: "background 0.3s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="var(--color-accent)" strokeWidth="1.5" />
            <path d="M7 14 C7 10 10.5 7 14 7 C17.5 7 21 10 21 14" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            <circle cx="14" cy="14" r="2.5" fill="var(--color-accent)" />
            <path d="M14 11.5 L14 7" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.0625rem", color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
            aeris
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>Environmental Intelligence Platform</span>
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              style={{
                background: "none",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "8px",
                width: "32px", height: "32px",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                color: "var(--color-text-muted)",
                transition: "border-color 0.2s, color 0.2s",
              }}
            >
              {theme === "dark" ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          )}
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────── */}
      <section
        className="hero-bg"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "6rem 1.5rem 4rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Particle layer */}
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className="particle"
            style={{
              left: p.left,
              bottom: p.bottom,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
              animationDuration: p.duration,
              opacity: p.opacity,
            }}
          />
        ))}

        {/* Atmospheric glow circles */}
        <div style={{
          position: "absolute", top: "20%", left: "10%",
          width: "400px", height: "400px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,194,184,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "15%", right: "8%",
          width: "320px", height: "320px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(74,158,255,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ maxWidth: "760px", width: "100%", textAlign: "center", position: "relative", zIndex: 2 }}>
          {/* Eyebrow */}
          <div className="eyebrow animate-fade-in" style={{ marginBottom: "1.5rem" }}>
            Real-time environmental intelligence
          </div>

          {/* Headline */}
          <h1
            className="animate-slide-up"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(2.5rem, 6vw, 4.25rem)",
              lineHeight: 1.08,
              letterSpacing: "-0.035em",
              color: "var(--color-text-primary)",
              margin: "0 0 1.5rem",
              animationDelay: "0.1s",
            }}
          >
            Know the air<br />
            <span className="gradient-text">before you breathe it.</span>
          </h1>

          {/* Subheadline */}
          <p
            className="animate-slide-up"
            style={{
              fontSize: "1.0625rem",
              color: "var(--color-text-secondary)",
              lineHeight: 1.7,
              marginBottom: "3rem",
              animationDelay: "0.2s",
              maxWidth: "560px",
              margin: "0 auto 3rem",
            }}
          >
            Aeris delivers precision AQI readings, 48-hour forecasts, and expert-grade pollution analysis for cities worldwide — built for environmental agencies, municipalities, and researchers.
          </p>

          {/* Search */}
          <form
            onSubmit={handleSubmit}
            className="animate-slide-up"
            style={{
              display: "flex",
              gap: "0.75rem",
              maxWidth: "520px",
              margin: "0 auto 3.5rem",
              animationDelay: "0.3s",
            }}
          >
            <div style={{ flex: 1, position: "relative" }}>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round"
                style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              >
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                className="aeris-input"
                style={{ paddingLeft: "2.75rem", fontSize: "1rem", height: "52px" }}
                placeholder="Search any city — Delhi, Beijing, London…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveSuggestion(-1);
                }}
                onKeyDown={(e) => {
                  if (!suggestions.length) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveSuggestion((prev) => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter' && activeSuggestion >= 0) {
                    e.preventDefault();
                    selectSuggestion(suggestions[activeSuggestion]);
                  } else if (e.key === 'Escape') {
                    setSuggestions([]);
                  }
                }}
                autoFocus
              />
              {suggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '110%',
                  width: '100%',
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 8,
                  boxShadow: '0 6px 18px rgba(2,6,23,0.15)',
                  zIndex: 100,
                }}>
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={suggestion}
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        selectSuggestion(suggestion);
                      }}
                      style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        background: index === activeSuggestion ? 'rgba(0,194,184,0.08)' : 'transparent',
                      }}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              className="aeris-btn-primary"
              style={{ height: "52px", padding: "0 1.75rem", fontSize: "0.9375rem", flexShrink: 0 }}
            >
              Analyze
            </button>
          </form>

          {/* Quick city links */}
          <div className="animate-slide-up" style={{ animationDelay: "0.4s", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginRight: "0.75rem" }}>
              Popular:
            </span>
            {["Delhi", "Beijing", "London", "Tokyo", "Los Angeles"].map((c) => (
              <button
                key={c}
                onClick={() => onSearch(c)}
                style={{
                  background: "none",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "100px",
                  color: "var(--color-text-muted)",
                  fontSize: "0.8125rem",
                  padding: "0.25rem 0.75rem",
                  cursor: "pointer",
                  margin: "0 0.25rem 0.375rem",
                  transition: "border-color 0.2s, color 0.2s",
                }}
                onMouseEnter={(e) => { e.target.style.borderColor = "var(--color-accent)"; e.target.style.color = "var(--color-accent)"; }}
                onMouseLeave={(e) => { e.target.style.borderColor = "var(--color-border-subtle)"; e.target.style.color = "var(--color-text-muted)"; }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div
          className="animate-fade-in"
          style={{
            position: "absolute",
            bottom: "2.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "3rem",
            animationDelay: "0.6s",
          }}
        >
          {STATS.map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div className="data-mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                {s.value}
              </div>
              <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", marginTop: "0.125rem", letterSpacing: "0.04em" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Live ticker ────────────────────────────────── */}
      <div
        style={{
          borderTop: "1px solid var(--color-border-subtle)",
          borderBottom: "1px solid var(--color-border-subtle)",
          background: "var(--color-bg-surface)",
          padding: "0.75rem 0",
          overflow: "hidden",
        }}
      >
        <div className="ticker-inner" style={{ display: "inline-flex", gap: "2.5rem", paddingRight: "2.5rem" }}>
          {[...FEATURED_CITIES, ...FEATURED_CITIES].map((city, i) => (
            <span
              key={i}
              onClick={() => onSearch(city)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
                fontSize: "0.8125rem",
                color: "var(--color-text-muted)",
                flexShrink: 0,
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--color-text-primary)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--color-text-muted)"}
            >
              <span className="live-dot" style={{ width: "5px", height: "5px", flexShrink: 0 }} />
              {city}
            </span>
          ))}
        </div>
      </div>

      {/* ── Rankings preview ───────────────────────────── */}
      <section style={{ padding: "5rem 1.5rem", maxWidth: "1280px", margin: "0 auto" }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <div className="eyebrow" style={{ marginBottom: "0.75rem" }}>Live rankings</div>
          <h2 style={{
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.03em",
            color: "var(--color-text-primary)", margin: 0,
          }}>
            Most polluted cities right now
          </h2>
        </div>

        {rankingLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="aeris-card skeleton" style={{ height: "100px" }} />
            ))}
          </div>
        ) : rankingData.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
            {[...rankingData].sort((a, b) => b.aqi - a.aqi).map((city, i) => (
              <button
                key={i}
                onClick={() => onSearch(city.name)}
                className="aeris-card aeris-card-hover"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "1.25rem",
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border-subtle)",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <span className="data-mono" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", width: "20px", flexShrink: 0 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--color-text-primary)", marginBottom: "0.25rem", truncate: true }}>
                    {city.name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: getAQIColor(city.aqi) }}>
                    {getAQILabel(city.aqi)}
                  </div>
                </div>
                <span className="data-mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: getAQIColor(city.aqi), flexShrink: 0 }}>
                  {city.aqi}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ color: "var(--color-text-muted)", fontSize: "0.9375rem" }}>
            Start the backend server to load live rankings.
          </div>
        )}
      </section>

      {/* ── Features ──────────────────────────────────── */}
      <section style={{
        padding: "5rem 1.5rem",
        borderTop: "1px solid var(--color-border-subtle)",
        maxWidth: "1280px",
        margin: "0 auto",
      }}>
        <div style={{ marginBottom: "3rem" }}>
          <div className="eyebrow" style={{ marginBottom: "0.75rem" }}>Platform capabilities</div>
          <h2 style={{
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.03em",
            color: "var(--color-text-primary)", margin: "0 0 0.875rem",
          }}>
            Professional-grade environmental monitoring
          </h2>
          <p style={{ fontSize: "1rem", color: "var(--color-text-secondary)", maxWidth: "520px", lineHeight: 1.7 }}>
            Built on IQAir real-time data, Facebook Prophet forecasting, and EPA-standard AQI calculations.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="aeris-card aeris-card-hover" style={{ padding: "1.75rem" }}>
              <div style={{
                width: "44px", height: "44px", borderRadius: "10px",
                background: "var(--color-bg-overlay)",
                border: "1px solid var(--color-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--color-accent)",
                marginBottom: "1.25rem",
              }}>
                {f.icon}
              </div>
              <h3 style={{
                fontFamily: "var(--font-display)", fontWeight: 600,
                fontSize: "1rem", color: "var(--color-text-primary)",
                margin: "0 0 0.625rem", letterSpacing: "-0.01em",
              }}>
                {f.title}
              </h3>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", lineHeight: 1.65, margin: 0 }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────── */}
      <section style={{
        padding: "5rem 1.5rem",
        borderTop: "1px solid var(--color-border-subtle)",
        textAlign: "center",
        background: "var(--color-bg-surface)",
      }}>
        <div style={{ maxWidth: "560px", margin: "0 auto" }}>
          <div className="eyebrow" style={{ marginBottom: "1rem" }}>Get started</div>
          <h2 style={{
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: "clamp(1.75rem, 4vw, 2.75rem)", letterSpacing: "-0.03em",
            color: "var(--color-text-primary)", margin: "0 0 1rem",
          }}>
            Start your environmental analysis
          </h2>
          <p style={{ fontSize: "1rem", color: "var(--color-text-secondary)", marginBottom: "2.5rem", lineHeight: 1.7 }}>
            Search any city to access real-time AQI data, 30-day pollution history, and 48-hour forecasts.
          </p>
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.75rem", maxWidth: "420px", margin: "0 auto" }}>
            <input
              className="aeris-input"
              style={{ fontSize: "0.9375rem", height: "48px" }}
              placeholder="Enter city name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="aeris-btn-primary" style={{ height: "48px", flexShrink: 0, padding: "0 1.5rem" }}>
              Begin
            </button>
          </form>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────── */}
      <footer style={{
        padding: "2rem 1.5rem",
        borderTop: "1px solid var(--color-border-subtle)",
        display: "flex",
        flexWrap: "wrap",
        gap: "1rem",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="var(--color-accent)" strokeWidth="1.5" />
            <circle cx="14" cy="14" r="2.5" fill="var(--color-accent)" />
          </svg>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
            aeris
          </span>
        </div>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          {[
            { label: "IQAir AirVisual API", href: "https://www.iqair.com/us/air-pollution-data-api" },
            { label: "US EPA AQI", href: "https://www.airnow.gov/aqi/aqi-basics/" },
            { label: "WHO Guidelines", href: "https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health" },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => e.target.style.color = "var(--color-text-secondary)"}
              onMouseLeave={(e) => e.target.style.color = "var(--color-text-muted)"}
            >
              {label}
            </a>
          ))}
        </div>
        <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
          Data: IQAir API · AQI: US EPA Standard
        </span>
      </footer>
    </div>
  );
}
