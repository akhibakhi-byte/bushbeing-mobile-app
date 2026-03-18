"""
Auth endpoints tests
- POST /auth/request-otp
- POST /auth/verify-otp
- POST /auth/login
- GET /auth/me
- POST /auth/forgot-password
- POST /auth/resend-otp
"""
import pytest
from conftest import BASE_URL, random_email


class TestAuthLogin:
    """Login flow tests"""
    
    def test_login_success_with_existing_user(self, api_client):
        """Test login with existing test user"""
        response = api_client.post(f"{BASE_URL}/auth/login", json={
            "email": "testuser123@example.com",
            "password": "TestPass1!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "testuser123@example.com"
        print(f"✓ Login successful for testuser123@example.com")
    
    def test_login_invalid_password(self, api_client):
        """Test login with wrong password"""
        response = api_client.post(f"{BASE_URL}/auth/login", json={
            "email": "testuser123@example.com",
            "password": "WrongPassword123!"
        })
        assert response.status_code == 401
        print("✓ Login with invalid password correctly rejected")
    
    def test_login_nonexistent_user(self, api_client):
        """Test login with non-existent email"""
        response = api_client.post(f"{BASE_URL}/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "TestPass1!"
        })
        assert response.status_code == 401
        print("✓ Login with non-existent user correctly rejected")


class TestAuthMe:
    """GET /auth/me tests"""
    
    def test_auth_me_with_valid_token(self, authenticated_client):
        """Test /auth/me with valid token"""
        client, token, user = authenticated_client
        
        response = client.get(f"{BASE_URL}/auth/me")
        assert response.status_code == 200, f"Auth /me failed: {response.text}"
        
        data = response.json()
        assert data["id"] == user["id"]
        assert data["email"] == user["email"]
        assert "name" in data
        print(f"✓ Auth /me returned user profile")
    
    def test_auth_me_without_token(self, api_client):
        """Test /auth/me without token"""
        response = api_client.get(f"{BASE_URL}/auth/me")
        assert response.status_code in [401, 403]
        print("✓ Auth /me without token correctly rejected")
    
    def test_auth_me_invalid_token(self, api_client):
        """Test /auth/me with invalid token"""
        api_client.headers["Authorization"] = "Bearer invalid_token_12345"
        response = api_client.get(f"{BASE_URL}/auth/me")
        assert response.status_code == 401
        print("✓ Auth /me with invalid token correctly rejected")


class TestAuthRegistration:
    """Registration flow tests (OTP-based)"""
    
    def test_request_otp_new_user(self, api_client, test_user_creds):
        """Test POST /auth/request-otp for new user"""
        response = api_client.post(f"{BASE_URL}/auth/request-otp", json={
            "email": test_user_creds["email"],
            "name": test_user_creds["name"],
            "password": test_user_creds["password"]
        })
        assert response.status_code == 200, f"OTP request failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        print(f"✓ OTP request successful for {test_user_creds['email']}")
    
    def test_request_otp_existing_user(self, api_client):
        """Test OTP request for already registered email"""
        response = api_client.post(f"{BASE_URL}/auth/request-otp", json={
            "email": "testuser123@example.com",
            "name": "Test User",
            "password": "TestPass1!"
        })
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()
        print("✓ OTP request for existing user correctly rejected")
    
    def test_request_otp_weak_password(self, api_client):
        """Test OTP request with weak password"""
        response = api_client.post(f"{BASE_URL}/auth/request-otp", json={
            "email": random_email(),
            "name": "Test User",
            "password": "weak"
        })
        assert response.status_code == 400
        assert "password" in response.json()["detail"].lower()
        print("✓ Weak password correctly rejected")


class TestForgotPassword:
    """Forgot password flow tests"""
    
    def test_forgot_password_existing_user(self, api_client):
        """Test forgot password for existing user"""
        response = api_client.post(f"{BASE_URL}/auth/forgot-password", json={
            "email": "testuser123@example.com"
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✓ Forgot password request successful")
    
    def test_forgot_password_nonexistent_user(self, api_client):
        """Test forgot password for non-existent user (should still return 200)"""
        response = api_client.post(f"{BASE_URL}/auth/forgot-password", json={
            "email": "nonexistent_user_12345@example.com"
        })
        # Should return 200 to avoid email enumeration
        assert response.status_code == 200
        print("✓ Forgot password for non-existent user handled correctly")
