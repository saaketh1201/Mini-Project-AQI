from app import app

with app.test_client() as client:
    resp = client.get('/aqi/Hyderabad?compact=true')
    print('status', resp.status_code)
    print(resp.get_data(as_text=True))
