"""
Plants CRUD endpoints tests
- GET /plants
- POST /plants
- PUT /plants/{id}
- DELETE /plants/{id}
- POST /plants/{id}/water
"""
import pytest
from conftest import BASE_URL


class TestPlantsGet:
    """GET /plants tests"""
    
    def test_get_plants_authenticated(self, authenticated_client):
        """Test GET /plants with auth token"""
        client, token, user = authenticated_client
        
        response = client.get(f"{BASE_URL}/plants")
        assert response.status_code == 200, f"Get plants failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /plants returned {len(data)} plants")
    
    def test_get_plants_unauthenticated(self, api_client):
        """Test GET /plants without token"""
        response = api_client.get(f"{BASE_URL}/plants")
        assert response.status_code in [401, 403]
        print("✓ GET /plants without token correctly rejected")


class TestPlantsCreate:
    """POST /plants tests"""
    
    def test_create_plant_minimal(self, authenticated_client):
        """Test POST /plants with minimal data"""
        client, token, user = authenticated_client
        
        plant_data = {
            "nickname": "TEST_PlantMinimal",
            "location": "Kitchen"
        }
        
        response = client.post(f"{BASE_URL}/plants", json=plant_data)
        assert response.status_code == 200, f"Create plant failed: {response.text}"
        
        data = response.json()
        assert data["nickname"] == plant_data["nickname"]
        assert data["location"] == plant_data["location"]
        assert "id" in data
        assert "user_id" in data
        assert data["user_id"] == user["id"]
        
        # Verify persistence with GET
        plant_id = data["id"]
        get_response = client.get(f"{BASE_URL}/plants")
        assert get_response.status_code == 200
        plants = get_response.json()
        assert any(p["id"] == plant_id for p in plants)
        
        print(f"✓ Created plant with ID {plant_id} and verified persistence")
        
        # Cleanup
        client.delete(f"{BASE_URL}/plants/{plant_id}")
    
    def test_create_plant_full_data(self, authenticated_client):
        """Test POST /plants with full data"""
        client, token, user = authenticated_client
        
        plant_data = {
            "nickname": "TEST_PlantFull",
            "location": "Living Room",
            "scientific_name": "Monstera deliciosa",
            "common_name": "Swiss Cheese Plant",
            "family": "Araceae",
            "confidence": 0.95,
            "images": ["data:image/jpeg;base64,test123"],
            "care_info": {
                "watering": "Water when top inch is dry",
                "sunlight": "Bright indirect light"
            }
        }
        
        response = client.post(f"{BASE_URL}/plants", json=plant_data)
        assert response.status_code == 200, f"Create plant failed: {response.text}"
        
        data = response.json()
        assert data["nickname"] == plant_data["nickname"]
        assert data["scientific_name"] == plant_data["scientific_name"]
        assert data["confidence"] == plant_data["confidence"]
        assert len(data["images"]) == 1
        
        print(f"✓ Created plant with full data")
        
        # Cleanup
        client.delete(f"{BASE_URL}/plants/{data['id']}")


class TestPlantsUpdate:
    """PUT /plants/{id} tests"""
    
    def test_update_plant_nickname(self, authenticated_client):
        """Test updating plant nickname"""
        client, token, user = authenticated_client
        
        # Create plant
        create_res = client.post(f"{BASE_URL}/plants", json={
            "nickname": "TEST_OldName",
            "location": "Bedroom"
        })
        plant_id = create_res.json()["id"]
        
        # Update
        update_res = client.put(f"{BASE_URL}/plants/{plant_id}", json={
            "nickname": "TEST_NewName"
        })
        assert update_res.status_code == 200, f"Update failed: {update_res.text}"
        
        data = update_res.json()
        assert data["nickname"] == "TEST_NewName"
        assert data["location"] == "Bedroom"  # Should remain unchanged
        
        print(f"✓ Updated plant nickname")
        
        # Cleanup
        client.delete(f"{BASE_URL}/plants/{plant_id}")
    
    def test_update_nonexistent_plant(self, authenticated_client):
        """Test updating non-existent plant"""
        client, token, user = authenticated_client
        
        response = client.put(f"{BASE_URL}/plants/nonexistent-id-12345", json={
            "nickname": "New Name"
        })
        assert response.status_code == 404
        print("✓ Update non-existent plant correctly rejected")


class TestPlantsDelete:
    """DELETE /plants/{id} tests"""
    
    def test_delete_plant(self, authenticated_client):
        """Test deleting a plant"""
        client, token, user = authenticated_client
        
        # Create plant
        create_res = client.post(f"{BASE_URL}/plants", json={
            "nickname": "TEST_ToDelete",
            "location": "Balcony"
        })
        plant_id = create_res.json()["id"]
        
        # Delete
        delete_res = client.delete(f"{BASE_URL}/plants/{plant_id}")
        assert delete_res.status_code == 200, f"Delete failed: {delete_res.text}"
        
        # Verify deletion with GET
        get_res = client.get(f"{BASE_URL}/plants")
        plants = get_res.json()
        assert not any(p["id"] == plant_id for p in plants)
        
        print(f"✓ Deleted plant and verified deletion")
    
    def test_delete_nonexistent_plant(self, authenticated_client):
        """Test deleting non-existent plant"""
        client, token, user = authenticated_client
        
        response = client.delete(f"{BASE_URL}/plants/nonexistent-id-12345")
        assert response.status_code == 404
        print("✓ Delete non-existent plant correctly rejected")


class TestWaterPlant:
    """POST /plants/{id}/water tests"""
    
    def test_water_plant(self, authenticated_client):
        """Test watering a plant"""
        client, token, user = authenticated_client
        
        # Create plant
        create_res = client.post(f"{BASE_URL}/plants", json={
            "nickname": "TEST_ToWater",
            "location": "Kitchen"
        })
        plant_id = create_res.json()["id"]
        
        # Water
        water_res = client.post(f"{BASE_URL}/plants/{plant_id}/water")
        assert water_res.status_code == 200, f"Water failed: {water_res.text}"
        
        data = water_res.json()
        assert "message" in data
        assert "watering_log" in data
        assert data["watering_log"]["plant_id"] == plant_id
        
        # Verify watering log was created
        logs_res = client.get(f"{BASE_URL}/watering-logs")
        logs = logs_res.json()
        assert any(l["plant_id"] == plant_id for l in logs)
        
        print(f"✓ Watered plant and created log")
        
        # Cleanup
        client.delete(f"{BASE_URL}/plants/{plant_id}")
    
    def test_water_nonexistent_plant(self, authenticated_client):
        """Test watering non-existent plant"""
        client, token, user = authenticated_client
        
        response = client.post(f"{BASE_URL}/plants/nonexistent-id-12345/water")
        assert response.status_code == 404
        print("✓ Water non-existent plant correctly rejected")
