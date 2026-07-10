from location_context import (
    get_nearby_context,
    detect_industrial_influence,
    detect_traffic_influence,
    detect_water_body_influence,
    get_seasonal_context,
)

POLLUTANT_LABELS = {
    "pm2_5": "PM2.5",
    "pm10": "PM10",
    "no2": "NO₂",
    "so2": "SO₂",
    "o3": "O₃",
    "co": "CO",
    "nh3": "NH₃",
}

THRESHOLDS = {
    "pm2_5": 12,
    "pm10": 54,
    "no2": 100,
    "so2": 196,
    "o3": 140,
    "co": 10000,
    "nh3": 100,
}


def _classify_level(score):
    if score >= 80:
        return "Severe"
    if score >= 60:
        return "High"
    if score >= 35:
        return "Moderate"
    return "Low"


def _normalize_metric(value, max_value):
    if value is None:
        return 0.0
    return max(0.0, min(100.0, (float(value) / max_value) * 100.0))


def _fetch_nearby_feature_context(city_name, lat, lon, components):
    if not city_name or lat is None or lon is None:
        return {
            "industrial": [],
            "traffic": [],
            "water": [],
            "industrial_confidence": 0.0,
            "traffic_confidence": 0.0,
            "water_influence": 0.0,
        }

    is_industrial, zones, ind_conf = detect_industrial_influence(lat, lon, city_name, components)
    is_traffic, corridors, traffic_conf = detect_traffic_influence(lat, lon, city_name, components)
    near_water, water_bodies, water_inf = detect_water_body_influence(lat, lon, city_name, components)

    return {
        "industrial": zones if is_industrial else [],
        "traffic": corridors if is_traffic else [],
        "water": water_bodies if near_water else [],
        "industrial_confidence": ind_conf,
        "traffic_confidence": traffic_conf,
        "water_influence": water_inf,
    }


def build_environmental_risk_snapshot(components, aqi_value, history=None, forecast=None, source="Unknown", city_name=None, lat=None, lon=None):
    """
    Enhanced ERS with location-specific factors: industrial influence, traffic, water bodies.
    """
    dominant_pollutant = None
    dominant_value = 0.0

    if components:
        for pollutant, value in components.items():
            if value is None:
                continue
            threshold = THRESHOLDS.get(pollutant, 1)
            if threshold and value / threshold > dominant_value:
                dominant_pollutant = pollutant
                dominant_value = value

    dominant_label = POLLUTANT_LABELS.get(dominant_pollutant, dominant_pollutant.upper() if dominant_pollutant else "PM2.5")

    dominant_ratio = 0.0
    if dominant_pollutant:
        threshold = THRESHOLDS.get(dominant_pollutant, 1)
        dominant_ratio = (dominant_value / threshold) if threshold else 0.0

    # ─ Enhanced ERS scoring with location-specific factors ────────────────
    aqi_component = _normalize_metric(aqi_value, 500.0)
    pm25_component = _normalize_metric(components.get("pm2_5") if components else None, 120.0)
    pm10_component = _normalize_metric(components.get("pm10") if components else None, 200.0)
    no2_component = _normalize_metric(components.get("no2") if components else None, 200.0)
    ozone_component = _normalize_metric(components.get("o3") if components else None, 200.0)
    
    # Weather component: low humidity → poor dispersion
    weather_component = 0.0
    if components:
        humidity = components.get("humidity")
        if humidity is not None:
            weather_component = max(0.0, min(100.0, 100.0 - float(humidity)))
    
    # Context-aware components (industrial, traffic, water body influence)
    industrial_boost = 0.0
    traffic_boost = 0.0
    water_dispersion = 0.0
    
    if city_name and lat is not None and lon is not None:
        context = _fetch_nearby_feature_context(city_name, lat, lon, components)

        if context["industrial"]:
            industrial_boost = 15 * context["industrial_confidence"]  # Up to 15-point boost
        if context["traffic"]:
            traffic_boost = 12 * context["traffic_confidence"]  # Up to 12-point boost
        if context["water"]:
            water_dispersion = -8 * context["water_influence"]  # Up to -8-point reduction

    forecast_component = 0.0
    if forecast and len(forecast) > 1:
        first_val = forecast[0].get("yhat", forecast[0].get("y", 0)) or 0
        last_val = forecast[-1].get("yhat", forecast[-1].get("y", 0)) or 0
        if first_val > 0:
            forecast_component = max(0.0, min(100.0, abs(((last_val - first_val) / first_val) * 100.0) * 2.0))

    # Weighted ERS calculation with location factors
    score = int(round(
        0.35 * aqi_component +        # Main AQI (reduced from 0.40 to make room for context)
        0.20 * pm25_component +       # PM2.5 is primary health concern
        0.10 * pm10_component +       # Coarse particles
        0.10 * no2_component +        # Traffic/combustion
        0.05 * ozone_component +      # Photochemical smog
        0.05 * weather_component +    # Dispersion conditions
        0.10 * forecast_component +   # Future trend
        industrial_boost +             # Location: industrial zones
        traffic_boost +                # Location: traffic corridors
        water_dispersion               # Location: water bodies (negative = good)
    ))
    
    # Clamp score to 0-100 range
    score = max(0, min(100, score))
    level = _classify_level(score)

    if forecast and len(forecast) > 1:
        first_val = forecast[0].get("yhat", forecast[0].get("y", 0)) or 0
        last_val = forecast[-1].get("yhat", forecast[-1].get("y", 0)) or 0
        if last_val > first_val * 1.1:
            trend = f"Worsening ({round(((last_val - first_val) / first_val) * 100, 1)}%)"
        elif last_val < first_val * 0.9:
            trend = f"Improving ({round(((last_val - first_val) / first_val) * 100, 1)}%)"
        else:
            trend = "Stable"
    elif history and len(history) > 1:
        first_val = history[0].get("y", 0) or 0
        last_val = history[-1].get("y", 0) or 0
        if last_val > first_val * 1.05:
            trend = "Rising over the recent window"
        elif last_val < first_val * 0.95:
            trend = "Falling over the recent window"
        else:
            trend = "Broadly stable"
    else:
        trend = "Trend data is limited"

    if aqi_value >= 200:
        weather = "Stable air and weak dispersion are trapping pollutants near the surface."
    elif aqi_value >= 100:
        weather = "Moderate wind and temperature inversions are amplifying local accumulation."
    else:
        weather = "Weather conditions are helping disperse pollutants effectively."

    confidence = 72
    if source and "IQAir" in str(source):
        confidence += 18
    if history and len(history) > 3:
        confidence += 6
    if forecast and len(forecast) > 1:
        confidence += 4

    confidence = max(70, min(98, confidence))

    return {
        "score": score,
        "level": level,
        "dominant_pollutant": {
            "key": dominant_pollutant,
            "label": dominant_label,
            "value": round(dominant_value, 1) if dominant_value else 0,
            "unit": "µg/m³",
        },
        "weather": weather,
        "trend": trend,
        "confidence": confidence,
        "source": source,
        "formula": "ERS = 35% AQI + 20% PM2.5 + 10% PM10 + 10% NO₂ + 5% O₃ + 5% Weather + 10% Forecast + Location Factors (Industrial/Traffic/Water)",
    }


def build_ai_summary(components, aqi_value, weather, risk_snapshot, city_name=None, lat=None, lon=None):
    """Generate AI summary with location context awareness."""
    pollutant = "PM2.5"
    if components and components.get("pm2_5") is not None:
        pollutant = "PM2.5"
    elif components and components.get("pm10") is not None:
        pollutant = "PM10"

    humidity = weather.get("humidity") if weather else None
    wind_speed = weather.get("wind_speed") if weather else None
    city_text = f" in {city_name}" if city_name else ""
    category = _aqi_category(aqi_value)

    summary = (
        f"Air quality{city_text} is currently {aqi_value} on the US AQI scale ({category}), "
        f"driven mainly by elevated {pollutant}."
    )
    if humidity is not None or wind_speed is not None:
        summary += " "
        if humidity is not None:
            summary += f"Humidity is {humidity}%"
        if humidity is not None and wind_speed is not None:
            summary += " and "
        if wind_speed is not None:
            summary += f"wind speed is {wind_speed} km/h"
        summary += "."

    summary += (
        f" The Environmental Risk Score is {risk_snapshot.get('score', 0)}/100 ({risk_snapshot.get('level', 'Moderate')})"
        f" with a {risk_snapshot.get('trend', 'stable')} outlook."
    )

    if components:
        sorted_components = sorted(
            [(k, v) for k, v in components.items() if v is not None and k in POLLUTANT_LABELS],
            key=lambda x: x[1], reverse=True
        )
        composition_parts = []
        for pollutant_key, value in sorted_components[:2]:
            label = POLLUTANT_LABELS.get(pollutant_key, pollutant_key.upper())
            threshold = THRESHOLDS.get(pollutant_key, 1)
            ratio = value / threshold if threshold else 0
            composition_parts.append(f"{label} at {round(value, 1)} µg/m³ ({round(ratio, 1)}× guideline)")
        if composition_parts:
            summary += " Main pollutant composition is " + " and ".join(composition_parts) + "."

    location_phrases = []
    if city_name and lat is not None and lon is not None:
        context = _fetch_nearby_feature_context(city_name, lat, lon, components)

        if context["industrial"] and context["industrial_confidence"] > 0.25:
            names = ", ".join(z.get("name") for z in context["industrial"][:2] if z.get("name"))
            closest_zone = context["industrial"][0] if context["industrial"] else {}
            distance_note = (
                f" ({closest_zone['distance_km']} km away)" if closest_zone.get("distance_km") is not None else ""
            )
            if names:
                location_phrases.append(f"nearby industrial areas such as {names}{distance_note}")
            else:
                location_phrases.append("nearby industrial activity")

        if context["traffic"] and context["traffic_confidence"] > 0.25:
            names = ", ".join(c.get("name") for c in context["traffic"][:2] if c.get("name"))
            if names:
                location_phrases.append(f"traffic corridors like {names}")
            else:
                location_phrases.append("local high-density traffic")

        if context["water"] and context["water_influence"] > 0.15:
            names = ", ".join(w.get("name") for w in context["water"][:2] if w.get("name"))
            if names:
                location_phrases.append(f"water bodies such as {names}")
            else:
                location_phrases.append("nearby water bodies")

    if location_phrases:
        summary += " Location context indicates " + ", ".join(location_phrases) + "."
    elif city_name and components:
        summary += " Local conditions are driven by site-specific pollutant composition and nearby urban activity."

    return summary


def build_analytics(components, aqi_value, city_name=None, lat=None, lon=None, history=None, forecast=None):
    """
    Build comprehensive, location-aware analytics narrative.
    Includes: descriptive, diagnostic, predictive, prescriptive, and context.
    """
    if forecast is None:
        forecast = history or []

    descriptive = f"Current AQI is {aqi_value} ({_aqi_category(aqi_value)}) based on US EPA measurement standards."

    if not components:
        return {
            "descriptive": descriptive,
            "diagnostic": "Detailed pollutant data is unavailable for this location.",
            "predictive": "Forecast data is unavailable.",
            "prescriptive": _health_recommendations(aqi_value),
            "context": None,
        }

    # Identify dominant pollutant
    pollutant, pollutant_value = _get_dominant_pollutant(components)
    pollutant_name = POLLUTANT_LABELS.get(pollutant, "particulate matter") if pollutant else "particulate matter"
    threshold = THRESHOLDS.get(pollutant, 1)
    ratio = (pollutant_value / threshold) if threshold and pollutant_value else 0

    if ratio >= 3.0:
        severity = f"critically elevated at {round(pollutant_value, 1)} µg/m³ — more than {round(ratio, 1)}× the safe-exposure threshold"
    elif ratio >= 2.0:
        severity = f"substantially elevated at {round(pollutant_value, 1)} µg/m³ ({round(ratio, 1)}× the EPA guideline)"
    elif ratio >= 1.0:
        severity = f"above safe limits at {round(pollutant_value, 1)} µg/m³ (threshold: {threshold} µg/m³)"
    else:
        severity = f"within guideline limits at {round(pollutant_value, 1)} µg/m³"

    diagnostic = f"{pollutant_name} is the dominant pollutant, {severity}."

    # ─ Enhanced diagnostic with location context ──────────────────────────
    pm25 = components.get("pm2_5", 0) or 0
    pm10 = components.get("pm10", 0) or 0
    no2 = components.get("no2", 0) or 0
    so2 = components.get("so2", 0) or 0
    co = components.get("co", 0) or 0

    source_clues = []
    
    # Location-based source detection
    if city_name and lat is not None and lon is not None:
        is_industrial, industrial_zones, ind_conf = detect_industrial_influence(lat, lon, city_name, components)
        is_traffic, traffic_corridors, traffic_conf = detect_traffic_influence(lat, lon, city_name, components)
        near_water, water_bodies, water_inf = detect_water_body_influence(lat, lon, city_name, components)
        
        if is_industrial and ind_conf > 0.4:
            if so2 > 20:
                source_clues.append(f"industrial combustion signature (SO₂: {round(so2, 1)} µg/m³)")
            if industrial_zones:
                closest = min(industrial_zones, key=lambda z: z["distance_km"])
                source_clues.append(f"proximity to {closest.get('name', 'industrial zone')} ({closest.get('distance_km', 0)} km away)")
        
        if is_traffic and traffic_conf > 0.4:
            source_clues.append(f"vehicular emissions (NO₂: {round(no2, 1)} µg/m³, CO: {round(co, 0)} µg/m³)")
        
        if near_water and water_inf > 0.5:
            diagnostic += f" Proximity to water body ({[w.get('name') for w in water_bodies][0]} approx) aids pollutant dispersion."
    else:
        # Fallback to basic heuristics
        if pm25 > 35:
            source_clues.append("fine particulate loading consistent with combustion sources (vehicular, biomass, or industrial)")
        if pm10 > pm25 * 2 and pm10 > 50:
            source_clues.append("elevated coarse particles suggesting road dust, construction activity, or soil resuspension")
        if no2 > 40:
            source_clues.append("elevated NO₂ indicative of high-density traffic or power generation emissions")
        if so2 > 20:
            source_clues.append("sulfur dioxide presence pointing to industrial combustion or coal use")

    if source_clues:
        diagnostic += " Pollution signature shows: " + "; ".join(source_clues) + "."

    # ─ Predictive trend ────────────────────────────────────────────────────
    predictive = "Insufficient data for a reliable trend projection."
    if forecast and len(forecast) > 1:
        first_val = forecast[0].get("yhat", forecast[0].get("y", 0))
        last_val = forecast[-1].get("yhat", forecast[-1].get("y", 0))
        if first_val and first_val > 0:
            change_pct = round(((last_val - first_val) / first_val) * 100, 1)
            if change_pct > 10:
                trend = f"worsening ({change_pct:+.1f}%)"
            elif change_pct < -10:
                trend = f"improving ({change_pct:+.1f}%)"
            else:
                trend = f"largely stable ({change_pct:+.1f}%)"
            predictive = (
                f"Forecast model projects PM2.5 {trend} over the next {len(forecast)} periods, "
                f"moving from {round(first_val, 1)} to {round(last_val, 1)} µg/m³. "
            )
            if last_val > 35:
                predictive += "Continued elevated readings are expected — plan outdoor activities accordingly."
            elif last_val < 12:
                predictive += "If the trend holds, conditions should improve to acceptable levels."
    elif history and len(history) > 1:
        s, e = history[0].get("y", 0), history[-1].get("y", 0)
        if s > 0:
            trend_word = "increasing" if e > s * 1.05 else "decreasing" if e < s * 0.95 else "stable"
            predictive = (
                f"Historical 30-day PM2.5 record shows a {trend_word} trend, "
                f"from {round(s, 1)} to {round(e, 1)} µg/m³."
            )

    prescriptive = _health_recommendations(aqi_value)
    if aqi_value > 150:
        prescriptive += " Keep windows closed and use HEPA air purification indoors."
    elif aqi_value > 100:
        prescriptive += " Sensitive individuals should limit outdoor time, especially during peak traffic hours."

    # ─ Environmental context ───────────────────────────────────────────────
    context = None
    if city_name:
        # Try to use known city profiles first
        context = _get_city_profile_notes(city_name)
        if not context:
            # Generate context from detected features
            context_parts = []
            location_details = []
            if city_name and lat is not None and lon is not None:
                context = _fetch_nearby_feature_context(city_name, lat, lon, components)

                if context["industrial"] and context["industrial_confidence"] > 0.3:
                    loc_names = ", ".join(z.get("name") for z in context["industrial"][:2] if z.get("name"))
                    proximity = context["industrial"][0].get("distance_km") if context["industrial"] else None
                    if loc_names:
                        location_details.append(f"industrial zone(s) such as {loc_names}{' (' + str(proximity) + ' km away)' if proximity is not None else ''}")
                    else:
                        location_details.append("nearby industrial activity")

                if context["traffic"] and context["traffic_confidence"] > 0.3:
                    road_names = ", ".join(c.get("name") for c in context["traffic"][:2] if c.get("name"))
                    if road_names:
                        location_details.append(f"traffic corridors like {road_names}")
                    else:
                        location_details.append("local high-density traffic")

                if context["water"] and context["water_influence"] > 0.2:
                    water_names = ", ".join(w.get("name") for w in context["water"][:2] if w.get("name"))
                    location_details.append(f"water bodies such as {water_names}")

            if location_details:
                context_parts.append(
                    "Location analysis indicates " + ", ".join(location_details) + "."
                )

            if pm25 > 35:
                context_parts.append(
                    "The fine particulate concentration suggests proximity to combustion sources — "
                    "likely vehicular traffic, industrial activity, or open burning."
                )
            if no2 > 40:
                context_parts.append(
                    "Elevated nitrogen dioxide levels are a strong indicator of dense traffic corridors "
                    "or nearby combustion sources."
                )
            if pm10 > 80:
                context_parts.append(
                    "High coarse particle loading is associated with construction activity, "
                    "unpaved road surfaces, or wind-resuspended soil."
                )
            if context_parts:
                context = " ".join(context_parts)

    return {
        "descriptive": descriptive,
        "diagnostic": diagnostic,
        "predictive": predictive,
        "prescriptive": prescriptive,
        "context": context,
    }


def _aqi_category(aqi):
    """Determine AQI category from value."""
    if aqi is None:
        return "Unknown"
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Moderate"
    if aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    if aqi <= 200:
        return "Unhealthy"
    if aqi <= 300:
        return "Very Unhealthy"
    return "Hazardous"


def _health_recommendations(aqi):
    """Get health recommendations based on AQI."""
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


def _get_dominant_pollutant(components):
    """Find the dominant pollutant by threshold ratio."""
    best = (None, 0)
    for pollutant, value in components.items():
        if value is None:
            continue
        threshold = THRESHOLDS.get(pollutant, 1)
        score = value / threshold if threshold else 0
        if score > best[1]:
            best = (pollutant, value)
    return best


def _get_city_profile_notes(city_name):
    """Get city-specific environmental notes from profiles."""
    CITY_PROFILES = {
        "delhi": "Dense traffic corridors along NH-44 and ring roads, heavy brick kiln activity in peripheral zones, and seasonal crop burning from neighboring states (Punjab, Haryana) are primary PM2.5 drivers. Low-wind winter inversions trap pollutants near the surface.",
        "beijing": "Steel and cement industries in the surrounding Hebei province contribute to regional transport of particulate matter. Traffic density along the Fifth Ring Road and coal combustion for winter heating are the dominant local sources.",
        "jakarta": "Highly congested road network with poor mass transit penetration generates significant tailpipe PM2.5 and NO₂. Coastal low-lying geography limits vertical mixing, compounding ground-level pollutant accumulation.",
        "mumbai": "Port operations and shipping traffic contribute to SO₂ and PM10. Construction activity across the Mumbai Metro expansion corridors elevates coarse particulate levels. Sea breeze typically aids dispersion but is weaker in monsoon shoulder seasons.",
        "hyderabad": "Rapid urban expansion and construction activity drive coarse PM. Pharmaceutical and IT corridor industrial zones contribute to VOC and NO₂ loading. Relatively flat terrain offers some pollutant dispersion advantage.",
        "los_angeles": "Basin geography creates persistent thermal inversions that trap photochemical smog. High vehicle miles traveled across the freeway network are the dominant O₃ and PM2.5 precursor source. Wildfires during dry season cause episodic AQI spikes.",
        "london": "Diesel vehicle emissions in the City and Central London remain the leading NO₂ source despite ULEZ expansion. Weather-driven episodes with continental air mass transport periodically elevate PM2.5 above background levels.",
        "tokyo": "Advanced emissions controls have significantly reduced local PM2.5. Long-range transport of aerosols from Chinese industrial zones represents the primary episodic source. Prevailing westerly winds govern pollution episodes.",
        "santiago": "The Andes mountain range creates a closed basin that traps pollutants, especially during winter temperature inversions. Residential wood burning for heating and diesel buses are the dominant PM2.5 sources.",
        "seoul": "Long-range transport of PM2.5 from Chinese industrial regions is estimated to contribute 30–50% of total PM2.5 loading on high-AQI days. Local diesel emissions and seasonal heating exacerbate this baseline.",
    }
    city_key = city_name.strip().lower().split(",")[0].strip()
    return CITY_PROFILES.get(city_key, None)


def build_dashboard_kpis(aqi_value, ers_score, city_name=None):
    return {
        "average_aqi": int(round(aqi_value)),
        "average_ers": int(round(ers_score)),
        "cleanest_city": city_name or "No clean city",
        "most_polluted_city": city_name or "No hotspot",
        "trend": "Stable" if ers_score < 60 else "Elevated",
        "highest_risk_region": city_name or "No high-risk region",
    }
