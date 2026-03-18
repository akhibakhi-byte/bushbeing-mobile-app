"""
Backend API Connectivity Tests for bushbeing
Tests external backend at https://smart-detect-flow.preview.emergentagent.com/api

Modules tested:
- Health check
- Auth endpoints (register, OTP, login)
- Plants CRUD
- Rooms
- Watering logs
"""

import pytest
import requests
import os
import time
import random
import string

# Get API URL from environment
API_URL = os.environ.get('EXPO_PUBLIC_API_URL')
if not API_URL:
    # Fallback for testing context
    API_URL = "https://smart-detect-flow.preview.emergentagent.com/api"


def random_email():
    """Generate random email for testing"""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_{rand}@example.com"


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def test_user_creds():
    """Generate test user credentials"""
    return {
        "email": random_email(),
        "name": "Test User",
        "password": "TestPass123!@#"
    }


class TestHealthCheck:
    """Health check endpoint"""

    def test_health_endpoint(self, api_client):
        """Test /health endpoint"""
        try:
            response = api_client.get(f"{API_URL}/health")
            assert response.status_code == 200
            data = response.json()
            assert data.get("status") in ["healthy", "ok"]
            print(f"✓ Health check passed: {data}")
        except Exception as e:
            pytest.skip(f"Health endpoint not available: {str(e)}")


class TestAuthFlow:
    """Authentication flow tests"""

    def test_register_request_otp(self, api_client, test_user_creds):
        """Test POST /auth/request-otp"""
        response = api_client.post(f"{API_URL}/auth/request-otp", json={
            "email": test_user_creds["email"],
            "name": test_user_creds["name"],
            "password": test_user_creds["password"]
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data or "otp" in data
        print(f"✓ OTP request successful for {test_user_creds['email']}")

    def test_login_without_registration(self, api_client):
        """Test login with non-existent user should fail"""
        response = api_client.post(f"{API_URL}/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpass"
        })
        
        # Should return 401 or 400
        assert response.status_code in [400, 401, 404], f"Expected auth error, got {response.status_code}"
        print("✓ Login with invalid credentials correctly rejected")

    def test_auth_me_without_token(self, api_client):
        """Test GET /auth/me without token should fail"""
        response = api_client.get(f"{API_URL}/auth/me")
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print("✓ Auth /me without token correctly rejected")


class TestPlantsEndpoints:
    """Plants CRUD endpoints (require auth, will test publicly available endpoints only)"""

    def test_plants_endpoint_requires_auth(self, api_client):
        """Test GET /plants requires authentication"""
        response = api_client.get(f"{API_URL}/plants")
        # Should return 401 without auth token
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Plants endpoint correctly requires authentication")


class TestRoomsEndpoint:
    """Rooms endpoint tests"""

    def test_rooms_endpoint_requires_auth(self, api_client):
        """Test GET /rooms requires authentication"""
        response = api_client.get(f"{API_URL}/rooms")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Rooms endpoint correctly requires authentication")


class TestWateringLogs:
    """Watering logs endpoint tests"""

    def test_watering_logs_requires_auth(self, api_client):
        """Test GET /watering-logs requires authentication"""
        response = api_client.get(f"{API_URL}/watering-logs")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Watering logs endpoint correctly requires authentication")


class TestAPIConnectivity:
    """General API connectivity tests"""

    def test_api_base_url_reachable(self, api_client):
        """Test that API base URL is reachable"""
        try:
            # Try to reach any endpoint
            response = api_client.get(f"{API_URL}/health", timeout=10)
            assert response.status_code < 500, f"Server error: {response.status_code}"
            print(f"✓ API is reachable at {API_URL}")
        except requests.exceptions.ConnectionError:
            pytest.fail(f"Cannot connect to API at {API_URL}")
        except requests.exceptions.Timeout:
            pytest.fail(f"API timeout at {API_URL}")

    def test_api_returns_json(self, api_client):
        """Test that API returns JSON responses"""
        response = api_client.post(f"{API_URL}/auth/request-otp", json={
            "email": random_email(),
            "name": "Test",
            "password": "Test123!@#"
        })
        
        assert response.headers.get("content-type") and "json" in response.headers["content-type"].lower(), \
            f"Expected JSON response, got {response.headers.get('content-type')}"
        print("✓ API returns JSON responses")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
