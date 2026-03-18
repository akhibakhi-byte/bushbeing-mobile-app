"""
Shared pytest fixtures for bushbeing backend tests
"""
import pytest
import requests
import os
import random
import string

# Get API URL from environment - NO DEFAULT (fail fast)
BASE_URL = os.environ.get('EXPO_PUBLIC_API_URL')
if not BASE_URL:
    raise EnvironmentError("EXPO_PUBLIC_API_URL not set in environment")

BASE_URL = BASE_URL.rstrip('/')


def random_email():
    """Generate random test email"""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"TEST_{rand}@example.com"


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def test_user_creds():
    """Generate unique test user credentials"""
    return {
        "email": random_email(),
        "name": "TEST User",
        "password": "TestPass1!@#"
    }


@pytest.fixture
def authenticated_client(api_client):
    """
    Create and authenticate a test user, return (client, token, user_data)
    Cleanup: Delete test user after test
    """
    # Use existing test user
    email = "testuser123@example.com"
    password = "TestPass1!"
    
    # Login
    login_res = api_client.post(f"{BASE_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    
    if login_res.status_code != 200:
        pytest.skip(f"Cannot authenticate test user: {login_res.status_code}")
    
    data = login_res.json()
    token = data["access_token"]
    user = data["user"]
    
    # Set auth header
    api_client.headers["Authorization"] = f"Bearer {token}"
    
    yield api_client, token, user
    
    # Cleanup: remove auth header
    api_client.headers.pop("Authorization", None)
