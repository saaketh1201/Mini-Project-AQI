import React, { useState, useEffect, useRef } from "react";
import { getCitySuggestions } from "./services/api";

export default function Navbar({ city, view, onGoHome, onNavigate, onSearch, searchInput, setSearchInput, theme, toggleTheme }) {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchInput || "");
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggRef = useRef(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Debounce typing before updating parent searchInput to avoid frequent requests
  useEffect(() => {
    setLocalSearch(searchInput || "");
  }, [searchInput]);

  useEffect(() => {
    const id = setTimeout(() => setSearchInput(localSearch), 500);
    return () => clearTimeout(id);
  }, [localSearch, setSearchInput]);

  // Fetch prefix suggestions for city search (debounced)
  useEffect(() => {
    if (!localSearch || localSearch.trim().length < 2) {
      setSuggestions([]);
      setActiveSuggestion(-1);
      return;
    }

    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const results = await getCitySuggestions(localSearch, 6);
        if (!cancelled) {
          setSuggestions(results);
          setActiveSuggestion(-1);
        }
      } catch (e) {
        // ignore
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [localSearch]);

  // Close suggestions on outside click
  useEffect(() => {
    function onDoc(e) {
      if (suggRef.current && !suggRef.current.contains(e.target)) {
        setSuggestions([]);
      }
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const selectSuggestion = (value) => {
    setLocalSearch(value);
    setSearchInput(value);
    setSuggestions([]);
    onSearch(value);
    setSearchOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
      selectSuggestion(suggestions[activeSuggestion]);
      return;
    }
    onSearch(localSearch.trim());
    setSearchOpen(false);
  };

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: "72px",
        display: "flex",
        alignItems: "center",
        padding: "0 1.5rem",
        background: scrolled
          ? "var(--color-navbar-bg-scrolled, rgba(3,13,24,0.92))"
          : "var(--color-navbar-bg, rgba(3,13,24,0.75))",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: scrolled
          ? "1px solid var(--color-border-subtle)"
          : "1px solid transparent",
        transition: "background 0.3s, border-color 0.3s",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          width: "100%",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: "2rem",
        }}
      >
        {/* Brand */}
        <button
          onClick={onGoHome}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            flexShrink: 0,
          }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="var(--color-accent)" strokeWidth="1.5" />
            <path
              d="M7 14 C7 10 10.5 7 14 7 C17.5 7 21 10 21 14"
              stroke="var(--color-accent)"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="14" cy="14" r="2.5" fill="var(--color-accent)" />
            <path
              d="M14 11.5 L14 7"
              stroke="var(--color-accent)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1.125rem",
              color: "var(--color-text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            aeris
          </span>
        </button>

        {/* Nav links */}
        <nav style={{ display: "flex", alignItems: "center", gap: "0.25rem", flex: 1 }}>
          <button
            className={`nav-link ${view === "dashboard" ? "active" : ""}`}
            onClick={() => onNavigate("dashboard")}
            style={{ background: "none", border: "none" }}
          >
            Monitor
          </button>
          <button
            className={`nav-link ${view === "map" ? "active" : ""}`}
            onClick={() => onNavigate("map")}
            style={{ background: "none", border: "none" }}
          >
            Heatmap
          </button>
          <button
            className={`nav-link ${view === "compare" ? "active" : ""}`}
            onClick={() => onNavigate("compare")}
            style={{ background: "none", border: "none" }}
          >
            Compare
          </button>
          <button
            className={`nav-link ${view === "architecture" ? "active" : ""}`}
            onClick={() => onNavigate("architecture")}
            style={{ background: "none", border: "none" }}
          >
            Architecture
          </button>
        </nav>

        {/* Theme toggle + Search + city indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              background: "none",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "8px",
              width: "34px",
              height: "34px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--color-text-muted)",
              flexShrink: 0,
              transition: "border-color 0.2s, color 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-accent)"; e.currentTarget.style.color = "var(--color-accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border-subtle)"; e.currentTarget.style.color = "var(--color-text-muted)"; }}
          >
            {theme === "dark" ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          {city && !searchOpen && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.375rem 0.75rem",
                borderRadius: "100px",
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border-subtle)",
                fontSize: "0.8125rem",
                color: "var(--color-text-secondary)",
                cursor: "pointer",
              }}
              onClick={() => setSearchOpen(true)}
            >
              <span className="live-dot" />
              <span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{city}</span>
            </div>
          )}

          {searchOpen ? (
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem", position: 'relative' }}>
              <div style={{ position: 'relative' }} ref={suggRef}>
                <input
                  autoFocus
                  className="aeris-input"
                  style={{ width: "200px", padding: "0.5rem 0.875rem", fontSize: "0.875rem" }}
                  placeholder="Search city…"
                  value={localSearch}
                  onChange={(e) => {
                    setLocalSearch(e.target.value);
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
                  onBlur={() => !localSearch && setSearchOpen(false)}
                />
                {suggestions && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: '110%',
                    background: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 8,
                    boxShadow: '0 6px 18px rgba(2,6,23,0.25)',
                    zIndex: 600,
                    width: 220,
                    overflow: 'hidden'
                  }}>
                    {suggestions.map((s, index) => (
                      <div
                        key={s}
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          selectSuggestion(s);
                        }}
                        style={{
                          padding: '0.5rem 0.75rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid rgba(0,0,0,0.04)',
                          background: index === activeSuggestion ? 'rgba(0, 194, 184, 0.1)' : 'transparent',
                        }}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="aeris-btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                Go
              </button>
            </form>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="aeris-btn-ghost"
              style={{ fontSize: "0.8125rem", padding: "0.5rem 1rem" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Search city
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
