import requests
import json
import time

url = "http://localhost:8003/api/leads/intake"

payload = {
    "productType": "aca",
    "state": "FL",
    # "triggers": ["turning_65"], # Triggers are commented out in leads.py anyway
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
    print("Sending request to 8003...")
    response = requests.post(url, json=payload, timeout=10)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
