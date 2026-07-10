import pytest
import app as backend_app


@pytest.fixture
def client():
    backend_app.app.testing = True
    with backend_app.app.test_client() as c:
        yield c


def test_aqi_heatmap_cached(client):
    # Populate background cache with a few cities
    backend_app.BACKGROUND_CACHE.clear()
    # Use a city from HEATMAP_CITIES list (normalized keys expected)
    backend_app.BACKGROUND_CACHE['delhi'] = {'aqi': 120, 'lat': 28.6, 'lon': 77.2}
    backend_app.BACKGROUND_CACHE['mumbai'] = {'aqi': 80, 'lat': 19.0, 'lon': 72.8}

    resp = client.get('/aqi-heatmap')
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert any(item.get('aqi') == 120 for item in data)


def test_report_compare_endpoint(client, monkeypatch):
    # Monkeypatch geocoding and data fetchers
    monkeypatch.setattr(backend_app, 'get_city_coords', lambda c: (10.0, 20.0))
    monkeypatch.setattr(backend_app, 'fetch_current_aqi_data', lambda lat, lon, city_name=None: { 'components': {'pm2_5': 30}, 'main': {'aqi': 75}, 'source': 'mock' })
    monkeypatch.setattr(backend_app, 'fetch_openmeteo_history', lambda lat, lon: [{'ds':1,'y':10},{'ds':2,'y':12}])
    monkeypatch.setattr(backend_app, 'train_and_predict_pm25', lambda hist: ([], {'MAE':1}))

    resp = client.get('/report/compare?city1=CityOne&city2=CityTwo')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'city1' in data and 'city2' in data
    assert data['city1']['aqi'] == 75
# end of tests