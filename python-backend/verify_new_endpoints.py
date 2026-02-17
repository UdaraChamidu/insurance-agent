import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_endpoint(name, url):
    try:
        print(f"Testing {name} ({url})...")
        response = requests.get(url)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("Response Sample:", str(response.json())[:100] + "...")
        else:
            print("Error:", response.text)
    except Exception as e:
        print(f"Failed to connect: {e}")

if __name__ == "__main__":
    test_endpoint("Bookings", f"{BASE_URL}/bookings/appointments")
    test_endpoint("Documents Stats", f"{BASE_URL}/documents/stats")
