import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

function AQIMap() {
  const [cities, setCities] = useState([]);

  useEffect(() => {
    axios.get("/aqi-ranking").then((res) => setCities(res.data));
  }, []);

  const getMarkerColor = (aqi) => {
    if (aqi <= 50) return "green";
    if (aqi <= 100) return "yellow";
    if (aqi <= 150) return "orange";
    if (aqi <= 200) return "red";
    if (aqi <= 300) return "purple";
    return "black";
  };

  return (
    <div style={{ width: "100%", height: "500px", marginTop: "20px" }}>
      <MapContainer center={[20, 0]} zoom={2} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {cities.map((city, i) => (
          <CircleMarker
            key={i}
            center={[city.lat, city.lon]}
            radius={10}
            color={getMarkerColor(city.aqi)}
          >
            <Popup>
              <b>{city.name}</b><br />
              AQI: {city.aqi}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

export default AQIMap;
