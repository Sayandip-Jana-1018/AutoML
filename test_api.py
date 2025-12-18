import requests
import json

# ⚠️ SECURITY: This key is already exposed - regenerate it!
API_KEY = "mlf_SZDtib7fF-pQPrfYBusnge6MGtgwGUPv"

BASE_URL = "http://localhost:3000"

print("🔍 Testing MLForge API...")
print("-" * 50)

# Test 1: Try AutoML endpoint (exists but needs project)
print("\n📝 Test 1: AutoML Endpoint (should require projectId)")
try:
    response = requests.post(
        f"{BASE_URL}/api/studio/automl",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        },
        json={"projectId": "test"}  # Dummy project ID
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:200]}...")  # First 200 chars
    
    if response.status_code == 200:
        print("✅ API endpoint works!")
    elif response.status_code == 400:
        print("⚠️ API works but needs valid projectId")
    elif response.status_code == 401:
        print("❌ API Key authentication failed")
    else:
        print(f"❓ Unexpected response: {response.status_code}")
        
except Exception as e:
    print(f"❌ Error: {e}")

# Test 2: Check if API key middleware is even implemented
print("\n📝 Test 2: Checking API Key Support...")
print("💡 Note: MLForge may not have API key auth implemented yet!")
print("   Check if 'Authorization' header is validated in routes")

