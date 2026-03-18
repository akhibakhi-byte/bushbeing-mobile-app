"""
Rooms and Watering Logs endpoints tests
- GET /rooms
- POST /rooms
- PUT /rooms/{name}
- DELETE /rooms/{name}
- GET /watering-logs
- DELETE /watering-logs/{id}
"""
import pytest
from conftest import BASE_URL


class TestRoomsEndpoints:
    """Rooms CRUD tests"""
    
    def test_get_rooms(self, authenticated_client):
        """Test GET /rooms"""
        client, token, user = authenticated_client
        
        response = client.get(f"{BASE_URL}/rooms")
        assert response.status_code == 200, f"Get rooms failed: {response.text}"
        
        data = response.json()
        assert "rooms" in data
        assert isinstance(data["rooms"], list)
        print(f"✓ GET /rooms returned {len(data['rooms'])} rooms")
    
    def test_create_room(self, authenticated_client):
        """Test POST /rooms"""
        client, token, user = authenticated_client
        
        room_name = "TEST_NewRoom"
        response = client.post(f"{BASE_URL}/rooms", json={"name": room_name})
        assert response.status_code == 200, f"Create room failed: {response.text}"
        
        data = response.json()
        assert "rooms" in data
        assert room_name in data["rooms"]
        
        # Verify with GET
        get_res = client.get(f"{BASE_URL}/rooms")
        rooms = get_res.json()["rooms"]
        assert room_name in rooms
        
        print(f"✓ Created room '{room_name}' and verified persistence")
        
        # Cleanup
        client.delete(f"{BASE_URL}/rooms/{room_name}")
    
    def test_create_duplicate_room(self, authenticated_client):
        """Test creating duplicate room"""
        client, token, user = authenticated_client
        
        room_name = "TEST_DuplicateRoom"
        
        # Create first time
        client.post(f"{BASE_URL}/rooms", json={"name": room_name})
        
        # Try to create again
        response = client.post(f"{BASE_URL}/rooms", json={"name": room_name})
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()
        
        print(f"✓ Duplicate room creation correctly rejected")
        
        # Cleanup
        client.delete(f"{BASE_URL}/rooms/{room_name}")
    
    def test_rename_room(self, authenticated_client):
        """Test PUT /rooms/{name}"""
        client, token, user = authenticated_client
        
        old_name = "TEST_OldRoomName"
        new_name = "TEST_NewRoomName"
        
        # Create room
        client.post(f"{BASE_URL}/rooms", json={"name": old_name})
        
        # Rename
        response = client.put(f"{BASE_URL}/rooms/{old_name}", json={"name": new_name})
        assert response.status_code == 200, f"Rename room failed: {response.text}"
        
        # Verify
        get_res = client.get(f"{BASE_URL}/rooms")
        rooms = get_res.json()["rooms"]
        assert new_name in rooms
        assert old_name not in rooms
        
        print(f"✓ Renamed room from '{old_name}' to '{new_name}'")
        
        # Cleanup
        client.delete(f"{BASE_URL}/rooms/{new_name}")
    
    def test_delete_room(self, authenticated_client):
        """Test DELETE /rooms/{name}"""
        client, token, user = authenticated_client
        
        room_name = "TEST_RoomToDelete"
        
        # Create room
        client.post(f"{BASE_URL}/rooms", json={"name": room_name})
        
        # Delete
        response = client.delete(f"{BASE_URL}/rooms/{room_name}")
        assert response.status_code == 200, f"Delete room failed: {response.text}"
        
        # Verify
        get_res = client.get(f"{BASE_URL}/rooms")
        rooms = get_res.json()["rooms"]
        assert room_name not in rooms
        
        print(f"✓ Deleted room '{room_name}' and verified deletion")
    
    def test_delete_nonexistent_room(self, authenticated_client):
        """Test deleting non-existent room"""
        client, token, user = authenticated_client
        
        response = client.delete(f"{BASE_URL}/rooms/NonExistentRoom12345")
        assert response.status_code == 404
        print("✓ Delete non-existent room correctly rejected")


class TestWateringLogs:
    """Watering logs tests"""
    
    def test_get_watering_logs(self, authenticated_client):
        """Test GET /watering-logs"""
        client, token, user = authenticated_client
        
        response = client.get(f"{BASE_URL}/watering-logs")
        assert response.status_code == 200, f"Get logs failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /watering-logs returned {len(data)} logs")
    
    def test_watering_log_created_on_water(self, authenticated_client):
        """Test that watering a plant creates a log"""
        client, token, user = authenticated_client
        
        # Create plant
        plant_res = client.post(f"{BASE_URL}/plants", json={
            "nickname": "TEST_LogPlant",
            "location": "Test Location"
        })
        plant_id = plant_res.json()["id"]
        
        # Get initial log count
        logs_before = len(client.get(f"{BASE_URL}/watering-logs").json())
        
        # Water plant
        water_res = client.post(f"{BASE_URL}/plants/{plant_id}/water")
        assert water_res.status_code == 200
        
        # Verify log was created
        logs_after = client.get(f"{BASE_URL}/watering-logs").json()
        assert len(logs_after) == logs_before + 1
        
        # Verify log details
        new_log = next(l for l in logs_after if l["plant_id"] == plant_id)
        assert new_log["plant_nickname"] == "TEST_LogPlant"
        assert "watered_at" in new_log
        
        print(f"✓ Watering plant created log entry")
        
        # Cleanup
        client.delete(f"{BASE_URL}/plants/{plant_id}")
    
    def test_delete_watering_log(self, authenticated_client):
        """Test DELETE /watering-logs/{id}"""
        client, token, user = authenticated_client
        
        # Create plant and water it
        plant_res = client.post(f"{BASE_URL}/plants", json={
            "nickname": "TEST_LogDeletePlant",
            "location": "Test"
        })
        plant_id = plant_res.json()["id"]
        
        water_res = client.post(f"{BASE_URL}/plants/{plant_id}/water")
        log_id = water_res.json()["watering_log"]["id"]
        
        # Delete log
        delete_res = client.delete(f"{BASE_URL}/watering-logs/{log_id}")
        assert delete_res.status_code == 200, f"Delete log failed: {delete_res.text}"
        
        # Verify deletion
        logs = client.get(f"{BASE_URL}/watering-logs").json()
        assert not any(l["id"] == log_id for l in logs)
        
        print(f"✓ Deleted watering log and verified deletion")
        
        # Cleanup
        client.delete(f"{BASE_URL}/plants/{plant_id}")
    
    def test_delete_nonexistent_log(self, authenticated_client):
        """Test deleting non-existent log"""
        client, token, user = authenticated_client
        
        response = client.delete(f"{BASE_URL}/watering-logs/nonexistent-log-12345")
        assert response.status_code == 404
        print("✓ Delete non-existent log correctly rejected")


class TestUnauthenticatedAccess:
    """Test that protected endpoints require auth"""
    
    def test_rooms_requires_auth(self, api_client):
        """Test GET /rooms requires auth"""
        response = api_client.get(f"{BASE_URL}/rooms")
        assert response.status_code in [401, 403]
        print("✓ Rooms endpoint requires authentication")
    
    def test_watering_logs_requires_auth(self, api_client):
        """Test GET /watering-logs requires auth"""
        response = api_client.get(f"{BASE_URL}/watering-logs")
        assert response.status_code in [401, 403]
        print("✓ Watering logs endpoint requires authentication")
