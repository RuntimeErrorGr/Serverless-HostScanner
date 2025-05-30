import pytest
from unittest.mock import patch, Mock, AsyncMock
from fastapi import status
import json
from app.models.user import User
from app.models.target import Target
from app.models.scan import Scan, ScanStatus, scan_target_association

class TestTargetRoutes:
    """Test cases for target routes."""

    def test_get_targets_empty_list(self, authenticated_client, sample_user):
        """Test getting targets when user has no targets."""
        response = authenticated_client.get("/api/targets/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert data["data"] == []

    def test_get_targets_with_data(self, authenticated_client, sample_user, sample_target, test_db):
        """Test getting targets when user has targets."""
        response = authenticated_client.get("/api/targets/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert len(data["data"]) == 1
        
        target_data = data["data"][0]
        assert target_data["id"] == sample_target.id
        assert target_data["uuid"] == sample_target.uuid
        assert target_data["name"] == sample_target.name
        assert target_data["user_id"] == sample_user.id
        assert "findings_count" in target_data
        assert "completed_scans_count" in target_data
        assert "created_at" in target_data
        assert "updated_at" in target_data

    def test_get_targets_with_findings_and_scans(
        self, authenticated_client, sample_user, sample_target, sample_finding, test_db
    ):
        """Test that target list includes correct counts for findings and scans."""
        # Create a scan and associate it with the target
        
        scan = Scan(
            name="Test Scan",
            user_id=sample_user.id,
            status=ScanStatus.COMPLETED
        )
        test_db.add(scan)
        test_db.commit()
        test_db.refresh(scan)
        
        # Associate scan with target
        test_db.execute(
            scan_target_association.insert().values(
                scan_id=scan.id,
                target_id=sample_target.id
            )
        )
        test_db.commit()
        
        response = authenticated_client.get("/api/targets/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        target_data = data["data"][0]
        assert target_data["findings_count"] == 1  # from sample_finding
        assert target_data["completed_scans_count"] == 1

    def test_get_target_by_uuid(self, authenticated_client, sample_user, sample_target):
        """Test getting a specific target by UUID."""
        response = authenticated_client.get(f"/api/targets/{sample_target.uuid}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == sample_target.id
        assert data["uuid"] == sample_target.uuid
        assert data["name"] == sample_target.name
        assert data["user_id"] == sample_user.id

    def test_get_target_not_found(self, authenticated_client, sample_user):
        """Test getting a target that doesn't exist."""
        response = authenticated_client.get("/api/targets/nonexistent-uuid")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Target not found" in response.json()["detail"]

    def test_get_target_unauthorized(self, authenticated_client, test_db, sample_user):
        """Test getting a target that belongs to another user."""
        # Create another user and target
        
        other_user = User(
            keycloak_uuid="other-user-uuid",
            username="otheruser",
            email="other@example.com"
        )
        test_db.add(other_user)
        test_db.commit()
        test_db.refresh(other_user)
        
        other_target = Target(
            name="other-target.com",
            user_id=other_user.id,
            uuid="test-uuid"
        )
        test_db.add(other_target)
        test_db.commit()
        test_db.refresh(other_target)
        
        response = authenticated_client.get(f"/api/targets/{other_target.uuid}")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not authorized" in response.json()["detail"]

    @patch('socket.gethostbyname')
    def test_get_target_flag_dns_resolution_failure(
        self, mock_gethostbyname, authenticated_client, sample_target
    ):
        """Test target flag when DNS resolution fails."""
        import socket
        mock_gethostbyname.side_effect = socket.gaierror("Name resolution failed")
        
        response = authenticated_client.get(f"/api/targets/{sample_target.uuid}/flag")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json() is None

    def test_create_target_success(self, authenticated_client, test_data, test_db, sample_user, db_refresh):
        """Test successful target creation."""
        response = authenticated_client.post(
            "/api/targets/", 
            json=test_data.VALID_TARGET_DATA
        )
        
        assert response.status_code == status.HTTP_200_OK

        db_refresh()

        data = response.json()
        assert data["name"] == test_data.VALID_TARGET_DATA["name"]
        assert "id" in data
        assert "uuid" in data
        assert "created_at" in data
        assert "updated_at" in data
        
        # Verify target was created in database
        target = test_db.query(Target).filter(Target.name == test_data.VALID_TARGET_DATA["name"]).first()
        assert target is not None

    def test_create_target_duplicate_name(
        self, authenticated_client, sample_target, test_data, sample_user
    ):
        """Test creating target with duplicate name for same user."""
        duplicate_data = {"name": sample_target.name}
        
        response = authenticated_client.post("/api/targets/", json=duplicate_data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Target with this name already exists" in response.json()["detail"]

    def test_create_target_invalid_data(self, authenticated_client):
        """Test creating target with invalid data."""
        invalid_data = {"invalid_field": "value"}
        
        response = authenticated_client.post("/api/targets/", json=invalid_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_update_target_success(self, authenticated_client, sample_target, sample_user):
        """Test successful target update."""
        update_data = {"name": "updated-target.com", "uuid": sample_target.uuid}
        
        response = authenticated_client.put(
            f"/api/targets/{sample_target.uuid}", 
            json=update_data
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["uuid"] == sample_target.uuid

    def test_update_target_not_found(self, authenticated_client, sample_user):
        """Test updating a target that doesn't exist."""
        update_data = {"name": "updated-target.com"}
        
        response = authenticated_client.put(
            "/api/targets/nonexistent-uuid", 
            json=update_data
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_target_unauthorized(self, authenticated_client, test_db, sample_user):
        """Test updating a target that belongs to another user."""
        # Create another user and target
        
        other_user = User(
            keycloak_uuid="other-user-uuid",
            username="otheruser",
            email="other@example.com"
        )
        test_db.add(other_user)
        test_db.commit()
        test_db.refresh(other_user)
        
        other_target = Target(
            name="other-target.com",
            user_id=other_user.id
        )
        test_db.add(other_target)
        test_db.commit()
        test_db.refresh(other_target)
        
        update_data = {"name": "updated-target.com"}
        response = authenticated_client.put(
            f"/api/targets/{other_target.uuid}", 
            json=update_data
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_target_duplicate_name(
        self, authenticated_client, sample_user, test_db, db_refresh
    ):
        """Test updating target to a name that already exists."""
        # Create two targets for the same user
        
        target1 = Target(name="target1.com", user_id=sample_user.id)
        target2 = Target(name="target2.com", user_id=sample_user.id)
        test_db.add_all([target1, target2])
        test_db.commit()
        test_db.refresh(target1)
        test_db.refresh(target2)
        
        # Try to update target2 to have the same name as target1
        update_data = {"name": "target1.com"}
        response = authenticated_client.put(
            f"/api/targets/{target2.uuid}", 
            json=update_data
        )
        db_refresh()
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Target with this name already exists" in response.json()["detail"]

    def test_delete_target_success(self, authenticated_client, sample_target, test_db, db_refresh):
        """Test successful target deletion."""
        target_uuid = sample_target.uuid
        
        response = authenticated_client.delete(f"/api/targets/{target_uuid}")
        
        assert response.status_code == status.HTTP_200_OK
        assert "Target deleted successfully" in response.json()["message"]
        db_refresh()
        # Verify target was deleted from database
        
        target = test_db.query(Target).filter(Target.uuid == target_uuid).first()
        assert target is None

    def test_delete_target_not_found(self, authenticated_client, sample_user):
        """Test deleting a target that doesn't exist."""
        response = authenticated_client.delete("/api/targets/nonexistent-uuid")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_target_unauthorized(self, authenticated_client, test_db, sample_user):
        """Test deleting a target that belongs to another user."""
        # Create another user and target
        
        other_user = User(
            keycloak_uuid="other-user-uuid",
            username="otheruser",
            email="other@example.com"
        )
        test_db.add(other_user)
        test_db.commit()
        test_db.refresh(other_user)
        
        other_target = Target(
            name="other-target.com",
            user_id=other_user.id
        )
        test_db.add(other_target)
        test_db.commit()
        test_db.refresh(other_target)
        
        response = authenticated_client.delete(f"/api/targets/{other_target.uuid}")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_bulk_delete_targets_success(
        self, authenticated_client, sample_user, test_db, db_refresh, sample_target
    ):
        """Test successful bulk deletion of targets."""
        # Create multiple targets
        
        targets = [
            Target(name="target1.com", user_id=sample_user.id, uuid="test-uuid-1"),
            Target(name="target2.com", user_id=sample_user.id, uuid="test-uuid-2"),
            Target(name="target3.com", user_id=sample_user.id, uuid="test-uuid-3")
        ]
        test_db.add_all(targets)
        test_db.commit()
        for target in targets:
            test_db.refresh(target)
        
        target_uuids = ["test-uuid-1", "test-uuid-2", "test-uuid-3"]
        
        response = authenticated_client.post(
            "/api/targets/bulk-delete", 
            json=target_uuids
        )
        db_refresh()
        assert response.status_code == status.HTTP_200_OK
        assert "Targets and associated findings deleted successfully" in response.json()["message"]
        
        # Verify targets were deleted
        remaining_targets = test_db.query(Target).filter(Target.uuid.in_(target_uuids)).all()
        assert len(remaining_targets) == 0

    def test_bulk_delete_targets_unauthorized(
        self, authenticated_client, sample_user, test_db, db_refresh
    ):
        """Test bulk deletion fails when user doesn't own all targets."""
        # Create targets for different users
        
        other_user = User(
            keycloak_uuid="other-user-uuid",
            username="otheruser",
            email="other@example.com"
        )
        test_db.add(other_user)
        test_db.commit()
        test_db.refresh(other_user)
        
        user_target = Target(name="user-target.com", user_id=sample_user.id, uuid="test-uuid-1")
        other_target = Target(name="other-target.com", user_id=other_user.id, uuid="test-uuid-2")
        test_db.add_all([user_target, other_target])
        test_db.commit()
        test_db.refresh(user_target)
        test_db.refresh(other_target)
        
        target_uuids = ["test-uuid-1", "test-uuid-2"]
        
        response = authenticated_client.post(
            "/api/targets/bulk-delete", 
            json=target_uuids
        )
        db_refresh()
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not authorized to delete target" in response.json()["detail"]

    def test_bulk_delete_targets_empty_list(self, authenticated_client, sample_user):
        """Test bulk deletion with empty list."""
        response = authenticated_client.post("/api/targets/bulk-delete", json=[])
        
        assert response.status_code == status.HTTP_200_OK

    def test_targets_require_authentication(self, client):
        """Test that all target endpoints require authentication."""
        endpoints = [
            ("GET", "/api/targets/"),
            ("GET", "/api/targets/some-uuid"),
            ("GET", "/api/targets/some-uuid/flag"),
            ("POST", "/api/targets/"),
            ("PUT", "/api/targets/some-uuid"),
            ("DELETE", "/api/targets/some-uuid"),
            ("POST", "/api/targets/bulk-delete"),
        ]
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = client.get(endpoint)
            elif method == "POST":
                response = client.post(endpoint, json={})
            elif method == "PUT":
                response = client.put(endpoint, json={})
            elif method == "DELETE":
                response = client.delete(endpoint)
            
            assert response.status_code in [401, 403, 422]  # Authentication required 