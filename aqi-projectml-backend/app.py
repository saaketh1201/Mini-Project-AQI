from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import requests, os, io, time, re, random, json
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
try:
    from flask_compress import Compress
except Exception:
    Compress = None
from geopy.geocoders import Nominatim
from aqi_model import train_and_predict_pm25
from dotenv import load_dotenv
from insights import build_environmental_risk_snapshot, build_ai_summary, build_dashboard_kpis, build_analytics
from location_context import get_nearby_context, detect_industrial_influence, detect_traffic_influence, detect_water_body_influence
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER
import cachetools
import functools

import threading

base_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(base_dir, ".env"))

# Load curated popular localities for major cities to improve nearby fallback
POPULAR_LOCALITIES = {}
try:
    with open(os.path.join(base_dir, "popular_localities.json"), "r", encoding="utf-8") as f:
        import json
        POPULAR_LOCALITIES = json.load(f)
except Exception as e:
    print(f"Warning: could not load popular_localities.json: {e}")

# Load city search cache (simple prefix search for suggestions)
CITY_SEARCH = []
try:
    with open(os.path.join(base_dir, "city_search_cache.json"), "r", encoding="utf-8") as f:
        import json
        CITY_SEARCH = json.load(f)
except Exception as e:
    print(f"Warning: could not load city_search_cache.json: {e}")

app = Flask(__name__)
if Compress:
    try:
        Compress(app)
    except Exception:
        print("flask_compress present but failed to initialize; continuing without compression")
else:
    print("flask_compress not installed; responses will not be compressed. To enable, run: pip install Flask-Compress")

CORS(app)

# Server-side TTL cache (5 minutes)
CACHE = cachetools.TTLCache(maxsize=1000, ttl=300)

# Persistent response cache file for deterministic lookup and tracing
RESPONSE_CACHE_FILE = os.path.join(base_dir, "aqi_response_cache.json")
RESPONSE_CACHE = {}

# In-flight deduplication map: cache_key -> Future
IN_FLIGHT = {}


def load_response_cache():
    global RESPONSE_CACHE
    try:
        if os.path.exists(RESPONSE_CACHE_FILE):
            with open(RESPONSE_CACHE_FILE, "r", encoding="utf-8") as f:
                RESPONSE_CACHE = json.load(f)
    except Exception as e:
        print(f"Warning: could not load response cache file: {e}")
        RESPONSE_CACHE = {}


def save_response_cache():
    try:
        with open(RESPONSE_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(RESPONSE_CACHE, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Warning: could not save response cache file: {e}")


# Load persistent cache data if available
load_response_cache()

# Shared ThreadPoolExecutor for parallel fetches
EXECUTOR = ThreadPoolExecutor(max_workers=8)

# legacy small route cache (kept for compatibility)
route_cache = cachetools.TTLCache(maxsize=100, ttl=600)

def cached_route(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        cache_key = request.full_path
        if cache_key in route_cache:
            pass
        return func(*args, **kwargs)
    return wrapper

IQAIR_API_KEY = os.getenv("IQAIR_API_KEY")
REQUEST_TIMEOUT = 10

# ── Background Data Collector ────────────────────────────────────────────────
RANKING_CITIES = [
    "Delhi", "Lahore", "Dhaka", "Kolkata", "Kathmandu",
    "Hyderabad", "Mumbai", "Kanpur", "Jaipur", "Ludhiana",
    "Karachi", "Peshawar", "Multan", "Faisalabad",
    "Beijing", "Shanghai", "Chengdu", "Xi'an", "Wuhan", "Chongqing",
    "Shijiazhuang", "Lanzhou", "Taiyuan", "Zhengzhou",
    "Seoul", "Tokyo", "Bangkok", "Jakarta", "Ho Chi Minh City",
    "Cairo", "Dubai", "Doha", "Riyadh", "Tehran", "Baghdad",
    "Amman", "Kuwait City", "Santiago", "Mexico City", "São Paulo",
    "Lima", "Bogotá", "Quito", "La Paz", "Medellín",
    "Lagos", "Nairobi", "Kinshasa", "Accra", "Khartoum",
    "Moscow", "Warsaw", "Almaty", "Bishkek", "Tashkent",
    "London", "Paris", "Berlin", "Amsterdam",
    "Los Angeles", "New York", "Vancouver",
]

HEATMAP_CITIES = [
    "Delhi", "Mumbai", "Kolkata", "Chennai", "Hyderabad", "Bangalore", "Lahore",
    "Karachi", "Dhaka", "Kathmandu",
    "Beijing", "Shanghai", "Chengdu", "Wuhan", "Xi'an",
    "Tokyo", "Seoul", "Jakarta", "Bangkok", "Ho Chi Minh City",
    "Cairo", "Lagos", "Nairobi",
    "Moscow", "London", "Paris", "Berlin", "Warsaw",
    "Los Angeles", "New York", "Mexico City",
    "Santiago", "São Paulo", "Buenos Aires",
    "Dubai", "Riyadh", "Tehran",
]

# Deduplicate cities for the background fetcher
BACKGROUND_CITIES = list(set([c.strip().lower() for c in RANKING_CITIES + HEATMAP_CITIES]))
BACKGROUND_CACHE = {}

def background_data_collector():
    last_429_report = 0
    while True:
        for city in BACKGROUND_CITIES:
            try:
                # _fetch_single_city_aqi is defined later, so we just call it
                data = _fetch_single_city_aqi(city)
                if data:
                    BACKGROUND_CACHE[city] = data
            except Exception as e:
                msg = str(e)
                # Suppress excessive IQAir 429 spam — report at most once every 5 minutes
                if '429' in msg:
                    now = time.time()
                    if now - last_429_report > 300:
                        print(f"Background fetch warning (429) for {city}: {msg}")
                        last_429_report = now
                else:
                    print(f"Background fetch error for {city}: {e}")

            # Wait 1.5 seconds between fetches to absolutely guarantee no rate limits
            time.sleep(1.5)

        # After completing a full loop of all cities, sleep for 5 minutes
        time.sleep(300)

# NOTE: the collector thread is created here but intentionally not started.
# It will be started from the main entry point after all helper functions
# (including _fetch_single_city_aqi) are defined to avoid NameError race conditions.
collector_thread = threading.Thread(target=background_data_collector, daemon=True)

# ── Geodemographic profiles ────────────────────────────────────────────────────
# Known urban context for major cities, used to enrich diagnostic explanations.
CITY_PROFILES = {
    "delhi": {
        "traffic": "extreme",
        "industrial": "heavy",
        "population": "very high",
        "notes": "Dense traffic corridors along NH-44 and ring roads, heavy brick kiln activity in peripheral zones, and seasonal crop burning from neighboring states (Punjab, Haryana) are primary PM2.5 drivers. Low-wind winter inversions trap pollutants near the surface.",
    },
    "beijing": {
        "traffic": "high",
        "industrial": "moderate",
        "population": "very high",
        "notes": "Steel and cement industries in the surrounding Hebei province contribute to regional transport of particulate matter. Traffic density along the Fifth Ring Road and coal combustion for winter heating are the dominant local sources.",
    },
    "jakarta": {
        "traffic": "extreme",
        "industrial": "moderate",
        "population": "very high",
        "notes": "Highly congested road network with poor mass transit penetration generates significant tailpipe PM2.5 and NO₂. Coastal low-lying geography limits vertical mixing, compounding ground-level pollutant accumulation.",
    },
    "mumbai": {
        "traffic": "high",
        "industrial": "moderate",
        "population": "very high",
        "notes": "Port operations and shipping traffic contribute to SO₂ and PM10. Construction activity across the Mumbai Metro expansion corridors elevates coarse particulate levels. Sea breeze typically aids dispersion but is weaker in monsoon shoulder seasons.",
    },
    "hyderabad": {
        "traffic": "high",
        "industrial": "moderate",
        "population": "high",
        "notes": "Rapid urban expansion and construction activity drive coarse PM. Pharmaceutical and IT corridor industrial zones contribute to VOC and NO₂ loading. Relatively flat terrain offers some pollutant dispersion advantage.",
    },
    "los angeles": {
        "traffic": "high",
        "industrial": "low",
        "population": "high",
        "notes": "Basin geography creates persistent thermal inversions that trap photochemical smog. High vehicle miles traveled across the freeway network are the dominant O₃ and PM2.5 precursor source. Wildfires during dry season cause episodic AQI spikes.",
    },
    "london": {
        "traffic": "moderate",
        "industrial": "low",
        "population": "high",
        "notes": "Diesel vehicle emissions in the City and Central London remain the leading NO₂ source despite ULEZ expansion. Weather-driven episodes with continental air mass transport periodically elevate PM2.5 above background levels.",
    },
    "tokyo": {
        "traffic": "moderate",
        "industrial": "low",
        "population": "very high",
        "notes": "Advanced emissions controls have significantly reduced local PM2.5. Long-range transport of aerosols from Chinese industrial zones represents the primary episodic source. Prevailing westerly winds govern pollution episodes.",
    },
    "santiago": {
        "traffic": "high",
        "industrial": "moderate",
        "population": "high",
        "notes": "The Andes mountain range creates a closed basin that traps pollutants, especially during winter temperature inversions. Residential wood burning for heating and diesel buses are the dominant PM2.5 sources.",
    },
    "seoul": {
        "traffic": "high",
        "industrial": "moderate",
        "population": "very high",
        "notes": "Long-range transport of PM2.5 from Chinese industrial regions is estimated to contribute 30–50% of total PM2.5 loading on high-AQI days. Local diesel emissions and seasonal heating exacerbate this baseline.",
    },
}


def _city_profile(city_name):
    return CITY_PROFILES.get(city_name.lower().split(",")[0].strip(), None)


# ── AQI calculation helpers ────────────────────────────────────────────────────

def _linear_aqi(value, c_low, c_high, i_low, i_high):
    return round(((i_high - i_low) / (c_high - c_low)) * (value - c_low) + i_low)


def pm25_to_aqi(pm25):
    breakpoints = [
        (0.0, 12.0, 0, 50), (12.1, 35.4, 51, 100),
        (35.5, 55.4, 101, 150), (55.5, 150.4, 151, 200),
        (150.5, 250.4, 201, 300), (250.5, 350.4, 301, 400),
        (350.5, 500.4, 401, 500),
    ]
    for c_low, c_high, i_low, i_high in breakpoints:
        if c_low <= pm25 <= c_high:
            return _linear_aqi(pm25, c_low, c_high, i_low, i_high)
    return None


def pm10_to_aqi(pm10):
    breakpoints = [
        (0, 54, 0, 50), (55, 154, 51, 100),
        (155, 254, 101, 150), (255, 354, 151, 200),
        (355, 424, 201, 300), (425, 504, 301, 400),
        (505, 604, 401, 500),
    ]
    for c_low, c_high, i_low, i_high in breakpoints:
        if c_low <= pm10 <= c_high:
            return _linear_aqi(pm10, c_low, c_high, i_low, i_high)
    return None


def no2_to_aqi(no2):
    # US EPA NO2 breakpoints (µg/m³)
    breakpoints = [
        (0, 100, 0, 50), (101, 189, 51, 100),
        (190, 677, 101, 150), (678, 1221, 151, 200),
        (1222, 2350, 201, 300), (2351, 3100, 301, 400),
        (3101, 3853, 401, 500),
    ]
    for c_low, c_high, i_low, i_high in breakpoints:
        if c_low <= no2 <= c_high:
            return _linear_aqi(no2, c_low, c_high, i_low, i_high)
    return None


def o3_to_aqi(o3):
    # US EPA O3 8-hr breakpoints (µg/m³)
    breakpoints = [
        (0, 108, 0, 50), (109, 140, 51, 100),
        (141, 170, 101, 150), (171, 210, 151, 200),
        (211, 400, 201, 300),
    ]
    for c_low, c_high, i_low, i_high in breakpoints:
        if c_low <= o3 <= c_high:
            return _linear_aqi(o3, c_low, c_high, i_low, i_high)
    return None


def so2_to_aqi(so2):
    # US EPA SO2 1-hr breakpoints (µg/m³)
    breakpoints = [
        (0, 93, 0, 50), (94, 196, 51, 100),
        (197, 484, 101, 150), (485, 796, 151, 200),
        (797, 1583, 201, 300), (1584, 2105, 301, 400),
        (2106, 2630, 401, 500),
    ]
    for c_low, c_high, i_low, i_high in breakpoints:
        if c_low <= so2 <= c_high:
            return _linear_aqi(so2, c_low, c_high, i_low, i_high)
    return None


def co_to_aqi(co):
    # US EPA CO 8-hr breakpoints (µg/m³) — EPA standard in ppm × 1145.4
    breakpoints = [
        (0, 5000, 0, 50), (5001, 10000, 51, 100),
        (10001, 14286, 101, 150), (14287, 17143, 151, 200),
        (17144, 34286, 201, 300), (34287, 45714, 301, 400),
        (45715, 57143, 401, 500),
    ]
    for c_low, c_high, i_low, i_high in breakpoints:
        if c_low <= co <= c_high:
            return _linear_aqi(co, c_low, c_high, i_low, i_high)
    return None


def compute_aqi(components):
    if not components:
        return None
    candidates = []
    calculators = [
        ("pm2_5", pm25_to_aqi),
        ("pm10",  pm10_to_aqi),
        ("no2",   no2_to_aqi),
        ("o3",    o3_to_aqi),
        ("so2",   so2_to_aqi),
        ("co",    co_to_aqi),
    ]
    for key, fn in calculators:
        val = components.get(key)
        if val is not None:
            result = fn(val)
            if result:
                candidates.append(result)
    return max(candidates) if candidates else None


def determine_aqi(components, main_aqi_index=None, source=None):
    if main_aqi_index is not None:
        try:
            main_val = float(main_aqi_index)
            if source == "OpenWeatherMap Air Pollution API":
                if 1 <= main_val <= 5:
                    return {1: 25, 2: 75, 3: 125, 4: 175, 5: 250}.get(int(main_val))
                else:
                    return int(main_val)
            else:
                return int(main_val)
        except (TypeError, ValueError):
            pass

    return compute_aqi(components)


def aqi_category(aqi):
    if aqi is None:    return "Unknown"
    if aqi <= 50:      return "Good"
    if aqi <= 100:     return "Moderate"
    if aqi <= 150:     return "Unhealthy for Sensitive Groups"
    if aqi <= 200:     return "Unhealthy"
    if aqi <= 300:     return "Very Unhealthy"
    return "Hazardous"


def pollutant_label(p):
    return {"pm2_5": "PM2.5", "pm10": "PM10", "no2": "NO₂", "so2": "SO₂",
            "o3": "O₃", "co": "CO", "nh3": "NH₃"}.get(p, p.upper())


# All thresholds in µg/m³ — matching IQAir and US EPA measurement conventions.
# CO: EPA 8-hr standard 9 ppm ≈ 10,000 µg/m³ (not mg/m³).
# NO2: EPA annual 53 ppb ≈ 100 µg/m³.
# SO2: EPA 1-hr 75 ppb ≈ 196 µg/m³.
# O3:  EPA 8-hr 70 ppb ≈ 140 µg/m³.
THRESHOLDS = {
    "pm2_5": 12,
    "pm10":  54,
    "no2":   100,
    "so2":   196,
    "o3":    140,
    "co":    10000,
    "nh3":   100,
}


def get_dominant_pollutant(components):
    best = (None, 0, 0)
    for pollutant, value in components.items():
        if value is None:
            continue
        threshold = THRESHOLDS.get(pollutant, 1)
        score = value / threshold if threshold else 0
        if score > best[1]:
            best = (pollutant, score, value)
    return best[0], best[2]


def health_recommendations(aqi):
    if aqi is None:
        return "AQI unavailable. Please verify the city name or try again later."
    if aqi >= 301:
        return "Hazardous conditions. All outdoor physical activity should be avoided. Sensitive groups must remain indoors with windows sealed."
    if aqi >= 201:
        return "Very unhealthy air quality. Everyone should avoid prolonged outdoor exertion. Portable air purifiers recommended indoors."
    if aqi >= 151:
        return "Unhealthy for all populations. Reduce outdoor activity duration and intensity. Wear N95 or equivalent filtration if outdoors."
    if aqi >= 101:
        return "Unhealthy for sensitive groups — those with asthma, cardiovascular conditions, children, and the elderly should avoid strenuous outdoor activity."
    if aqi >= 51:
        return "Moderate air quality. Unusually sensitive individuals may wish to reduce prolonged outdoor exertion."
    return "Air quality is satisfactory. No health restrictions for the general population."


# ── Geocoding ────────────────────────────────────────────────────────────────────

@cachetools.cached(cache=cachetools.TTLCache(maxsize=1024, ttl=3600))
def get_city_coords(city):
    geolocator = Nominatim(user_agent="aeris_environmental_platform")
    location = geolocator.geocode(city)
    if location:
        return location.latitude, location.longitude
    return None, None


def fetch_iqair_city_data(lat, lon):
    if not IQAIR_API_KEY:
        raise ValueError("IQAIR_API_KEY is not configured")
    url = f"https://api.airvisual.com/v2/nearest_city?lat={lat}&lon={lon}&key={IQAIR_API_KEY}"
    max_retries = 4
    backoff = 1.0
    for attempt in range(1, max_retries + 1):
        try:
            resp = requests.get(url, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") != "success" or "data" not in data:
                    raise ValueError("Invalid IQAir API response")
                return data["data"]

            # Handle rate limiting with exponential backoff
            if resp.status_code == 429:
                wait = backoff + random.uniform(0, backoff)
                if attempt == max_retries:
                    raise requests.exceptions.RequestException(f"IQAir API returned 429")
                time.sleep(wait)
                backoff *= 2
                continue

            # Other non-200 responses
            resp.raise_for_status()

        except requests.exceptions.RequestException as e:
            # transient network error or HTTP error - retry with backoff
            if attempt == max_retries:
                raise
            wait = backoff + random.uniform(0, backoff)
            time.sleep(wait)
            backoff *= 2
            continue

    # If we exit loop without returning, raise
    raise requests.exceptions.RequestException("Failed to fetch IQAir data after retries")


def fetch_openmeteo_weather(lat, lon):
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "relative_humidity_2m,wind_speed_10m",
            "timezone": "auto",
        }
        resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            current = data.get("current", {})
            return {
                "humidity": current.get("relative_humidity_2m"),
                "wind_speed": current.get("wind_speed_10m"),
            }
    except Exception as e:
        print(f"Error fetching Open-Meteo weather: {e}")
    return {"humidity": None, "wind_speed": None}


def fetch_openmeteo_components(lat, lon):
    import datetime
    try:
        url = "https://air-quality-api.open-meteo.com/v1/air-quality"
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone",
            "forecast_days": 1,
            "past_days": 0
        }
        resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            hourly = data.get("hourly", {})
            times = hourly.get("time", [])
            if not times:
                return None
            
            current_utc = datetime.datetime.utcnow()
            best_idx = 0
            min_diff = float("inf")
            for idx, t_str in enumerate(times):
                try:
                    dt = datetime.datetime.strptime(t_str, "%Y-%m-%dT%H:%M")
                    diff = abs((dt - current_utc).total_seconds())
                    if diff < min_diff:
                        min_diff = diff
                        best_idx = idx
                except Exception:
                    pass
            
            pm2_5 = hourly.get("pm2_5", [])
            pm10 = hourly.get("pm10", [])
            co = hourly.get("carbon_monoxide", [])
            no2 = hourly.get("nitrogen_dioxide", [])
            so2 = hourly.get("sulphur_dioxide", [])
            o3 = hourly.get("ozone", [])
            
            components = {
                "pm2_5": pm2_5[best_idx] if best_idx < len(pm2_5) else None,
                "pm10":  pm10[best_idx] if best_idx < len(pm10) else None,
                "no2":   no2[best_idx] if best_idx < len(no2) else None,
                "so2":   so2[best_idx] if best_idx < len(so2) else None,
                "o3":    o3[best_idx] if best_idx < len(o3) else None,
                "co":    co[best_idx] if best_idx < len(co) else None,
                "nh3":   None,
            }
            return components
    except Exception as e:
        print(f"Error fetching Open-Meteo components: {e}")
    return None


@cachetools.cached(cache=cachetools.TTLCache(maxsize=1024, ttl=600))
def fetch_openmeteo_history(lat, lon):
    import datetime, calendar
    try:
        url = "https://air-quality-api.open-meteo.com/v1/air-quality"
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "pm2_5",
            "past_days": 30,
            "forecast_days": 0
        }
        resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            hourly = data.get("hourly", {})
            times = hourly.get("time", [])
            pm25 = hourly.get("pm2_5", [])
            
            history_list = []
            for t_str, val in zip(times, pm25):
                if val is not None:
                    try:
                        dt = datetime.datetime.strptime(t_str, "%Y-%m-%dT%H:%M")
                        ts = int(calendar.timegm(dt.utctimetuple()))
                        history_list.append({"ds": ts, "y": val})
                    except Exception:
                        pass
            return history_list
    except Exception as e:
        print(f"Error fetching Open-Meteo history: {e}")
    return []


def slugify_city(city):
    slug = city.strip().lower()
    for ch in [" ", ",", ".", "'", "’", "(", ")", "–", "—", "/"]:
        slug = slug.replace(ch, "-")
    slug = re.sub(r"[^a-z0-9-]", "", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def scrape_aqi_city_data(city):
    slug = slugify_city(city)
    url = f"https://aqicn.org/city/{slug}/"
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=REQUEST_TIMEOUT)
    if resp.status_code != 200:
        raise requests.exceptions.RequestException(f"AQICN returned {resp.status_code}")
    text = resp.text
    obj_match = re.search(r"\{[^{}]*\"aqi\"[^{}]*\}", text)
    if not obj_match:
        raise ValueError("AQICN page did not contain embedded AQI data")
    snippet = obj_match.group(0)
    aqi_match = re.search(r'\"aqi\"\s*:\s*\"?(?P<aqi>\d+)\"?', snippet)
    if not aqi_match:
        raise ValueError("AQICN embedded AQI value not found")
    aqi_value = int(aqi_match.group("aqi"))
    component_map = {
        "pm25": "pm2_5",
        "pm10": "pm10",
        "no2": "no2",
        "so2": "so2",
        "o3":  "o3",
        "co":  "co",
        "nh3": "nh3",
    }
    components = {}
    for key, internal in component_map.items():
        match = re.search(rf'\"{key}\"\s*:\s*\"?(?P<val>[0-9]+(?:\.[0-9]+)?)\"?', snippet)
        if match:
            components[internal] = float(match.group("val"))
    return {"components": components, "main": {"aqi": aqi_value}, "source": "AQICN web scrape"}


@cachetools.cached(cache=cachetools.TTLCache(maxsize=1024, ttl=600))
def fetch_current_aqi_data(lat, lon, city_name=None):
    """Fetch current air pollution data from IQAir, falling back to Open-Meteo, web scrape, or deterministic mock."""
    if IQAIR_API_KEY:
        try:
            iq = fetch_iqair_city_data(lat, lon)
            pollution = iq.get("current", {}).get("pollution", {})
            
            # Fetch real pollutant concentrations from Open-Meteo
            components = fetch_openmeteo_components(lat, lon)
            if not components:
                components = {
                    "pm2_5": pollution.get("pm2_5"),
                    "pm10":  pollution.get("pm10"),
                    "no2":   pollution.get("no2"),
                    "so2":   pollution.get("so2"),
                    "o3":    pollution.get("o3"),
                    "co":    pollution.get("co"),
                    "nh3":   pollution.get("nh3"),
                }
            
            return {"components": components, "main": {"aqi": pollution.get("aqius")}, "source": "IQAir AirVisual API"}
        except Exception as e:
            print(f"IQAir fetch failed: {e}")
            pass

    # Open-Meteo fallback when IQAir fails or isn't set
    try:
        components = fetch_openmeteo_components(lat, lon)
        if components and components.get("pm2_5") is not None:
            aqi_val = pm25_to_aqi(components["pm2_5"])
            return {"components": components, "main": {"aqi": aqi_val}, "source": "Open-Meteo Air Quality API"}
    except Exception as e:
        print(f"Open-Meteo fallback fetch failed: {e}")
        pass

    if city_name:
        try:
            return scrape_aqi_city_data(city_name)
        except Exception:
            pass

    # Final fallback: return deterministic mock values so the server remains usable in dev.
    seed = int((abs(lat) + abs(lon)) * 1000) % 100
    pm25 = 10 + (seed % 120)
    components = {"pm2_5": pm25, "pm10": pm25 * 1.8, "no2": 30, "so2": 5, "o3": 20, "co": 2000}
    main_index = 1 if pm25 <= 12 else 2 if pm25 <= 35 else 3 if pm25 <= 55 else 4 if pm25 <= 150 else 5
    return {"components": components, "main": {"aqi": main_index}, "source": "Mock fallback"}


# ── Endpoints ────────────────────────────────────────────────────────────────────

@app.route("/aqi/<city>", methods=["GET"])
def get_aqi(city):
    cache_key = f"aqi:{city.strip().lower()}"
    # Return cached payload immediately when available
    if cache_key in CACHE:
        return jsonify(CACHE[cache_key])

    # If another request is already building this response, wait for it
    if cache_key in IN_FLIGHT:
        try:
            payload = IN_FLIGHT[cache_key].result(timeout=20)
            return jsonify(payload)
        except Exception:
            pass

    def _build():
        lat, lon = get_city_coords(city)
        if not lat or not lon:
            return {"_error": f"Location '{city}' not found", "_status": 400}

        aqi_data = fetch_current_aqi_data(lat, lon, city_name=city)
        components = aqi_data.get("components", {})
        source_name = aqi_data.get("source", "Unknown")
        aqi_value = determine_aqi(components, aqi_data.get("main", {}).get("aqi"), source=source_name)

        # Parallel fetches for history and weather
        hist_fut = EXECUTOR.submit(fetch_openmeteo_history, lat, lon)
        weather_fut = EXECUTOR.submit(fetch_openmeteo_weather, lat, lon)

        try:
            history = hist_fut.result(timeout=20)
        except Exception:
            history = []

        try:
            weather = weather_fut.result(timeout=10)
        except Exception:
            weather = {"humidity": None, "wind_speed": None}

        forecast, metrics = train_and_predict_pm25(history) if history else ([], {"MAE": 0, "RMSE": 0, "MAPE": 0})

        # Build analytics with location context
        narrative = build_analytics(components, aqi_value, city_name=city, lat=lat, lon=lon, history=history, forecast=forecast)
        risk = build_environmental_risk_snapshot(components, aqi_value, history, forecast, source_name, city_name=city, lat=lat, lon=lon)
        ai_summary = build_ai_summary(components, aqi_value, weather, risk, city_name=city, lat=lat, lon=lon)
        kpis = build_dashboard_kpis(aqi_value, risk.get("score", 0), city_name=city)

        analytics = {
            "narrative": narrative,
            "risk": risk,
            "summary": ai_summary,
            "kpis": kpis,
        }

        result = {
            "city":        city,
            "lat":         lat,
            "lon":         lon,
            "aqi":         aqi_value,
            "composition": components,
            "history":     history,
            "forecast":    forecast,
            "metrics":     metrics,
            "source":      source_name,
            "analytics":   analytics,
            "weather":     weather,
            "updatedAt":   datetime.utcnow().isoformat(),
        }

        # Cache and return full result
        CACHE[cache_key] = result
        RESPONSE_CACHE[cache_key] = result
        save_response_cache()
        return result

    # submit build job and wait (deduplicates concurrent requests)
    fut = EXECUTOR.submit(_build)
    IN_FLIGHT[cache_key] = fut
    try:
        payload = fut.result(timeout=30)
        # handle logical errors
        if isinstance(payload, dict) and payload.get("_status") == 400:
            return jsonify({"error": payload.get("_error")}), 400
        # Support compact query param without using request inside worker thread
        compact = request.args.get("compact", default="false").lower() in ("1", "true", "yes")
        if compact and isinstance(payload, dict):
            compact_result = {
                "city": payload.get("city"),
                "lat": payload.get("lat"),
                "lon": payload.get("lon"),
                "aqi": payload.get("aqi"),
                "category": aqi_category(payload.get("aqi")),
                "composition": {k: payload.get("composition", {}).get(k) for k in ("pm2_5", "pm10") if k in payload.get("composition", {})},
                "updatedAt": payload.get("updatedAt"),
                "source": payload.get("source"),
            }
            return jsonify(compact_result)
        return jsonify(payload)
    except requests.exceptions.RequestException as e:
        # If external providers fail, return cached payload when available
        if cache_key in CACHE:
            return jsonify(CACHE[cache_key])
        return jsonify({"error": f"Data provider unavailable: {str(e)}"}), 503
    except Exception as e:
        print(f"Error for {city}: {e}")
        return jsonify({"error": f"Internal error: {str(e)}"}), 500
    finally:
        IN_FLIGHT.pop(cache_key, None)


@app.route("/aqi-history/<city>", methods=["GET"])
def aqi_history(city):
    try:
        lat, lon = get_city_coords(city)
        if not lat or not lon:
            return jsonify([]), 400
        history = fetch_openmeteo_history(lat, lon)
        return jsonify(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/aqi-ranking", methods=["GET"])
def aqi_ranking():
    cache_key = "aqi_ranking"
    # Return cached payload immediately when available
    if cache_key in CACHE:
        return jsonify(CACHE[cache_key])

    # If another request is already building this response, wait for it
    if cache_key in IN_FLIGHT:
        try:
            payload = IN_FLIGHT[cache_key].result(timeout=10)
            return jsonify(payload)
        except Exception:
            pass

    def _build_ranking():
        results = []
        for city in RANKING_CITIES:
            normalized = city.strip().lower()
            if normalized in BACKGROUND_CACHE:
                # Use the original capitalized name but data from cache
                data = dict(BACKGROUND_CACHE[normalized])
                data["name"] = city
                results.append(data)

        # Sort by live AQI descending and return the top 20 cities.
        results.sort(key=lambda x: x.get("aqi", 0), reverse=True)
        top = results[:20]
        CACHE[cache_key] = top
        return top

    fut = EXECUTOR.submit(_build_ranking)
    IN_FLIGHT[cache_key] = fut
    try:
        payload = fut.result(timeout=15)
        return jsonify(payload)
    except Exception as e:
        if cache_key in CACHE:
            return jsonify(CACHE[cache_key])
        return jsonify({"error": str(e)}), 500
    finally:
        IN_FLIGHT.pop(cache_key, None)


@app.route("/compare", methods=["GET"])
def compare_cities():
    city1 = request.args.get("city1")
    city2 = request.args.get("city2")
    if not city1 or not city2:
        return jsonify({"error": "Both city1 and city2 are required"}), 400

    def fetch(city):
        try:
            lat, lon = get_city_coords(city)
            if not lat or not lon:
                return {"error": f"Location '{city}' not found"}
            aqi_data = fetch_current_aqi_data(lat, lon, city_name=city)
            components = aqi_data.get("components", {})
            source_name = aqi_data.get("source", "Unknown")
            aqi_value = determine_aqi(components, aqi_data.get("main", {}).get("aqi"), source=source_name)
            history = fetch_openmeteo_history(lat, lon)
            weather = fetch_openmeteo_weather(lat, lon)
            forecast, metrics = train_and_predict_pm25(history) if history else ([], {})
            
            # Build consolidated analytics with location context
            narrative = build_analytics(components, aqi_value, city_name=city, lat=lat, lon=lon, history=history, forecast=forecast)
            risk = build_environmental_risk_snapshot(components, aqi_value, history, forecast, source_name, city_name=city, lat=lat, lon=lon)
            ai_summary = build_ai_summary(components, aqi_value, weather, risk, city_name=city, lat=lat, lon=lon)
            kpis = build_dashboard_kpis(aqi_value, risk.get("score", 0), city_name=city)
            
            analytics = {
                "narrative": narrative,
                "risk": risk,
                "summary": ai_summary,
                "kpis": kpis,
            }
            
            return {
                "city":        city,
                "lat":         lat,
                "lon":         lon,
                "aqi":         aqi_value,
                "composition": components,
                "category":    aqi_category(aqi_value),
                "analytics":   analytics,
                "metrics":     metrics,
                "weather":     weather,
                "updatedAt":   datetime.utcnow().isoformat(),
            }
        except Exception as e:
            return {"error": f"Failed to fetch data for {city}: {str(e)}"}

    return jsonify({"city1": fetch(city1), "city2": fetch(city2)})


def _fetch_single_city_aqi(city):
    try:
        lat, lon = get_city_coords(city)
        if not lat or not lon:
            return None
        aqi_data = fetch_current_aqi_data(lat, lon)
        components = aqi_data.get("components", {})
        source_name = aqi_data.get("source", "Unknown")
        aqi_value = determine_aqi(components, aqi_data.get("main", {}).get("aqi"), source=source_name)
        if aqi_value is None:
            return None
        return {"name": city, "lat": lat, "lon": lon, "aqi": aqi_value, "source": source_name}
    except Exception:
        return None

@app.route("/aqi-heatmap", methods=["GET"])
def aqi_heatmap():
    cache_key = "aqi_heatmap"
    # Return cached payload immediately when available
    if cache_key in CACHE:
        return jsonify(CACHE[cache_key])

    # Deduplicate concurrent requests
    if cache_key in IN_FLIGHT:
        try:
            payload = IN_FLIGHT[cache_key].result(timeout=10)
            return jsonify(payload)
        except Exception:
            pass

    def _build_heatmap():
        results = []
        for city in HEATMAP_CITIES:
            normalized = city.strip().lower()
            if normalized in BACKGROUND_CACHE:
                data = dict(BACKGROUND_CACHE[normalized])
                data["name"] = city
                results.append(data)

        results.sort(key=lambda x: x.get("aqi", 0), reverse=True)
        CACHE[cache_key] = results
        return results

    fut = EXECUTOR.submit(_build_heatmap)
    IN_FLIGHT[cache_key] = fut
    try:
        payload = fut.result(timeout=15)
        return jsonify(payload)
    except Exception as e:
        if cache_key in CACHE:
            return jsonify(CACHE[cache_key])
        return jsonify({"error": str(e)}), 500
    finally:
        IN_FLIGHT.pop(cache_key, None)


@app.route("/report/<city>", methods=["GET"])
def generate_report(city):
    try:
        lat, lon = get_city_coords(city)
        if not lat or not lon:
            return jsonify({"error": f"Location '{city}' not found"}), 400

        aqi_data = fetch_current_aqi_data(lat, lon, city_name=city)
        components = aqi_data.get("components", {})
        source_name = aqi_data.get("source", "Unknown")
        aqi_value = determine_aqi(components, aqi_data.get("main", {}).get("aqi"), source=source_name)
        history = fetch_openmeteo_history(lat, lon)
        forecast, metrics = train_and_predict_pm25(history) if history else ([], {})
        analytics = build_analytics(components, aqi_value, city_name=city, lat=lat, lon=lon, history=history, forecast=forecast)

        # ── PDF generation ────────────────────────────────
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=0.75 * inch, rightMargin=0.75 * inch,
            topMargin=0.75 * inch,  bottomMargin=0.75 * inch,
        )

        dark_navy  = colors.HexColor("#030D18")
        accent     = colors.HexColor("#00C2B8")
        text_main  = colors.HexColor("#1a202c")
        text_sub   = colors.HexColor("#4a5568")
        light_bg   = colors.HexColor("#f7fafc")
        border_col = colors.HexColor("#e2e8f0")

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "AerisTitle", parent=styles["Normal"],
            fontSize=22, textColor=dark_navy, fontName="Helvetica-Bold",
            spaceAfter=4, alignment=TA_CENTER,
        )
        sub_style = ParagraphStyle(
            "AerisSub", parent=styles["Normal"],
            fontSize=10, textColor=text_sub, fontName="Helvetica",
            alignment=TA_CENTER, spaceAfter=2,
        )
        section_title = ParagraphStyle(
            "SectionTitle", parent=styles["Normal"],
            fontSize=12, textColor=dark_navy, fontName="Helvetica-Bold",
            spaceBefore=14, spaceAfter=6,
        )
        body_style = ParagraphStyle(
            "Body", parent=styles["Normal"],
            fontSize=9.5, textColor=text_main, fontName="Helvetica",
            spaceAfter=4, leading=14,
        )
        tag_style = ParagraphStyle(
            "Tag", parent=styles["Normal"],
            fontSize=8, textColor=accent, fontName="Helvetica-Bold",
            spaceAfter=2,
        )

        story = []
        story.append(Spacer(1, 0.1 * inch))
        story.append(Paragraph("AERIS", title_style))
        story.append(Paragraph("Environmental Intelligence Report", sub_style))
        story.append(Paragraph(f"{city.title()} · Air Quality Assessment", sub_style))
        story.append(Spacer(1, 0.1 * inch))
        story.append(HRFlowable(width="100%", thickness=1, color=accent, spaceAfter=12))

        # AQI summary table
        story.append(Paragraph("Air Quality Summary", section_title))
        aqi_table_data = [
            ["Metric", "Value", "Category"],
            ["AQI (US EPA)", str(aqi_value), aqi_category(aqi_value)],
            ["PM2.5", f"{round(components.get('pm2_5', 0), 1)} µg/m³", "Fine particulates"],
            ["PM10",  f"{round(components.get('pm10', 0), 1)} µg/m³", "Coarse particulates"],
            ["NO₂",   f"{round(components.get('no2', 0), 1)} µg/m³", "Nitrogen dioxide"],
            ["SO₂",   f"{round(components.get('so2', 0), 1)} µg/m³", "Sulfur dioxide"],
            ["O₃",    f"{round(components.get('o3', 0), 1)} µg/m³",  "Ground ozone"],
            ["CO",    f"{round(components.get('co', 0), 1)} mg/m³",   "Carbon monoxide"],
        ]
        t_style = TableStyle([
            ("BACKGROUND",  (0, 0), (-1, 0), dark_navy),
            ("TEXTCOLOR",   (0, 0), (-1, 0), colors.white),
            ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",    (0, 0), (-1, 0), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [light_bg, colors.white]),
            ("FONTNAME",    (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE",    (0, 1), (-1, -1), 9),
            ("TEXTCOLOR",   (0, 1), (-1, -1), text_main),
            ("GRID",        (0, 0), (-1, -1), 0.5, border_col),
            ("TOPPADDING",  (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ])
        tbl = Table(aqi_table_data, colWidths=[1.5 * inch, 1.8 * inch, 3.4 * inch])
        tbl.setStyle(t_style)
        story.append(tbl)

        # Analytics sections
        story.append(Paragraph("Environmental Intelligence", section_title))
        for section_key, section_tag in [
            ("descriptive",  "CURRENT CONDITIONS"),
            ("diagnostic",   "POLLUTION DRIVERS"),
            ("predictive",   "TREND OUTLOOK"),
            ("prescriptive", "HEALTH GUIDANCE"),
        ]:
            text = analytics.get(section_key, "")
            if text:
                story.append(Paragraph(section_tag, tag_style))
                story.append(Paragraph(text, body_style))
                story.append(Spacer(1, 0.05 * inch))

        if analytics.get("context"):
            story.append(Paragraph("ENVIRONMENTAL CONTEXT", tag_style))
            story.append(Paragraph(analytics["context"], body_style))

        # Model metrics
        if metrics and metrics.get("MAE") is not None:
            story.append(Paragraph("Forecast Model Performance", section_title))
            model_name = metrics.get("model", "Prophet")
            mae  = round(metrics.get("MAE", 0), 3)
            rmse = round(metrics.get("RMSE", 0), 3)
            mape = round(metrics.get("MAPE", 0), 1)
            story.append(Paragraph(f"Selected model: {model_name}  ·  MAE: {mae}  ·  RMSE: {rmse}  ·  MAPE: {mape}%", body_style))

        story.append(Spacer(1, 0.2 * inch))
        story.append(HRFlowable(width="100%", thickness=0.5, color=border_col))
        story.append(Paragraph(
            "Data: IQAir AirVisual API · AQI: US EPA Standard · Forecast: Facebook Prophet / Scikit-learn",
            ParagraphStyle("Footer", parent=styles["Normal"], fontSize=7, textColor=text_sub, fontName="Helvetica", alignment=TA_CENTER, spaceBefore=6),
        ))

        doc.build(story)
        buffer.seek(0)
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"{city}_Environmental_Report.pdf",
            mimetype="application/pdf",
        )
    except Exception as e:
        print(f"Report error for {city}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/report/compare", methods=["GET"])
def generate_comparison_report():
    try:
        city1 = request.args.get("city1")
        city2 = request.args.get("city2")
        
        if not city1 or not city2:
            return jsonify({"error": "Both city names required"}), 400

        # Fetch data for both cities
        cache_key = f"compare:{city1.strip().lower()}:{city2.strip().lower()}"

        # Return cached payload immediately
        if cache_key in CACHE:
            return jsonify(CACHE[cache_key])

        # Deduplicate concurrent compare requests
        if cache_key in IN_FLIGHT:
            try:
                payload = IN_FLIGHT[cache_key].result(timeout=10)
                return jsonify(payload)
            except Exception:
                pass

        def _build_compare():
            lat1, lon1 = get_city_coords(city1)
            lat2, lon2 = get_city_coords(city2)
            
            if not (lat1 and lon1 and lat2 and lon2):
                return {"error": "One or both locations not found", "_status": 400}

            aqi1 = fetch_current_aqi_data(lat1, lon1, city_name=city1)
            aqi2 = fetch_current_aqi_data(lat2, lon2, city_name=city2)
            
            comp1 = aqi1.get("components", {})
            comp2 = aqi2.get("components", {})
            
            aqi_val1 = determine_aqi(comp1, aqi1.get("main", {}).get("aqi"), source=aqi1.get("source", "Unknown"))
            aqi_val2 = determine_aqi(comp2, aqi2.get("main", {}).get("aqi"), source=aqi2.get("source", "Unknown"))
            
            hist1 = fetch_openmeteo_history(lat1, lon1)
            hist2 = fetch_openmeteo_history(lat2, lon2)
            
            forecast1, metrics1 = train_and_predict_pm25(hist1) if hist1 else ([], {})
            forecast2, metrics2 = train_and_predict_pm25(hist2) if hist2 else ([], {})
            
            analytics1 = build_analytics(comp1, aqi_val1, city_name=city1, lat=lat1, lon=lon1, history=hist1, forecast=forecast1)
            analytics2 = build_analytics(comp2, aqi_val2, city_name=city2, lat=lat2, lon=lon2, history=hist2, forecast=forecast2)

            out = {"city1": {
                "city": city1, "lat": lat1, "lon": lon1, "aqi": aqi_val1,
                "components": comp1, "analytics": analytics1, "metrics": metrics1,
            }, "city2": {
                "city": city2, "lat": lat2, "lon": lon2, "aqi": aqi_val2,
                "components": comp2, "analytics": analytics2, "metrics": metrics2,
            }}
            CACHE[cache_key] = out
            return out

        fut = EXECUTOR.submit(_build_compare)
        IN_FLIGHT[cache_key] = fut
        try:
            payload = fut.result(timeout=30)
            if isinstance(payload, dict) and payload.get("_status") == 400:
                return jsonify({"error": payload.get("error")}), 400
            return jsonify(payload)
        except Exception as e:
            if cache_key in CACHE:
                return jsonify(CACHE[cache_key])
            return jsonify({"error": str(e)}), 500
        finally:
            IN_FLIGHT.pop(cache_key, None)

    except Exception as e:
        print(f"Comparison report error: {e}")
        return jsonify({"error": str(e)}), 500



# ── Nearby AQI Ranking ───────────────────────────────────────────────────────

import math

def _haversine_km(lat1, lon1, lat2, lon2):
    """Compute great-circle distance between two lat/lon points in km."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _nominatim_suburbs(lat, lon, radius_km=50):
    """
    Query Nominatim for suburb/neighbourhood/town placenames near lat/lon.
    Returns list of (name, lat, lon) tuples.
    """
    # Approximate bounding box (1 degree ≈ 111 km)
    deg = radius_km / 111.0
    viewbox = f"{lon - deg},{lat + deg},{lon + deg},{lat - deg}"
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": "",
            "format": "json",
            "viewbox": viewbox,
            "bounded": 1,
            "featuretype": "settlement",
            "limit": 40,
            "addressdetails": 0,
            "accept-language": "en",
        }
        headers = {"User-Agent": "AerisAQIRanking/1.0"}
        resp = requests.get(url, params=params, headers=headers, timeout=10)
        if resp.status_code != 200:
            return []
        places = resp.json()
        seen = set()
        results = []
        for p in places:
            name = p.get("name", "").strip()
            if not name or name in seen:
                continue
            try:
                plat = float(p["lat"])
                plon = float(p["lon"])
            except (KeyError, ValueError):
                continue
            dist = _haversine_km(lat, lon, plat, plon)
            if dist <= radius_km:
                seen.add(name)
                results.append({"name": name, "lat": plat, "lon": plon, "dist_km": dist})
        return results
    except Exception as e:
        print(f"Nominatim suburb search error: {e}")
        return []


def _reverse_geocode_city(lat, lon):
    """Return city/town name for coordinates using Nominatim reverse geocode."""
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {"lat": lat, "lon": lon, "format": "json", "zoom": 10, "accept-language": "en"}
        headers = {"User-Agent": "AerisAQIRanking/1.0"}
        resp = requests.get(url, params=params, headers=headers, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            addr = data.get("address", {})
            return (
                addr.get("city")
                or addr.get("town")
                or addr.get("county")
                or addr.get("state_district")
                or data.get("display_name", "").split(",")[0]
            )
    except Exception as e:
        print(f"Reverse geocode error: {e}")
    return None


def _fetch_locality_aqi(locality, origin_lat, origin_lon):
    """Fetch AQI for a single locality dict {name, lat, lon, dist_km}."""
    name = locality["name"]
    lat = locality["lat"]
    lon = locality["lon"]
    try:
        aqi_data = fetch_current_aqi_data(lat, lon)
        components = aqi_data.get("components", {}) or {}
        source_name = aqi_data.get("source", "Unknown")
        aqi_value = determine_aqi(components, aqi_data.get("main", {}).get("aqi"), source=source_name)
        if aqi_value is None:
            return None

        dom_key, dom_val = get_dominant_pollutant(components)
        dom_label = pollutant_label(dom_key) if dom_key else "PM2.5"

        # Enhanced trend with context awareness
        pm25 = components.get("pm2_5", 0) or 0
        if pm25 > 55:
            trend = "Rising"
        elif pm25 > 35:
            trend = "Stable"
        else:
            trend = "Improving"

        # Detect nearby feature context and derive area labels
        feature_context, _ = get_nearby_context(name, lat, lon, radius_km=10)
        land_use_tags = []
        land_use_icon = None
        if feature_context.get("industrial_zones"):
            land_use_tags.append("Industrial Zone")
            land_use_icon = "🏭"
        if feature_context.get("traffic_corridors"):
            land_use_tags.append("Traffic Corridor")
            if not land_use_icon:
                land_use_icon = "🚗"
        if feature_context.get("water_bodies"):
            land_use_tags.append("Water Body")
            land_use_icon = "🌊"

        # Build location-specific analytics with geographic coordinates
        risk_snapshot = build_environmental_risk_snapshot(
            components, aqi_value, 
            history=None, forecast=None, 
            source=source_name,
            city_name=name,
            lat=lat, lon=lon
        )
        
        weather = {"humidity": components.get("humidity"), "wind_speed": components.get("wind_speed")}
        ai_summary = build_ai_summary(
            components, aqi_value, weather, risk_snapshot,
            city_name=name,
            lat=lat, lon=lon
        )
        
        analytics_narrative = build_analytics(
            components, aqi_value,
            city_name=name,
            lat=lat, lon=lon,
            history=None, forecast=None
        )

        if not land_use_tags and locality.get("landUseTag"):
            land_use_tags = [locality.get("landUseTag")]
        if not land_use_icon and locality.get("landUseIcon"):
            land_use_icon = locality.get("landUseIcon")

        return {
            "name": name,
            "lat": lat,
            "lon": lon,
            "distance_km": round(locality["dist_km"], 1),
            "aqi": aqi_value,
            "composition": components,
            "category": aqi_category(aqi_value),
            "dominant": dom_label,
            "dominant_key": dom_key or "pm2_5",
            "trend": trend,
            "source": source_name,
            "landUseTag": " & ".join(land_use_tags) if land_use_tags else None,
            "landUseIcon": land_use_icon,
            "note": analytics_narrative.context or locality.get("note") or analytics_narrative.diagnostic,
            # Location-aware analytics with industrial/traffic/water body context
            "analytics": {
                "narrative": analytics_narrative,
                "risk": risk_snapshot,
                "summary": ai_summary,
                "kpis": build_dashboard_kpis(aqi_value, risk_snapshot.get("score", 0), city_name=name),
            },
        }
    except Exception as e:
        print(f"Locality fetch error for {name}: {e}")
        return None


@app.route("/search-cities", methods=["GET"])
def search_cities():
    q = request.args.get("q", default="", type=str).strip().lower()
    limit = request.args.get("limit", default=10, type=int)
    if not q:
        return jsonify([])
    matches = [c for c in CITY_SEARCH if c.lower().startswith(q)]
    return jsonify(matches[:limit])


@app.route("/nearby", methods=["GET"])
def nearby_aqi():
    """
    GET /nearby?lat=<lat>&lon=<lon>&radius=<km>
    Returns AQI for major localities within radius km of the given coordinates.
    """
    try:
        lat = request.args.get("lat", type=float)
        lon = request.args.get("lon", type=float)
        radius = request.args.get("radius", default=50, type=float)

        if lat is None or lon is None:
            return jsonify({"error": "lat and lon query parameters are required"}), 400

        cache_key = f"nearby:{round(lat,2)}:{round(lon,2)}:{int(radius)}"
        # Return cached payload immediately when available
        if cache_key in CACHE:
            return jsonify(CACHE[cache_key])

        # If another request is already building this response, wait for it
        if cache_key in IN_FLIGHT:
            try:
                payload = IN_FLIGHT[cache_key].result(timeout=15)
                return jsonify(payload)
            except Exception:
                pass

        # Step 1: Discover localities
        suburbs = _nominatim_suburbs(lat, lon, radius_km=radius)

        # Step 2: If Nominatim returns very few suburbs, first try curated popular localities
        city_name = _reverse_geocode_city(lat, lon) or ""
        if len(suburbs) < 4:
            slug = city_name.strip().lower() if city_name else ""
            curated = POPULAR_LOCALITIES.get(slug) or POPULAR_LOCALITIES.get(slug.split()[0])
            if curated:
                suburbs = []
                for item in curated:
                    try:
                        plat = float(item.get("lat"))
                        plon = float(item.get("lon"))
                        dist = _haversine_km(lat, lon, plat, plon)
                        if dist <= radius * 1.2:  # allow slightly beyond radius
                            suburbs.append({"name": item.get("name"), "lat": plat, "lon": plon, "dist_km": dist})
                    except Exception:
                        continue
            else:
                # if no curated list, attempt a denser fallback by sampling nearby points
                sampled = []
                seen_names = set()
                # radial sampling at fractions of the radius in 8 directions
                import math
                for r_frac in (0.2, 0.5, 0.8):
                    for angle_deg in range(0, 360, 45):
                        angle = math.radians(angle_deg)
                        # approximate degree offsets
                        deg = (radius * r_frac) / 111.0
                        s_lat = lat + deg * math.sin(angle)
                        # longitude scaling by cos(lat)
                        s_lon = lon + deg * math.cos(angle) / max(0.0001, math.cos(math.radians(lat)))
                        name = _reverse_geocode_city(s_lat, s_lon)
                        if name:
                            key = name.lower()
                            if key in seen_names:
                                continue
                            seen_names.add(key)
                            dist = _haversine_km(lat, lon, s_lat, s_lon)
                            sampled.append({"name": name, "lat": s_lat, "lon": s_lon, "dist_km": dist})
                        # stop collecting if we have enough
                        if len(sampled) >= 12:
                            break
                    if len(sampled) >= 12:
                        break

                # Fallback to city center if no sampled localities found
                if not sampled and city_name:
                    suburbs = [{"name": city_name, "lat": lat, "lon": lon, "dist_km": 0.0}]
                else:
                    suburbs = sampled

        if not suburbs:
            return jsonify({"localities": [], "center_city": None, "source": "no_data"})

        def _build_nearby():
            # Step 3: Parallel AQI fetch (max 12 workers, same pattern as compare endpoint)
            results = []
            with ThreadPoolExecutor(max_workers=min(12, len(suburbs))) as executor:
                futures = {
                    executor.submit(_fetch_locality_aqi, s, lat, lon): s
                    for s in suburbs[:20]  # cap at 20 localities per call
                }
                for future in as_completed(futures):
                    try:
                        result = future.result()
                        if result:
                            results.append(result)
                    except Exception:
                        continue

            if not results:
                return {"localities": [], "center_city": _reverse_geocode_city(lat, lon), "source": "no_data"}

            # Step 4: Sort and return
            results.sort(key=lambda x: x["aqi"])
            center_city = _reverse_geocode_city(lat, lon)

            response = {
                "localities": results,
                "center_city": center_city,
                "count": len(results),
                "source": results[0].get("source", "Open-Meteo") if results else "unknown",
            }
            # cache the result in the shared CACHE and persist it for later tracing
            CACHE[cache_key] = response
            RESPONSE_CACHE[cache_key] = response
            save_response_cache()
            return response

        # submit build job and wait (deduplicates concurrent requests)
        fut = EXECUTOR.submit(_build_nearby)
        IN_FLIGHT[cache_key] = fut
        try:
            payload = fut.result(timeout=30)
            return jsonify(payload)
        except Exception as e:
            # on error, return cached payload when available
            if cache_key in CACHE:
                return jsonify(CACHE[cache_key])
            return jsonify({"error": str(e)}), 500
        finally:
            IN_FLIGHT.pop(cache_key, None)

    except Exception as e:
        print(f"Nearby AQI error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/cache/clear", methods=["POST"])
def cache_clear():
    """Clear a specific cache key or the entire CACHE. POST body or query:
    - key=<cache_key>  -> clears that key
    - all=1            -> clears entire CACHE
    Optional: provide header X-Cache-Admin or env var CACHE_ADMIN_TOKEN for simple protection.
    """
    token = request.headers.get("X-Cache-Admin") or os.getenv("CACHE_ADMIN_TOKEN")
    if os.getenv("CACHE_ADMIN_TOKEN") and token != os.getenv("CACHE_ADMIN_TOKEN"):
        return jsonify({"error": "unauthorized"}), 403

    key = request.values.get("key")
    all_flag = request.values.get("all")
    if all_flag and all_flag in ("1", "true", "yes"):
        CACHE.clear()
        return jsonify({"cleared": "all"})
    if key:
        if key in CACHE:
            CACHE.pop(key, None)
            return jsonify({"cleared": key})
        return jsonify({"error": "not_found"}), 404
    return jsonify({"error": "missing key or all flag"}), 400


@app.route("/cache/refresh", methods=["POST"])
def cache_refresh():
    """Refresh a given cache key by forcing rebuild. For keys we know how to rebuild (aqi:<city>, nearby:lat:lon, aqi_ranking, aqi_heatmap, compare:city1:city2).
    This triggers a background rebuild and returns the new value when ready.
    """
    token = request.headers.get("X-Cache-Admin") or os.getenv("CACHE_ADMIN_TOKEN")
    if os.getenv("CACHE_ADMIN_TOKEN") and token != os.getenv("CACHE_ADMIN_TOKEN"):
        return jsonify({"error": "unauthorized"}), 403

    key = request.values.get("key")
    if not key:
        return jsonify({"error": "missing key"}), 400

    # For known keys, attempt to rebuild by calling the corresponding endpoint logic
    try:
        if key.startswith("aqi:"):
            city = key.split("aqi:", 1)[1]
            # force rebuild by calling internal builder
            def _build():
                return get_aqi(city)
            fut = EXECUTOR.submit(_build)
            IN_FLIGHT[key] = fut
            payload = fut.result(timeout=30)
            # result is a Flask response; try to extract json
            try:
                j = payload.get_json()
            except Exception:
                j = None
            return jsonify({"refreshed": key, "result": j})

        if key == "aqi_ranking":
            return aqi_ranking()
        if key == "aqi_heatmap":
            return aqi_heatmap()
        if key.startswith("compare:"):
            _, rest = key.split("compare:", 1)
            parts = rest.split(":")
            if len(parts) >= 2:
                city1, city2 = parts[0], parts[1]
                with app.test_request_context(f"/report/compare?city1={city1}&city2={city2}"):
                    return generate_comparison_report()

        return jsonify({"error": "unknown_key"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Start background collector only after all helper functions are defined
    try:
        if 'collector_thread' in globals() and not collector_thread.is_alive():
            collector_thread.start()
    except Exception as e:
        print(f"Failed to start background collector: {e}")
    app.run(debug=True)
