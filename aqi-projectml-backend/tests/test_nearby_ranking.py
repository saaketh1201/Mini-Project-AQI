import pytest
import app as backend_app
import app as mod


@pytest.fixture
def client():
    backend_app.app.testing = True
    with backend_app.app.test_client() as c:
        yield c


def test_aqi_ranking_cached(monkeypatch, client):
    # Prepare background cache with deterministic values
    backend_app.BACKGROUND_CACHE.clear()
    backend_app.BACKGROUND_CACHE['testcity'] = {'aqi': 150, 'lat': 0.0, 'lon': 0.0}
    backend_app.RANKING_CITIES.insert(0, 'TestCity')

    # Call ranking endpoint
    resp = client.get('/aqi-ranking')
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert any(item.get('name') == 'TestCity' or item.get('name') == 'TestCity' for item in data)


def test_nearby_returns_localities(monkeypatch, client):
    # Monkeypatch geocoding and local AQI fetches to deterministic outputs
    def fake_reverse(lat, lon):
        return 'TestCity'

    def fake_nominatim_suburbs(lat, lon, radius_km=50):
        return [{'name': 'LocA', 'lat': lat + 0.01, 'lon': lon + 0.01, 'dist_km': 1.4},
                {'name': 'LocB', 'lat': lat + 0.02, 'lon': lon + 0.02, 'dist_km': 2.8}]

    def fake_fetch_locality_aqi(locality, center_lat, center_lon):
        return {'name': locality['name'], 'lat': locality['lat'], 'lon': locality['lon'], 'aqi': 75, 'composition': {}, 'category': 'Moderate', 'dominant': 'pm2_5', 'dominant_key': 'pm2_5', 'trend': 'stable', 'source': 'IQAir AirVisual API'}

    monkeypatch.setattr(backend_app, '_reverse_geocode_city', fake_reverse)
    monkeypatch.setattr(backend_app, '_nominatim_suburbs', fake_nominatim_suburbs)
    monkeypatch.setattr(backend_app, '_fetch_locality_aqi', fake_fetch_locality_aqi)

    resp = client.get('/nearby?lat=17.4&lon=78.4&radius=50')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'localities' in data
    assert len(data['localities']) >= 1


def test_nearby_uses_hyderabad_curated_localities(monkeypatch, client):
    def fake_reverse(lat, lon):
        return 'Hyderabad'

    def fake_nominatim_suburbs(lat, lon, radius_km=50):
        return []

    def fake_fetch_locality_aqi(locality, center_lat, center_lon):
        return {
            'name': locality['name'],
            'lat': locality['lat'],
            'lon': locality['lon'],
            'distance_km': round(locality['dist_km'], 1),
            'aqi': 72,
            'composition': {'pm2_5': 22},
            'category': 'Moderate',
            'dominant': 'PM2.5',
            'dominant_key': 'pm2_5',
            'trend': 'stable',
            'source': 'Open-Meteo Air Quality API'
        }

    monkeypatch.setattr(backend_app, '_reverse_geocode_city', fake_reverse)
    monkeypatch.setattr(backend_app, '_nominatim_suburbs', fake_nominatim_suburbs)
    monkeypatch.setattr(backend_app, '_fetch_locality_aqi', fake_fetch_locality_aqi)

    resp = client.get('/nearby?lat=17.3850&lon=78.4867&radius=50')
    assert resp.status_code == 200
    data = resp.get_json()
    names = {item['name'] for item in data.get('localities', [])}
    assert names
    assert any('Patancheru' in name or 'Madhapur' in name or 'Secunderabad' in name for name in names)


def test_fetch_locality_handles_dict_based_analytics(monkeypatch):
    def fake_fetch_current_aqi_data(lat, lon):
        return {
            'components': {'pm2_5': 22, 'pm10': 45, 'no2': 30, 'so2': 10, 'co': 500, 'o3': 20},
            'main': {'aqi': 80},
            'source': 'IQAir AirVisual API'
        }

    monkeypatch.setattr(backend_app, 'fetch_current_aqi_data', fake_fetch_current_aqi_data)
    monkeypatch.setattr(backend_app, 'get_nearby_context', lambda *args, **kwargs: ({}, None))

    locality = {'name': 'Test Locality', 'lat': 17.38, 'lon': 78.48, 'dist_km': 1.2}
    result = backend_app._fetch_locality_aqi(locality, 17.385, 78.4867)

    assert result['name'] == 'Test Locality'
    assert result['aqi'] == 80
    assert 'diagnostic' in result['analytics']['narrative']
    assert result['note']


def test_fetch_locality_ignores_distant_water_context(monkeypatch):
    def fake_fetch_current_aqi_data(lat, lon):
        return {
            'components': {'pm2_5': 22, 'pm10': 35, 'no2': 28, 'so2': 12, 'co': 420, 'o3': 18},
            'main': {'aqi': 66},
            'source': 'Open-Meteo Air Quality API'
        }

    monkeypatch.setattr(backend_app, 'fetch_current_aqi_data', fake_fetch_current_aqi_data)
    monkeypatch.setattr(backend_app, 'get_nearby_context', lambda *args, **kwargs: ({
        'industrial_zones': [],
        'traffic_corridors': [],
        'water_bodies': [{'name': 'Lake', 'distance_km': 6.5}],
    }, None))

    locality = {'name': 'Dry Zone', 'lat': 17.38, 'lon': 78.48, 'dist_km': 1.2}
    result = backend_app._fetch_locality_aqi(locality, 17.385, 78.4867)

    assert result is not None
    assert 'Water Body' not in (result.get('landUseTag') or '')
    assert '🌊' not in (result.get('landUseIcon') or '')


def test_fetch_locality_includes_area_health_advice(monkeypatch):
    def fake_fetch_current_aqi_data(lat, lon):
        return {
            'components': {'pm2_5': 70, 'pm10': 120, 'no2': 60, 'so2': 15, 'co': 900, 'o3': 25},
            'main': {'aqi': 138},
            'source': 'IQAir AirVisual API'
        }

    monkeypatch.setattr(backend_app, 'fetch_current_aqi_data', fake_fetch_current_aqi_data)
    monkeypatch.setattr(backend_app, 'get_nearby_context', lambda *args, **kwargs: ({
        'industrial_zones': [{'name': 'Industrial Park', 'distance_km': 2.5}],
        'traffic_corridors': [{'name': 'Main Road', 'distance_km': 1.2}],
        'water_bodies': [],
    }, None))

    locality = {'name': 'Health Check Zone', 'lat': 17.38, 'lon': 78.48, 'dist_km': 1.2}
    result = backend_app._fetch_locality_aqi(locality, 17.385, 78.4867)

    assert result is not None
    assert 'healthAdvice' in result
    assert isinstance(result['healthAdvice'], str)
    assert 'outdoor' in result['healthAdvice'].lower() or 'sensitive' in result['healthAdvice'].lower()


def test_health_advice_varies_by_location_and_pollutant_profile():
    traffic_context = {
        'industrial_zones': [],
        'traffic_corridors': [{'name': 'Main Road', 'distance_km': 1.2}],
        'water_bodies': [],
    }
    industrial_context = {
        'industrial_zones': [{'name': 'Industrial Park', 'distance_km': 2.5}],
        'traffic_corridors': [],
        'water_bodies': [],
    }

    first = backend_app._build_locality_health_advice('Traffic Zone', 118, {'pm2_5': 48, 'pm10': 90, 'no2': 72, 'so2': 18, 'co': 960, 'o3': 34}, traffic_context)
    second = backend_app._build_locality_health_advice('Industrial Zone', 118, {'pm2_5': 63, 'pm10': 110, 'no2': 30, 'so2': 40, 'co': 420, 'o3': 22}, industrial_context)

    assert first['advice'] != second['advice']
    assert 'traffic' in first['advice'].lower() or 'commute' in first['advice'].lower()
    assert 'industrial' in second['advice'].lower() or 'sulfur dioxide' in second['advice'].lower() or 'industrial' in second['advice'].lower()


def test_fetch_locality_rejects_mock_source(monkeypatch):
    def fake_fetch_current_aqi_data(lat, lon):
        return {
            'components': {'pm2_5': 18, 'pm10': 30, 'no2': 20, 'so2': 8, 'co': 400, 'o3': 18},
            'main': {'aqi': 42},
            'source': 'Mock fallback'
        }

    monkeypatch.setattr(backend_app, 'fetch_current_aqi_data', fake_fetch_current_aqi_data)

    locality = {'name': 'Fake Locality', 'lat': 17.38, 'lon': 78.48, 'dist_km': 1.2}
    result = backend_app._fetch_locality_aqi(locality, 17.385, 78.4867)

    assert result is None


def test_analytics_context_is_string_not_dict(monkeypatch):
    components = {'pm2_5': 35, 'pm10': 50, 'no2': 24, 'so2': 10, 'co': 450, 'o3': 28}
    monkeypatch.setattr(backend_app, 'detect_industrial_influence', lambda *args, **kwargs: (True, [{'name': 'Industrial Park', 'distance_km': 3.2}], 0.8))
    monkeypatch.setattr(backend_app, 'detect_traffic_influence', lambda *args, **kwargs: (True, [{'name': 'Main Road', 'distance_km': 1.5}], 0.7))
    monkeypatch.setattr(backend_app, 'detect_water_body_influence', lambda *args, **kwargs: (True, [{'name': 'Lake', 'distance_km': 6.5}], 0.4))

    narrative = backend_app.build_analytics(components, 96, city_name='Hyderabad', lat=17.385, lon=78.4867)

    assert isinstance(narrative.get('context'), str)
    assert 'industrial' in narrative['context'].lower()
