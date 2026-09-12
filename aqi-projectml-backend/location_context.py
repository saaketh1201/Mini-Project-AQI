# Location Context Database
# Provides geographic, industrial, and traffic context for major cities
# Used to generate location-specific environmental insights

import math
import requests
from functools import lru_cache

# Known industrial zones, water bodies, and traffic corridors by city
LOCATION_CONTEXT = {
    "delhi": {
        "city_center": {"lat": 28.6139, "lon": 77.2090},
        "industrial_zones": [
            {"name": "Okhla Industrial Estate", "lat": 28.5495, "lon": 77.2577, "type": "heavy", "pollutants": ["PM2.5", "SO2", "NO2"]},
            {"name": "Badarpur Power Plant", "lat": 28.5092, "lon": 77.2819, "type": "thermal_plant", "pollutants": ["SO2", "PM10", "NO2"]},
            {"name": "Mundka Industrial Area", "lat": 28.6700, "lon": 77.0850, "type": "heavy", "pollutants": ["PM2.5", "SO2"]},
            {"name": "Wazirpur Industrial Estate", "lat": 28.7299, "lon": 77.1765, "type": "electroplating", "pollutants": ["SO2", "NO2", "heavy metals"]},
            {"name": "Narela Industrial Zone", "lat": 28.8500, "lon": 77.2000, "type": "heavy", "pollutants": ["PM2.5", "SO2", "PM10"]},
            {"name": "Jhilmil Industrial Area", "lat": 28.7849, "lon": 77.3299, "type": "mixed", "pollutants": ["PM2.5", "NO2"]},
        ],
        "water_bodies": [
            {"name": "Yamuna River", "lat": 28.6500, "lon": 77.2700, "type": "river", "affects_humidity": True, "affects_dispersion": True},
        ],
        "traffic_corridors": [
            {"name": "NH-44 (North-South)", "type": "highway", "intensity": "very_high"},
            {"name": "Ring Road (Central)", "type": "arterial", "intensity": "very_high"},
            {"name": "Western Peripheral Road", "type": "arterial", "intensity": "high"},
            {"name": "Inner Ring Road", "type": "arterial", "intensity": "very_high"},
            {"name": "Delhi-Meerut Expressway", "type": "highway", "intensity": "high"},
        ],
        "seasonal_factors": {
            "winter_crop_burning": {"season": "Oct-Nov", "source": "Punjab/Haryana", "impact": "very_high"},
            "monsoon_dispersion": {"season": "Jul-Sep", "effect": "improved_dispersal"},
            "temperature_inversion": {"season": "Nov-Jan", "frequency": "frequent", "severity": "severe"},
        },
    },
    "hyderabad": {
        "city_center": {"lat": 17.3850, "lon": 78.4867},
        "industrial_zones": [
            {"name": "Hitech City / HITEC", "lat": 17.3588, "lon": 78.4029, "type": "it_pharma", "pollutants": ["NO2", "PM2.5"]},
            {"name": "Jeedimetla Industrial Area", "lat": 17.4550, "lon": 78.5150, "type": "heavy", "pollutants": ["PM2.5", "SO2", "NO2"]},
            {"name": "Cherlapalli Industrial Estate", "lat": 17.3299, "lon": 78.5800, "type": "mixed", "pollutants": ["PM2.5", "NO2"]},
            {"name": "Nacharam Industrial Estate", "lat": 17.4350, "lon": 78.5700, "type": "heavy", "pollutants": ["PM2.5", "SO2"]},
            {"name": "Medchal Industrial Area", "lat": 17.4000, "lon": 78.5950, "type": "heavy", "pollutants": ["PM2.5", "SO2", "NO2"]},
        ],
        "water_bodies": [
            {"name": "Osman Sagar Lake", "lat": 17.3630, "lon": 78.3750, "type": "lake", "affects_humidity": True, "affects_dispersion": True},
            {"name": "Hyderabad Tank", "lat": 17.3700, "lon": 78.4700, "type": "reservoir", "affects_humidity": True},
            {"name": "Musi River", "lat": 17.3850, "lon": 78.4900, "type": "river", "affects_humidity": True},
        ],
        "traffic_corridors": [
            {"name": "ORR (Outer Ring Road)", "type": "arterial", "intensity": "very_high"},
            {"name": "IRR (Inner Ring Road)", "type": "arterial", "intensity": "high"},
            {"name": "Hitec City Road", "type": "arterial", "intensity": "high"},
            {"name": "Madhapur-Gachibowli Corridor", "type": "arterial", "intensity": "high"},
            {"name": "Somajiguda-Secunderabad Road", "type": "arterial", "intensity": "very_high"},
        ],
        "seasonal_factors": {
            "summer_heat": {"season": "Apr-Jun", "effect": "thermal_buildup"},
            "monsoon": {"season": "Jul-Sep", "effect": "improved_dispersal"},
            "pre_monsoon": {"season": "May-Jun", "frequency": "dust_storms"},
        },
    },
    "mumbai": {
        "city_center": {"lat": 19.0760, "lon": 72.8777},
        "industrial_zones": [
            {"name": "Thane Industrial Area", "lat": 19.2141, "lon": 72.9789, "type": "heavy", "pollutants": ["PM2.5", "SO2", "NO2"]},
            {"name": "Vashi Industrial Estate", "lat": 19.0711, "lon": 73.1005, "type": "chemical", "pollutants": ["SO2", "PM2.5", "VOCs"]},
            {"name": "Port Trust Area", "lat": 18.9707, "lon": 72.8224, "type": "port", "pollutants": ["PM10", "SO2", "NO2"]},
            {"name": "Sewri Industrial Area", "lat": 18.9680, "lon": 72.8340, "type": "mixed", "pollutants": ["PM2.5", "NO2"]},
        ],
        "water_bodies": [
            {"name": "Arabian Sea", "lat": 19.0760, "lon": 72.8277, "type": "sea", "affects_humidity": True, "sea_breeze": True},
            {"name": "Thane Creek", "lat": 19.2141, "lon": 72.9789, "type": "creek", "affects_humidity": True},
            {"name": "Powai Lake", "lat": 19.1203, "lon": 72.9260, "type": "lake", "affects_humidity": True},
        ],
        "traffic_corridors": [
            {"name": "Eastern Freeway", "type": "highway", "intensity": "very_high"},
            {"name": "Western Express Highway", "type": "highway", "intensity": "very_high"},
            {"name": "South-North corridor (Marine Drive)", "type": "arterial", "intensity": "high"},
            {"name": "Trans-Harbour Link", "type": "highway", "intensity": "high"},
        ],
        "seasonal_factors": {
            "post_monsoon": {"season": "Oct-Nov", "effect": "dispersion_clearing"},
            "summer_sea_breeze": {"season": "Apr-Jun", "effect": "improved_dispersal"},
        },
    },
    "beijing": {
        "city_center": {"lat": 39.9042, "lon": 116.4074},
        "industrial_zones": [
            {"name": "Hebei Steel Industry", "lat": 39.9500, "lon": 116.5000, "type": "steel", "pollutants": ["PM2.5", "PM10", "SO2"]},
            {"name": "Yanqing Power Plant", "lat": 40.4500, "lon": 115.9500, "type": "thermal_plant", "pollutants": ["SO2", "PM10", "NO2"]},
            {"name": "Capital Industrial Park", "lat": 39.8500, "lon": 116.7000, "type": "mixed", "pollutants": ["PM2.5", "NO2"]},
        ],
        "water_bodies": [
            {"name": "Ming Tombs Reservoir", "lat": 40.2865, "lon": 116.2198, "type": "reservoir", "affects_humidity": True},
        ],
        "traffic_corridors": [
            {"name": "Fifth Ring Road", "type": "arterial", "intensity": "very_high"},
            {"name": "Second Ring Road", "type": "arterial", "intensity": "very_high"},
            {"name": "Capital Airport Expressway", "type": "highway", "intensity": "high"},
        ],
        "seasonal_factors": {
            "winter_heating": {"season": "Nov-Mar", "source": "coal_combustion", "impact": "very_high"},
            "spring_dust_storms": {"season": "Mar-May", "source": "deserts", "impact": "high"},
            "long_range_transport": {"season": "year-round", "source": "industrial_provinces", "impact": "moderate"},
        },
    },
    "jakarta": {
        "city_center": {"lat": -6.2088, "lon": 106.8456},
        "industrial_zones": [
            {"name": "Pesanggrahan Industrial Zone", "lat": -6.2800, "lon": 106.7100, "type": "heavy", "pollutants": ["PM2.5", "PM10", "SO2"]},
            {"name": "Balaraja Port Area", "lat": -6.1900, "lon": 106.6500, "type": "port", "pollutants": ["PM10", "SO2", "NO2"]},
            {"name": "Karawang Industrial Estate", "lat": -6.3400, "lon": 107.0100, "type": "heavy", "pollutants": ["PM2.5", "SO2", "PM10"]},
        ],
        "water_bodies": [
            {"name": "Java Sea", "lat": -6.2088, "lon": 106.8456, "type": "sea", "affects_humidity": True, "sea_breeze": True},
            {"name": "Ciliwung River", "lat": -6.2088, "lon": 106.8456, "type": "river", "affects_humidity": True},
        ],
        "traffic_corridors": [
            {"name": "Jalan Tol (Toll Road Network)", "type": "highway", "intensity": "very_high"},
            {"name": "Sudirman-Thamrin Corridor", "type": "arterial", "intensity": "very_high"},
            {"name": "Jl. Gajah Mada", "type": "arterial", "intensity": "very_high"},
        ],
        "seasonal_factors": {
            "dry_season": {"season": "May-Sep", "effect": "minimal_dispersion"},
            "wet_season": {"season": "Oct-Apr", "effect": "improved_dispersal"},
            "monsoon_winds": {"season": "year-round", "effect": "transport_to_nearby_cities"},
        },
    },
    "los_angeles": {
        "city_center": {"lat": 34.0522, "lon": -118.2437},
        "industrial_zones": [
            {"name": "Port of Los Angeles", "lat": 33.7298, "lon": -118.2417, "type": "port", "pollutants": ["PM2.5", "NO2", "SO2"]},
            {"name": "Refinery Corridor (Long Beach)", "lat": 33.7650, "lon": -118.1957, "type": "refinery", "pollutants": ["SO2", "benzene", "PM2.5"]},
            {"name": "San Gabriel Valley Industrial", "lat": 34.0928, "lon": -118.0685, "type": "manufacturing", "pollutants": ["PM2.5", "O3_precursor", "NO2"]},
        ],
        "water_bodies": [
            {"name": "Pacific Ocean", "lat": 34.0522, "lon": -118.2437, "type": "sea", "affects_humidity": True, "sea_breeze": True},
        ],
        "traffic_corridors": [
            {"name": "I-405 (San Diego Freeway)", "type": "highway", "intensity": "very_high"},
            {"name": "I-10 (Santa Monica Freeway)", "type": "highway", "intensity": "very_high"},
            {"name": "I-710 (Long Beach Freeway)", "type": "highway", "intensity": "very_high"},
            {"name": "I-5 (Golden State Freeway)", "type": "highway", "intensity": "very_high"},
        ],
        "seasonal_factors": {
            "thermal_inversion": {"season": "summer", "frequency": "persistent", "severity": "severe", "cause": "basin_geography"},
            "wildfire_season": {"season": "Jul-Oct", "effect": "episodic_pm25_spikes"},
            "santa_ana_winds": {"season": "fall-winter", "effect": "dispersion_improvement"},
        },
    },
    "london": {
        "city_center": {"lat": 51.5074, "lon": -0.1278},
        "industrial_zones": [
            {"name": "Thames Valley Industrial", "lat": 51.5500, "lon": -0.2500, "type": "mixed", "pollutants": ["PM2.5", "NO2"]},
        ],
        "water_bodies": [
            {"name": "River Thames", "lat": 51.5074, "lon": -0.1278, "type": "river", "affects_humidity": True},
        ],
        "traffic_corridors": [
            {"name": "M25 (London Orbital)", "type": "highway", "intensity": "very_high"},
            {"name": "Central London Congestion Zone", "type": "arterial", "intensity": "very_high"},
            {"name": "Kings Road / Chelsea", "type": "arterial", "intensity": "high"},
        ],
        "seasonal_factors": {
            "diesel_vehicle_concentration": {"season": "year-round", "effect": "no2_driver"},
            "episodic_continental_transport": {"season": "spring", "source": "europe", "impact": "moderate"},
        },
    },
    "chennai": {
        "city_center": {"lat": 13.0827, "lon": 80.2707},
        "industrial_zones": [
            {"name": "Ambattur Industrial Estate", "lat": 13.1143, "lon": 80.1548, "type": "mixed"},
            {"name": "Guindy Industrial Estate", "lat": 13.0067, "lon": 80.2206, "type": "mixed"},
            {"name": "Manali Industrial Area", "lat": 13.1647, "lon": 80.2584, "type": "petrochemical"},
            {"name": "Ennore Industrial Area", "lat": 13.2146, "lon": 80.3203, "type": "port and power"},
            {"name": "Sriperumbudur Industrial Corridor", "lat": 12.9676, "lon": 79.9417, "type": "manufacturing"},
        ],
        "water_bodies": [
            {"name": "Bay of Bengal", "lat": 13.0500, "lon": 80.2900, "type": "sea", "affects_humidity": True, "sea_breeze": True},
            {"name": "Adyar River", "lat": 13.0120, "lon": 80.2550, "type": "river", "affects_dispersion": True},
            {"name": "Cooum River", "lat": 13.0750, "lon": 80.2750, "type": "river", "affects_dispersion": True},
            {"name": "Chembarambakkam Lake", "lat": 13.0100, "lon": 80.0600, "type": "lake"},
            {"name": "Pulicat Lake", "lat": 13.4200, "lon": 80.3200, "type": "lake"},
        ],
        "traffic_corridors": [
            {"name": "Chennai Outer Ring Road", "type": "arterial", "intensity": "very_high"},
            {"name": "Poonamallee High Road", "type": "arterial", "intensity": "high"},
            {"name": "OMR / Rajiv Gandhi Salai", "type": "arterial", "intensity": "high"},
            {"name": "Anna Salai", "type": "arterial", "intensity": "very_high"},
            {"name": "Chennai-Bengaluru Highway", "type": "highway", "intensity": "high"},
        ],
        "seasonal_factors": {"northeast_monsoon": {"season": "Oct-Dec", "effect": "rainfall_improves_particle_dispersion"}, "summer_sea_breeze": {"season": "Mar-Jun", "effect": "coastal_dispersion"}},
    },
    "kolkata": {
        "city_center": {"lat": 22.5726, "lon": 88.3639},
        "industrial_zones": [
            {"name": "Taratala Industrial Area", "lat": 22.5005, "lon": 88.3038, "type": "mixed"},
            {"name": "Garden Reach Industrial Area", "lat": 22.5320, "lon": 88.2850, "type": "port and engineering"},
            {"name": "Howrah Industrial Belt", "lat": 22.5958, "lon": 88.2636, "type": "engineering"},
            {"name": "Dankuni Industrial Area", "lat": 22.6700, "lon": 88.3000, "type": "manufacturing"},
            {"name": "Budge Budge Industrial Area", "lat": 22.4700, "lon": 88.1800, "type": "petrochemical"},
        ],
        "water_bodies": [
            {"name": "Hooghly River", "lat": 22.5700, "lon": 88.3400, "type": "river", "affects_dispersion": True},
            {"name": "East Kolkata Wetlands", "lat": 22.5200, "lon": 88.4400, "type": "wetland"},
            {"name": "Rabindra Sarobar", "lat": 22.5100, "lon": 88.3500, "type": "lake"},
            {"name": "Salt Lake", "lat": 22.5958, "lon": 88.4190, "type": "lake"},
            {"name": "Adi Ganga", "lat": 22.5000, "lon": 88.3600, "type": "canal"},
        ],
        "traffic_corridors": [
            {"name": "EM Bypass", "type": "arterial", "intensity": "very_high"},
            {"name": "VIP Road", "type": "arterial", "intensity": "high"},
            {"name": "AJC Bose Road", "type": "arterial", "intensity": "very_high"},
            {"name": "Durgapur Expressway", "type": "highway", "intensity": "high"},
            {"name": "NH-12 / Jessore Road", "type": "highway", "intensity": "high"},
        ],
        "seasonal_factors": {"monsoon": {"season": "Jun-Sep", "effect": "rainfall_improves_dispersion"}, "winter_inversion": {"season": "Dec-Feb", "effect": "stagnant_air_can_trap_particles"}},
    },
    "bengaluru": {
        "city_center": {"lat": 12.9716, "lon": 77.5946},
        "industrial_zones": [
            {"name": "Peenya Industrial Area", "lat": 13.0320, "lon": 77.5190, "type": "manufacturing"},
            {"name": "Bommasandra Industrial Area", "lat": 12.8160, "lon": 77.6840, "type": "mixed"},
            {"name": "Jigani Industrial Area", "lat": 12.7820, "lon": 77.6380, "type": "manufacturing"},
            {"name": "Whitefield Industrial Area", "lat": 12.9698, "lon": 77.7500, "type": "technology and manufacturing"},
            {"name": "Doddaballapur Industrial Area", "lat": 13.2920, "lon": 77.5370, "type": "textile and manufacturing"},
        ],
        "water_bodies": [
            {"name": "Ulsoor Lake", "lat": 12.9830, "lon": 77.6200, "type": "lake"},
            {"name": "Bellandur Lake", "lat": 12.9300, "lon": 77.6780, "type": "lake"},
            {"name": "Varthur Lake", "lat": 12.9400, "lon": 77.7460, "type": "lake"},
            {"name": "Hebbal Lake", "lat": 13.0350, "lon": 77.5920, "type": "lake"},
            {"name": "Jakkur Lake", "lat": 13.0780, "lon": 77.6060, "type": "lake"},
        ],
        "traffic_corridors": [
            {"name": "Outer Ring Road", "type": "arterial", "intensity": "very_high"},
            {"name": "Hosur Road", "type": "highway", "intensity": "very_high"},
            {"name": "Tumakuru Road", "type": "highway", "intensity": "high"},
            {"name": "Bellary Road / Airport Road", "type": "highway", "intensity": "high"},
            {"name": "Electronic City Road", "type": "arterial", "intensity": "very_high"},
        ],
        "seasonal_factors": {"monsoon": {"season": "Jun-Oct", "effect": "rainfall_improves_dispersion"}, "dry_season": {"season": "Jan-May", "effect": "dust_and_stagnation_can_increase_particles"}},
    },
    "bangalore": {},
    "visakhapatnam": {
        "city_center": {"lat": 17.6868, "lon": 83.2185},
        "industrial_zones": [
            {"name": "Visakhapatnam Steel Plant", "lat": 17.6130, "lon": 83.1880, "type": "steel"},
            {"name": "Gajuwaka Industrial Area", "lat": 17.6860, "lon": 83.2150, "type": "heavy"},
            {"name": "Parawada Industrial Area", "lat": 17.6900, "lon": 83.1000, "type": "pharmaceutical and chemical"},
            {"name": "Kondakarla Industrial Area", "lat": 17.6500, "lon": 82.9800, "type": "manufacturing"},
            {"name": "Visakhapatnam Port Industrial Area", "lat": 17.6900, "lon": 83.2800, "type": "port"},
        ],
        "water_bodies": [
            {"name": "Bay of Bengal", "lat": 17.7000, "lon": 83.3000, "type": "sea", "affects_humidity": True, "sea_breeze": True},
            {"name": "Kondakarla Ava", "lat": 17.5500, "lon": 82.9500, "type": "wetland"},
            {"name": "Kambalakonda Lake", "lat": 17.7600, "lon": 83.2500, "type": "lake"},
            {"name": "Meghadrigedda Reservoir", "lat": 17.8000, "lon": 83.2400, "type": "reservoir"},
            {"name": "Mudasarlova Reservoir", "lat": 17.7500, "lon": 83.2700, "type": "reservoir"},
        ],
        "traffic_corridors": [
            {"name": "NH-16", "type": "highway", "intensity": "very_high"},
            {"name": "Gajuwaka Road", "type": "arterial", "intensity": "very_high"},
            {"name": "NAD Junction Corridor", "type": "arterial", "intensity": "high"},
            {"name": "Beach Road", "type": "arterial", "intensity": "high"},
            {"name": "MVP Double Road", "type": "arterial", "intensity": "high"},
        ],
        "seasonal_factors": {"northeast_monsoon": {"season": "Oct-Dec", "effect": "rainfall_and_sea_breeze_aid_dispersion"}, "summer": {"season": "Mar-May", "effect": "heat_and_dust_can_increase_particles"}},
    },
    "pune": {
        "city_center": {"lat": 18.5204, "lon": 73.8567},
        "industrial_zones": [
            {"name": "Bhosari MIDC", "lat": 18.6280, "lon": 73.8420, "type": "manufacturing"},
            {"name": "Pimpri-Chinchwad Industrial Area", "lat": 18.6290, "lon": 73.8000, "type": "automotive"},
            {"name": "Talegaon Industrial Area", "lat": 18.7350, "lon": 73.6750, "type": "manufacturing"},
            {"name": "Ranjangaon Industrial Area", "lat": 18.7600, "lon": 74.2500, "type": "manufacturing"},
            {"name": "Chakan Industrial Area", "lat": 18.7600, "lon": 73.8500, "type": "automotive"},
        ],
        "water_bodies": [
            {"name": "Mula-Mutha River", "lat": 18.5200, "lon": 73.8800, "type": "river", "affects_dispersion": True},
            {"name": "Pashan Lake", "lat": 18.5360, "lon": 73.7890, "type": "lake"},
            {"name": "Khadakwasla Reservoir", "lat": 18.4420, "lon": 73.7750, "type": "reservoir"},
            {"name": "Mulshi Lake", "lat": 18.4900, "lon": 73.5000, "type": "lake"},
            {"name": "Pavana Lake", "lat": 18.7200, "lon": 73.4900, "type": "lake"},
        ],
        "traffic_corridors": [
            {"name": "Pune-Mumbai Expressway", "type": "highway", "intensity": "very_high"},
            {"name": "Pune-Nashik Highway", "type": "highway", "intensity": "high"},
            {"name": "Nagar Road", "type": "arterial", "intensity": "very_high"},
            {"name": "Hinjawadi-Maan Road", "type": "arterial", "intensity": "high"},
            {"name": "Satara Road", "type": "arterial", "intensity": "high"},
        ],
        "seasonal_factors": {"monsoon": {"season": "Jun-Sep", "effect": "rainfall_improves_dispersion"}, "summer": {"season": "Mar-May", "effect": "dryness_and_dust_can_increase_particles"}},
    },
}


@lru_cache(maxsize=128)
def _fetch_osm_city_features(lat, lon):
    """Fetch verified nearby industrial, road, and water features for uncovered cities."""
    query = f"""
    [out:json][timeout:12];
    (
    nwr(around:15000,{lat},{lon})[landuse=industrial][name];
    nwr(around:15000,{lat},{lon})[industrial][name];
    way(around:15000,{lat},{lon})[highway~\"^(motorway|trunk|primary|secondary)$\"][name];
    nwr(around:15000,{lat},{lon})[natural=water][name];
    nwr(around:15000,{lat},{lon})[water][name];
    );
    out center tags;
    """
    endpoints = (
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    )
    for endpoint in endpoints:
        try:
            response = requests.post(
                endpoint,
                data=query,
                timeout=12,
                headers={"User-Agent": "Aeris environmental intelligence"},
            )
            response.raise_for_status()
            return response.json().get("elements", [])
        except Exception as exc:
            print(f"OSM city feature lookup failed at {endpoint}: {exc}")
        return []


def _osm_feature_point(element):
    center = element.get("center") or {}
    return element.get("lat", center.get("lat")), element.get("lon", center.get("lon"))


def _dynamic_city_features(lat, lon):
    features = {"industrial_zones": [], "traffic_corridors": [], "water_bodies": []}
    for element in _fetch_osm_city_features(round(float(lat), 4), round(float(lon), 4)):
        tags = element.get("tags") or {}
        name = tags.get("name") or tags.get("name:en")
        if not name:
            continue
        feature_lat, feature_lon = _osm_feature_point(element)
        distance = _haversine_distance(lat, lon, feature_lat, feature_lon) if feature_lat is not None and feature_lon is not None else None
        if tags.get("landuse") == "industrial" or tags.get("industrial"):
            features["industrial_zones"].append({
                "name": name,
                "type": tags.get("industrial") or "industrial area",
                "distance_km": round(distance, 1) if distance is not None else None,
                "source": "OpenStreetMap",
            })
        highway = tags.get("highway")
        if highway in {"motorway", "trunk", "primary", "secondary"}:
            features["traffic_corridors"].append({
                "name": name,
                "type": highway,
                "intensity": "very_high" if highway in {"motorway", "trunk"} else "high",
                "distance_km": round(distance, 1) if distance is not None else None,
                "source": "OpenStreetMap",
            })
        if tags.get("natural") == "water" or tags.get("water"):
            features["water_bodies"].append({
                "name": name,
                "type": tags.get("water") or "water body",
                "distance_km": round(distance, 1) if distance is not None else None,
                "source": "OpenStreetMap",
            })

    for key in features:
        unique = {}
        for item in features[key]:
            unique[item["name"].strip().lower()] = item
        features[key] = sorted(unique.values(), key=lambda item: item.get("distance_km") or float("inf"))
    return features


def get_city_environmental_context(city_name, lat, lon, minimum_features=5):
    """Return curated context, supplemented by cached verified OSM features."""
    context_data, _ = _get_context_data(city_name, lat, lon)
    curated = {
        "industrial_zones": list(context_data.get("industrial_zones", [])),
        "traffic_corridors": list(context_data.get("traffic_corridors", [])),
        "water_bodies": list(context_data.get("water_bodies", [])),
        "seasonal_factors": context_data.get("seasonal_factors", {}),
    }
    if any(len(curated[key]) < minimum_features for key in ("industrial_zones", "traffic_corridors", "water_bodies")):
        dynamic = _dynamic_city_features(lat, lon)
        for key in ("industrial_zones", "traffic_corridors", "water_bodies"):
            known = {item.get("name", "").strip().lower() for item in curated[key]}
            curated[key].extend(item for item in dynamic[key] if item["name"].strip().lower() not in known)
            curated[key] = curated[key][:minimum_features]
    return curated

def _normalize_city_key(city_name):
    if not city_name:
        return ""
    key = city_name.strip().lower().split(",")[0].strip()
    return {"bangalore": "bengaluru", "vizag": "visakhapatnam"}.get(key, key)


def _find_nearest_known_city(lat, lon, max_distance_km=120):
    best = (None, float("inf"))
    for key, data in LOCATION_CONTEXT.items():
        center = data.get("city_center")
        if not center:
            continue
        dist = _haversine_distance(lat, lon, center["lat"], center["lon"])
        if dist < best[1]:
            best = (key, dist)
    if best[0] and best[1] <= max_distance_km:
        return best[0]
    return None


def _get_context_data(city_name, lat, lon):
    city_key = _normalize_city_key(city_name)
    context_data = LOCATION_CONTEXT.get(city_key)
    if context_data:
        return context_data, city_key
    if lat is not None and lon is not None:
        nearest_city_key = _find_nearest_known_city(lat, lon)
        if nearest_city_key:
            return LOCATION_CONTEXT.get(nearest_city_key, {}), nearest_city_key
    return {}, None


def get_nearby_context(city_name, lat, lon, radius_km=5):
    """
    Get all relevant context for a location: industrial zones, water bodies, traffic corridors.
    Returns list of contextual elements and their proximity.
    """
    context_data, _ = _get_context_data(city_name, lat, lon)
    
    nearby_features = {
        "industrial_zones": [],
        "water_bodies": [],
        "traffic_corridors": [],
        "seasonal_factors": context_data.get("seasonal_factors", {}),
    }
    
    # Calculate distances to industrial zones
    for zone in context_data.get("industrial_zones", []):
        dist = _haversine_distance(lat, lon, zone["lat"], zone["lon"])
        if dist <= radius_km * 2:
            nearby_features["industrial_zones"].append({
                **zone,
                "distance_km": round(dist, 1),
            })
    
    # Calculate distances to water bodies
    for water in context_data.get("water_bodies", []):
        dist = _haversine_distance(lat, lon, water["lat"], water["lon"])
        if dist <= radius_km * 1.5:
            nearby_features["water_bodies"].append({
                **water,
                "distance_km": round(dist, 1),
            })
    
    # Traffic corridors (proximity based on representative corridor coordinates)
    for corridor in context_data.get("traffic_corridors", []):
        if "lat" in corridor and "lon" in corridor:
            dist = _haversine_distance(lat, lon, corridor["lat"], corridor["lon"])
            if dist <= radius_km * 2:
                nearby_features["traffic_corridors"].append({
                    **corridor,
                    "distance_km": round(dist, 1),
                })
        else:
            nearby_features["traffic_corridors"].append(corridor)
    
    # Sort nearby features by proximity when possible
    nearby_features["industrial_zones"].sort(key=lambda z: z.get("distance_km", float("inf")))
    nearby_features["water_bodies"].sort(key=lambda z: z.get("distance_km", float("inf")))
    nearby_features["traffic_corridors"].sort(key=lambda z: z.get("distance_km", float("inf")))
    
    return nearby_features, context_data.get("city_center", {})

def _haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance in km between two lat/lon points."""
    R = 6371  # Earth's radius in km
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

def detect_industrial_influence(lat, lon, city_name, components):
    """
    Detect if a location is influenced by industrial emissions.
    Returns: (is_influenced: bool, industrial_zones: list, confidence: float)
    """
    nearby_features, _ = get_nearby_context(city_name, lat, lon, radius_km=10)
    industrial_zones = nearby_features.get("industrial_zones", [])
    
    if not industrial_zones:
        return False, [], 0.0
    
    # Check pollutant signatures for industrial influence
    so2 = components.get("so2", 0) or 0
    pm10 = components.get("pm10", 0) or 0
    pm25 = components.get("pm2_5", 0) or 0
    
    confidence = 0.0
    closest_zone = min(industrial_zones, key=lambda z: z["distance_km"])
    
    # SO2 is a strong indicator of industrial combustion
    if so2 > 20:
        confidence += 0.4
    
    # Elevated PM10 relative to PM2.5 suggests dust/coarse particles from industry
    if pm10 > 0 and pm25 > 0 and pm10 / pm25 > 2.0:
        confidence += 0.3
    
    # Proximity to known zones increases confidence
    if closest_zone["distance_km"] <= 2:
        confidence += 0.3
    elif closest_zone["distance_km"] <= 5:
        confidence += 0.15
    
    return confidence > 0.35, industrial_zones, min(confidence, 1.0)

def detect_traffic_influence(lat, lon, city_name, components):
    """
    Detect if a location is influenced by traffic.
    Returns: (is_influenced: bool, traffic_corridors: list, confidence: float)
    """
    nearby_features, _ = get_nearby_context(city_name, lat, lon, radius_km=10)
    traffic_corridors = nearby_features.get("traffic_corridors", [])
    
    if not traffic_corridors:
        return False, [], 0.0
    
    no2 = components.get("no2", 0) or 0
    co = components.get("co", 0) or 0
    pm25 = components.get("pm2_5", 0) or 0
    
    confidence = 0.0
    
    # NO2 is the strongest indicator of traffic (vehicular emissions)
    if no2 > 50:
        confidence += 0.5
    elif no2 > 30:
        confidence += 0.3
    
    # CO is another traffic indicator
    if co > 2000:
        confidence += 0.3
    elif co > 1000:
        confidence += 0.15
    
    # Fine particulates from fuel combustion
    if pm25 > 35:
        confidence += 0.2
    
    return confidence > 0.4, traffic_corridors, min(confidence, 1.0)

def detect_water_body_influence(lat, lon, city_name, components):
    """
    Detect if a location is near water bodies (affects humidity/dispersion).
    Returns: (near_water: bool, water_bodies: list, influence_strength: float)
    Only returns true for genuinely nearby water features to avoid over-labeling
    locations as water-adjacent simply because the broader city contains a lake or river.
    """
    nearby_features, _ = get_nearby_context(city_name, lat, lon, radius_km=5)
    water_bodies = nearby_features.get("water_bodies", [])

    if not water_bodies:
        return False, [], 0.0

    # Only count as genuine nearby water if the closest feature is within a strict threshold.
    closest_water = min(water_bodies, key=lambda w: w["distance_km"])
    dist_km = float(closest_water.get("distance_km", float("inf")))
    if dist_km > 3.0:
        return False, [], 0.0

    influence = max(0.0, 1.0 - (dist_km / 3.0))
    return True, water_bodies, influence

def get_seasonal_context(city_name, components):
    """
    Get seasonal factors affecting air quality.
    Returns: seasonal_factors dict with relevant information.
    """
    city_key = city_name.strip().lower().split(",")[0].strip()
    context_data = LOCATION_CONTEXT.get(city_key, {})
    return context_data.get("seasonal_factors", {})
