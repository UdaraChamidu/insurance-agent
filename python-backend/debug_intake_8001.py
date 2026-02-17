import requests
import json

url = "http://localhost:8001/api/leads/intake"

payload = {
    "productType": "aca",
    "state": "FL",
    "triggers": ["turning_65"],
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "phone": "555-123-4567",
    "contactInfo": {
        "firstName": "Test",
        "lastName": "User",
        "email": "test@example.com",
        "phone": "555-123-4567"
    }
}

try:
    response = requests.post(url, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
