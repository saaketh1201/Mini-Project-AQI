import pytest
import requests
import app as backend_app


@pytest.fixture
def client():
    backend_app.app.testing = True
    with backend_app.app.test_client() as c:
        yield c


def test_aqi_heatmap_cached(client, monkeypatch):
    backend_app.BACKGROUND_CACHE.clear()
    backend_app.HEATMAP_CITIES = ['Delhi', 'Mumbai']

    def fake_get_city_coords(city):
        coords = {'delhi': (28.6139, 77.2090), 'mumbai': (19.0760, 72.8777)}
        return coords.get(city.lower(), (0.0, 0.0))

    def fake_fetch_current_aqi_data(lat, lon, city_name=None):
        return {
            'components': {'pm2_5': 30, 'pm10': 50, 'no2': 20, 'so2': 10, 'o3': 25, 'co': 500},
            'main': {'aqi': 82},
            'source': 'Open-Meteo Air Quality API',
        }

    monkeypatch.setattr(backend_app, 'get_city_coords', fake_get_city_coords)
    monkeypatch.setattr(backend_app, 'fetch_current_aqi_data', fake_fetch_current_aqi_data)

    resp = client.get('/aqi-heatmap')
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert any(item.get('aqi') == 82 for item in data)
    assert any(item.get('name') == 'Delhi' for item in data)


def test_report_compare_endpoint(client, monkeypatch):
    # Monkeypatch geocoding and data fetchers
    monkeypatch.setattr(backend_app, 'get_city_coords', lambda c: (10.0, 20.0))
    monkeypatch.setattr(backend_app, 'fetch_current_aqi_data', lambda lat, lon, city_name=None: { 'components': {'pm2_5': 30}, 'main': {'aqi': 75}, 'source': 'mock' })
    monkeypatch.setattr(backend_app, 'fetch_openmeteo_history', lambda lat, lon: [{'ds':1,'y':10},{'ds':2,'y':12}])
    monkeypatch.setattr(backend_app, 'train_and_predict_pm25', lambda hist: ([], {'MAE':1}))

    resp = client.get('/report/compare?city1=CityOne&city2=CityTwo')
    assert resp.status_code == 200
    assert resp.mimetype == 'application/pdf'
    assert resp.data.startswith(b'%PDF-')


def test_fetch_iqair_city_data_short_circuits_on_429(monkeypatch):
    calls = []

    class FakeResponse:
        status_code = 429

    def fake_get(url, timeout):
        calls.append(url)
        return FakeResponse()

    monkeypatch.setattr(backend_app.requests, 'get', fake_get)

    with pytest.raises(requests.exceptions.RequestException):
        backend_app.fetch_iqair_city_data(17.385, 78.4867)

    assert len(calls) <= 2
# end of tests