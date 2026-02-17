import requests
import json
import uuid

BASE_URL = "http://localhost:8000/api/leads/intake"

def test_lead_intake():
    payload = {
        "productType": "Health Insurance",
        "state": "FL",
        "firstName": "Test",
        "lastName": "User",
        "email": f"test.{uuid.uuid4()}@example.com",
        "phone": "+15550000000",
        "utmSource": "test-script",
        "utmMedium": "console",
        "utmCampaign": "debug-500"
    }
    
    try:
        print("Sending Lead Intake Request...")
        response = requests.post(BASE_URL, json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
    except Exception as e:
        print(f"Request Failed: {e}")

if __name__ == "__main__":
    test_lead_intake()
