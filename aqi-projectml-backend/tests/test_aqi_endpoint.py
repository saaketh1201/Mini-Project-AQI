import json
import pytest
import app as backend_app

# Import the module under test
import app as mod

@pytest.fixture
def client():
    backend_app.app.testing = True
    with backend_app.app.test_client() as c:
        yield c

def test_aqi_endpoint_cached(monkeypatch, client):
    # Monkeypatch get_city_coords to be called once
    calls = {"count": 0}
    def fake_get_city_coords(city):
        calls['count'] += 1
        if calls['count'] == 1:
            return (17.3606, 78.4747)
        raise RuntimeError("should not be called second time")

    monkeypatch.setattr(mod, 'get_city_coords', fake_get_city_coords)

    # Provide deterministic AQI fetch
    def fake_fetch_current_aqi_data(lat, lon, city_name=None):
        return {"components": {"pm2_5": 10, "pm10": 20, "no2": 15}, "main": {"aqi": 25}, "source": "test"}
    monkeypatch.setattr(mod, 'fetch_current_aqi_data', fake_fetch_current_aqi_data)

    # Provide history and weather
    monkeypatch.setattr(mod, 'fetch_openmeteo_history', lambda lat, lon: [{"ds": 1, "y": 5}, {"ds": 2, "y": 6}])
    monkeypatch.setattr(mod, 'fetch_openmeteo_weather', lambda lat, lon: {"humidity": 50, "wind_speed": 3})
    monkeypatch.setattr(mod, 'train_and_predict_pm25', lambda history: ([], {"MAE": 1}))

    # First call should succeed
    resp = client.get('/aqi/Hyderabad')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['city'] == 'Hyderabad'
    assert 'composition' in data

    # Second call should use cache and not call get_city_coords again
    resp2 = client.get('/aqi/Hyderabad')
    assert resp2.status_code == 200
    assert calls['count'] == 1


def test_search_cities_autocomplete(client, monkeypatch):
    backend_app.CITY_SEARCH[:] = ["Delhi", "Deli", "Delphi", "Denver", "Mumbai"]

    resp = client.get('/search-cities?q=Del&limit=3')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data == ["Delhi", "Deli", "Delphi"]
