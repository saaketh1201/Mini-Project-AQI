import React, { useState, useEffect } from "react";
import LandingPage from "./LandingPage";
import AQIDashboard from "./AQIDashboard";
import AQIHeatmap from "./AQIHeatmap";
import CompareCities from "./CompareCities";
import TopCities from "./TopCities";
import Footer from "./Footer";
import Navbar from "./Navbar";
import ArchitecturePage from "./ArchitecturePage";

export default function App() {
  const [view, setView] = useState("landing");
  const [city, setCity] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("aerisTheme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("aerisTheme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const handleSearch = (query) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setCity(trimmed);
    setView("dashboard");
  };

  const goHome = () => {
    setView("landing");
    setCity("");
    setSearchInput("");
  };

  if (view === "landing") {
    return <LandingPage onSearch={handleSearch} theme={theme} toggleTheme={toggleTheme} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg-base)" }}>
      <Navbar
        city={city}
        view={view}
        onGoHome={goHome}
        onNavigate={setView}
        onSearch={handleSearch}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main style={{ paddingTop: "72px" }}>
        {view === "dashboard" && city && (
          <div className="animate-fade-in">
            <AQIDashboard
              city={city}
              onCityChange={(q) => {
                // If the dashboard asks to "Try another city" by sending an empty query,
                // navigate back to the landing view. Otherwise perform a normal search.
                if (!q || (typeof q === "string" && q.trim() === "")) {
                  goHome();
                  return;
                }
                handleSearch(q);
              }}
            />
            <div style={{ padding: "0 1.5rem 2rem", maxWidth: "1280px", margin: "0 auto" }}>
              <AQIHeatmap />
              <TopCities onCitySelect={handleSearch} />
              <Footer />
            </div>
          </div>
        )}

        {view === "map" && (
          <div className="animate-fade-in" style={{ padding: "2rem 1.5rem", maxWidth: "1280px", margin: "0 auto" }}>
            <AQIHeatmap fullscreen />
            <Footer />
          </div>
        )}

        {view === "compare" && (
          <div className="animate-fade-in" style={{ padding: "2rem 1.5rem", maxWidth: "1280px", margin: "0 auto" }}>
            <CompareCities />
            <Footer />
          </div>
        )}

        {view === "architecture" && (
          <div className="animate-fade-in">
            <ArchitecturePage />
            <Footer />
          </div>
        )}
      </main>
    </div>
  );
}
