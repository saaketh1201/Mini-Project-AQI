/**
 * hyderabadFallback.js
 *
 * Pre-annotated locality data for Hyderabad, India.
 * Used as a demonstration fallback when live /nearby data is unavailable.
 * Composition values are derived from known area characteristics and publicly
 * available historical AQI patterns — not real-time measurements.
 * All analytics generated from this data use cautious, non-assertive language.
 */

// Haversine distance helper (mirrored from backend — no hardcoded distances)
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Hyderabad city center reference
export const HYD_CENTER = { lat: 17.385, lon: 78.4867 };

/**
 * Locality definitions — lat/lon are real geographic coordinates.
 * aqi and composition values represent typical observed ranges based on
 * publicly reported air quality patterns for these zones.
 */
const RAW_LOCALITIES = [
  {
    name: "Patancheru",
    lat: 17.5278,
    lon: 78.2633,
    landUseTag: "Industrial Zone",
    landUseIcon: "🏭",
    aqi: 168,
    trend: "Rising",
    composition: { pm2_5: 82, pm10: 145, no2: 58, so2: 72, o3: 48, co: 6800 },
    dominant: "PM2.5",
    dominant_key: "pm2_5",
    category: "Unhealthy",
    note: "Major industrial corridor with pharmaceutical and chemical manufacturing",
  },
  {
    name: "Uppal",
    lat: 17.4007,
    lon: 78.5596,
    landUseTag: "Industrial & Residential",
    landUseIcon: "🏗️",
    aqi: 152,
    trend: "Stable",
    composition: { pm2_5: 68, pm10: 112, no2: 52, so2: 38, o3: 55, co: 5200 },
    dominant: "PM2.5",
    dominant_key: "pm2_5",
    category: "Unhealthy for Sensitive Groups",
    note: "Mix of light industry and dense residential housing",
  },
  {
    name: "ECIL",
    lat: 17.4627,
    lon: 78.5601,
    landUseTag: "Electronics & Industrial",
    landUseIcon: "⚡",
    aqi: 144,
    trend: "Stable",
    composition: { pm2_5: 62, pm10: 98, no2: 48, so2: 28, o3: 60, co: 4800 },
    dominant: "PM2.5",
    dominant_key: "pm2_5",
    category: "Unhealthy for Sensitive Groups",
    note: "Electronics manufacturing zone; moderate industrial activity",
  },
  {
    name: "LB Nagar",
    lat: 17.3462,
    lon: 78.5567,
    landUseTag: "Dense Urban",
    landUseIcon: "🏙️",
    aqi: 138,
    trend: "Stable",
    composition: { pm2_5: 58, pm10: 88, no2: 62, so2: 18, o3: 62, co: 5600 },
    dominant: "NO₂",
    dominant_key: "no2",
    category: "Unhealthy for Sensitive Groups",
    note: "High-traffic south-east corridor; major road junction",
  },
  {
    name: "Ameerpet",
    lat: 17.4375,
    lon: 78.4482,
    landUseTag: "Commercial Hub",
    landUseIcon: "🏢",
    aqi: 132,
    trend: "Stable",
    composition: { pm2_5: 54, pm10: 80, no2: 68, so2: 15, o3: 58, co: 6200 },
    dominant: "NO₂",
    dominant_key: "no2",
    category: "Unhealthy for Sensitive Groups",
    note: "Dense commercial district; metro construction formerly raised dust levels",
  },
  {
    name: "Kukatpally",
    lat: 17.4849,
    lon: 78.4138,
    landUseTag: "Residential & Commercial",
    landUseIcon: "🏘️",
    aqi: 126,
    trend: "Improving",
    composition: { pm2_5: 48, pm10: 75, no2: 55, so2: 12, o3: 52, co: 5000 },
    dominant: "PM2.5",
    dominant_key: "pm2_5",
    category: "Unhealthy for Sensitive Groups",
    note: "High residential density; moderate commuter traffic",
  },
  {
    name: "Kompally",
    lat: 17.5592,
    lon: 78.4772,
    landUseTag: "Peri-urban",
    landUseIcon: "🌱",
    aqi: 118,
    trend: "Improving",
    composition: { pm2_5: 42, pm10: 68, no2: 35, so2: 10, o3: 48, co: 3800 },
    dominant: "PM2.5",
    dominant_key: "pm2_5",
    category: "Unhealthy for Sensitive Groups",
    note: "Northern fringe; lower traffic density with some open land",
  },
  {
    name: "Secunderabad",
    lat: 17.4399,
    lon: 78.4983,
    landUseTag: "Urban & Transit",
    landUseIcon: "🚆",
    aqi: 115,
    trend: "Stable",
    composition: { pm2_5: 44, pm10: 70, no2: 58, so2: 14, o3: 50, co: 4900 },
    dominant: "NO₂",
    dominant_key: "no2",
    category: "Unhealthy for Sensitive Groups",
    note: "Major railway junction and cantonment area; moderate traffic",
  },
  {
    name: "Nacharam",
    lat: 17.4078,
    lon: 78.5498,
    landUseTag: "Light Industrial",
    landUseIcon: "🔧",
    aqi: 128,
    trend: "Stable",
    composition: { pm2_5: 50, pm10: 88, no2: 42, so2: 22, o3: 45, co: 4200 },
    dominant: "PM10",
    dominant_key: "pm10",
    category: "Unhealthy for Sensitive Groups",
    note: "Light manufacturing and warehousing; coarse dust commonly observed",
  },
  {
    name: "Madhapur",
    lat: 17.4471,
    lon: 78.3882,
    landUseTag: "IT Corridor",
    landUseIcon: "💻",
    aqi: 105,
    trend: "Stable",
    composition: { pm2_5: 38, pm10: 55, no2: 62, so2: 10, o3: 55, co: 5800 },
    dominant: "NO₂",
    dominant_key: "no2",
    category: "Moderate",
    note: "HITEC City tech hub; high peak-hour vehicle density",
  },
  {
    name: "Kondapur",
    lat: 17.4647,
    lon: 78.3630,
    landUseTag: "IT & Residential",
    landUseIcon: "🏠",
    aqi: 98,
    trend: "Improving",
    composition: { pm2_5: 34, pm10: 52, no2: 48, so2: 8, o3: 52, co: 4600 },
    dominant: "NO₂",
    dominant_key: "no2",
    category: "Moderate",
    note: "Suburban IT zone; moderate traffic with better green cover",
  },
  {
    name: "Banjara Hills",
    lat: 17.4126,
    lon: 78.4480,
    landUseTag: "Upscale Residential",
    landUseIcon: "🌳",
    aqi: 88,
    trend: "Improving",
    composition: { pm2_5: 28, pm10: 42, no2: 40, so2: 6, o3: 50, co: 3800 },
    dominant: "NO₂",
    dominant_key: "no2",
    category: "Moderate",
    note: "Tree-lined residential area; lower traffic density than city centre",
  },
  {
    name: "Shamshabad",
    lat: 17.2402,
    lon: 78.4292,
    landUseTag: "Airport & Logistics",
    landUseIcon: "✈️",
    aqi: 82,
    trend: "Stable",
    composition: { pm2_5: 26, pm10: 45, no2: 30, so2: 12, o3: 45, co: 3200 },
    dominant: "PM10",
    dominant_key: "pm10",
    category: "Moderate",
    note: "Rajiv Gandhi International Airport; aircraft and vehicle emissions commonly observed",
  },
  {
    name: "Golconda",
    lat: 17.3833,
    lon: 78.4011,
    landUseTag: "Heritage & Low-density",
    landUseIcon: "🏰",
    aqi: 75,
    trend: "Improving",
    composition: { pm2_5: 22, pm10: 38, no2: 25, so2: 8, o3: 48, co: 2800 },
    dominant: "PM10",
    dominant_key: "pm10",
    category: "Moderate",
    note: "Historical fort area with lower population density and reduced traffic load",
  },
  {
    name: "Gandipet",
    lat: 17.3771,
    lon: 78.3361,
    landUseTag: "Lake & Green Surroundings",
    landUseIcon: "🌊",
    aqi: 52,
    trend: "Improving",
    composition: { pm2_5: 14, pm10: 24, no2: 15, so2: 4, o3: 38, co: 1800 },
    dominant: "PM2.5",
    dominant_key: "pm2_5",
    category: "Good",
    note: "Osman Sagar Lake surroundings; high green cover and low traffic density",
  },
];

/**
 * Returns locality data with dynamically computed distances from the
 * provided center coordinates. Distances are never hardcoded.
 *
 * @param {number} fromLat - Center latitude (user location or city center)
 * @param {number} fromLon - Center longitude
 * @param {number} radiusKm - Maximum radius filter
 * @returns {Array} Localities sorted by AQI ascending, with distance_km computed live
 */
export function getHyderabadFallback(fromLat = HYD_CENTER.lat, fromLon = HYD_CENTER.lon, radiusKm = 60) {
  return RAW_LOCALITIES
    .map((loc) => ({
      ...loc,
      distance_km: Math.round(haversineKm(fromLat, fromLon, loc.lat, loc.lon) * 10) / 10,
    }))
    .filter((loc) => loc.distance_km <= radiusKm)
    .sort((a, b) => a.aqi - b.aqi);
}

export default RAW_LOCALITIES;
