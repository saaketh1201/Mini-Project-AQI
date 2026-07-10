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
        return {'name': locality['name'], 'lat': locality['lat'], 'lon': locality['lon'], 'aqi': 75, 'composition': {}, 'category': 'Moderate', 'dominant': 'pm2_5', 'dominant_key': 'pm2_5', 'trend': 'stable', 'source': 'mock'}

    monkeypatch.setattr(backend_app, '_reverse_geocode_city', fake_reverse)
    monkeypatch.setattr(backend_app, '_nominatim_suburbs', fake_nominatim_suburbs)
    monkeypatch.setattr(backend_app, '_fetch_locality_aqi', fake_fetch_locality_aqi)

    resp = client.get('/nearby?lat=17.4&lon=78.4&radius=50')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'localities' in data
    assert len(data['localities']) >= 1
        # End of test_nearby_returns_localities