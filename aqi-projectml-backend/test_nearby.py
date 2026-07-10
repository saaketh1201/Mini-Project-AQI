import sys
sys.stdout.reconfigure(encoding='utf-8')

from app import app
import json

with app.test_client() as client:
    resp = client.get('/nearby?lat=17.3850&lon=78.4867&radius=50')
    result = resp.get_json()
    
    print("Status:", resp.status_code)
    print("Number of localities:", len(result.get('localities', [])))
    print("\n" + "="*80)
    print("NEARBY LOCALITIES WITH LOCATION-AWARE ANALYTICS")
    print("="*80)
    
    for i, loc in enumerate(result.get('localities', [])[:5]):  # Show first 5
        print(f"\n{i+1}. {loc['name']} ({loc['distance_km']} km away)")
        print(f"   AQI: {loc['aqi']} ({loc['category']})")
        print(f"   Dominant: {loc['dominant']}")
        print(f"   Trend: {loc['trend']}")
        
        analytics = loc.get('analytics', {})
        if analytics.get('risk'):
            print(f"   ERS Score: {analytics['risk'].get('score')} ({analytics['risk'].get('level')})")
        
        if analytics.get('narrative'):
            narrative = analytics['narrative']
            if narrative.get('diagnostic'):
                print(f"   Diagnostic: {narrative['diagnostic'][:100]}...")
        
        if analytics.get('summary'):
            print(f"   AI Summary: {analytics['summary'][:100]}...")

