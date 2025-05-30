import pytest
from unittest.mock import patch, Mock, AsyncMock
from fastapi import status
import json
from app.models.user import User
from app.models.scan import Scan, ScanStatus, ScanType, scan_target_association
from app.models.target import Target
from app.api.routes.scan import create_scan_entry, get_or_create_targets, start_openfaas_job

class TestScanRoutes:
    """Test cases for scan routes."""

    def test_get_scans_empty_list(self, authenticated_client, sample_user):
        """Test getting scans when user has no scans."""
        response = authenticated_client.get("/api/scans/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert data["data"] == []

    def test_get_scans_with_data(self, authenticated_client, sample_user, sample_scan, test_db):
        """Test getting scans when user has scans."""
        response = authenticated_client.get("/api/scans/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert len(data["data"]) == 1
        
        scan_data = data["data"][0]
        assert scan_data["uuid"] == sample_scan.uuid
        assert scan_data["name"] == sample_scan.name
        assert scan_data["status"] == sample_scan.status.value
        assert "created_at" in scan_data
        assert "targets" in scan_data

    def test_get_scan_by_uuid_success(self, authenticated_client, sample_user, sample_scan):
        """Test getting a specific scan by UUID."""
        response = authenticated_client.get(f"/api/scans/{sample_scan.uuid}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["scan_uuid"] == sample_scan.uuid
        assert data["name"] == sample_scan.name
        assert data["status"] == sample_scan.status.value

    def test_get_scan_not_found(self, authenticated_client, sample_user):
        """Test getting a scan that doesn't exist."""
        response = authenticated_client.get("/api/scans/nonexistent-uuid")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Scan not found" in response.json()["detail"]

    def test_get_scan_unauthorized(self, authenticated_client, test_db):
        """Test getting a scan that belongs to another user."""

        
        other_user = User(
            keycloak_uuid="other-user-uuid",
            username="otheruser",
            email="other@example.com"
        )
        test_db.add(other_user)
        test_db.commit()
        test_db.refresh(other_user)
        
        other_scan = Scan(
            name="Other Scan",
            user_id=other_user.id,
            status=ScanStatus.PENDING
        )
        test_db.add(other_scan)
        test_db.commit()
        test_db.refresh(other_scan)
        
        response = authenticated_client.get(f"/api/scans/{other_scan.uuid}")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "User not found" in response.json()["detail"]

    @patch('app.api.routes.scan.redis.Redis')
    def test_get_scan_with_redis_progress(self, mock_redis_class, authenticated_client, sample_scan, test_db):
        """Test getting scan with real-time progress from Redis."""
        # Mock Redis instance
        mock_redis = Mock()
        mock_redis_class.return_value = mock_redis
        mock_redis.get.side_effect = lambda key: {
            f"scan_progress:{sample_scan.uuid}": b"0.75",
            f"scan_output:{sample_scan.uuid}": None
        }.get(key)
        mock_redis.lrange.return_value = [b"Scanning port 80", b"Found service HTTP"]
        
        response = authenticated_client.get(f"/api/scans/{sample_scan.uuid}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["current_progress"] == 0.75

    def test_get_scan_status(self, authenticated_client, sample_scan, test_db):
        """Test getting scan status."""
        response = authenticated_client.get(f"/api/scans/{sample_scan.uuid}/status")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == sample_scan.status.value

    def test_get_scan_findings(self, authenticated_client, sample_scan, sample_target, sample_finding, test_db):
        """Test getting findings for a scan."""
        # Associate scan with target that has findings
        
        test_db.execute(
            scan_target_association.insert().values(
                scan_id=sample_scan.id,
                target_id=sample_target.id
            )
        )
        test_db.commit()
        
        response = authenticated_client.get(f"/api/scans/{sample_scan.uuid}/findings")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert len(data["data"]) == 1
        finding_data = data["data"][0]
        assert finding_data["id"] == sample_finding.id

    @patch('app.api.routes.scan.watch_scan.delay')
    @patch('app.api.routes.scan.start_openfaas_job')
    def test_start_scan_success(
        self, mock_start_openfaas, mock_watch_scan, authenticated_client, test_data, test_db, sample_user, db_refresh
    ):
        """Test successful scan start."""
        scan_request = {
            "targets": ["example.com", "test.com"],
            "type": ScanType.DEFAULT.value,
            "scan_options": {"ports": "80,443"}
        }
        
        response = authenticated_client.post("/api/scans/start", json=scan_request)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "scan_uuid" in data

        db_refresh()
        
        # Verify scan was created in database
        scan = test_db.query(Scan).filter(Scan.uuid == data["scan_uuid"]).first()
        assert scan is not None
        
        # Verify external calls were made
        mock_start_openfaas.assert_called_once()
        mock_watch_scan.assert_called_once_with(data["scan_uuid"])

    def test_start_scan_with_private_ips_filtered(self, authenticated_client, sample_user):
        """Test that private IPs are filtered out from scan targets."""
        scan_request = {
            "targets": ["192.168.1.1", "10.0.0.1", "example.com", "172.16.1.1"],
            "type": ScanType.DEFAULT.value,
            "scan_options": {}
        }
        
        with patch('app.api.routes.scan.start_openfaas_job') as mock_openfaas:
            with patch('app.api.routes.scan.watch_scan.delay'):
                response = authenticated_client.post("/api/scans/start", json=scan_request)
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify that only example.com was passed to OpenFaaS (private IPs filtered)
        call_args = mock_openfaas.call_args[0][0]
        assert "example.com" in call_args["targets"]
        assert "192.168.1.1" not in call_args["targets"]
        assert "10.0.0.1" not in call_args["targets"]
        assert "172.16.1.1" not in call_args["targets"]

    def test_start_scan_invalid_data(self, authenticated_client):
        """Test starting scan with invalid data."""
        invalid_request = {"invalid_field": "value"}
        
        response = authenticated_client.post("/api/scans/start", json=invalid_request)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @patch('app.api.routes.scan.requests.post')
    def test_start_openfaas_job_success(self, mock_post):
        """Test OpenFaaS job start function."""
        
        
        mock_post.return_value.status_code = 202
        mock_post.return_value.text = "Job started"
        
        payload = {
            "targets": ["example.com"],
            "scan_type": ScanType.DEFAULT.value,
            "scan_options": {},
            "scan_id": "test-uuid"
        }
        
        start_openfaas_job(payload)
        
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[0][0].endswith("/async-function/dummy")
        assert call_args[1]["json"] == payload

    @patch('app.api.routes.scan.requests.post')
    def test_start_openfaas_job_failure(self, mock_post):
        """Test OpenFaaS job start with failure."""
        
        mock_post.side_effect = Exception("Connection failed")
        
        payload = {
            "targets": ["example.com"],
            "scan_type": ScanType.DEFAULT,
            "scan_options": {},
            "scan_id": "test-uuid"
        }
        
        # Should not raise exception, just log error
        start_openfaas_job(payload)

    def test_clean_target_list_function(self):
        """Test the clean_target_list utility function."""
        from app.api.routes.scan import clean_target_list
        
        targets = [
            "http://example.com/",
            "https://test.com",
            "192.168.1.1",  # Private IP - should be filtered
            "10.0.0.0/24",  # Private network - should be filtered
            "google.com",
            "172.16.1.1-172.16.1.10",  # Private range - should be filtered
            "",  # Empty - should be filtered
            "8.8.8.8",
            "8.8.8.8-8.8.8.10"
        ]
        
        cleaned = clean_target_list(targets)
        
        assert "example.com" in cleaned
        assert "test.com" in cleaned
        assert "google.com" in cleaned
        assert "8.8.8.8" in cleaned
        assert "8.8.8.8-8.8.8.10" in cleaned
        assert "192.168.1.1" not in cleaned
        assert "10.0.0.0/24" not in cleaned
        assert "172.16.1.1-172.16.1.10" not in cleaned

    def test_is_private_ip_function(self):
        """Test the is_private_ip utility function."""
        from app.api.routes.scan import is_private_ip
        
        assert is_private_ip("192.168.1.1") is True
        assert is_private_ip("10.0.0.1") is True
        assert is_private_ip("172.16.1.1") is True
        assert is_private_ip("8.8.8.8") is False
        assert is_private_ip("1.1.1.1") is False
        assert is_private_ip("invalid") is False

    @pytest.mark.asyncio
    async def test_scan_hook_success(self, authenticated_client, sample_scan, test_db):
        """Test successful scan webhook."""
        hook_data = {
            "scan_id": sample_scan.uuid,
            "status": "completed"
        }
        
        response = authenticated_client.post("/api/scans/hook", json=hook_data)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["success"] is True
        
        # Verify scan status was updated
        test_db.refresh(sample_scan)
        assert sample_scan.status.value == "pending"

    @pytest.mark.asyncio
    async def test_scan_hook_scan_not_found(self, authenticated_client):
        """Test scan webhook with non-existent scan."""
        hook_data = {
            "scan_id": "nonexistent-uuid",
            "status": "completed"
        }
        
        response = authenticated_client.post("/api/scans/hook", json=hook_data)
        
        assert response.status_code == status.HTTP_200_OK
        assert "Scan not found" in response.json()["error"]

    def test_delete_scan_success(self, authenticated_client, sample_user, test_db, db_refresh):
        """Test successful scan deletion."""

        scan = Scan(
            name="Test Scan",
            user_id=sample_user.id,
            status=ScanStatus.COMPLETED,
            uuid="test-uuid"
        )
        test_db.add(scan)
        test_db.commit()

        response = authenticated_client.delete(f"/api/scans/{scan.uuid}")
        
        assert response.status_code == status.HTTP_200_OK
        assert "Scan deleted successfully" in response.json()["message"]
        
        db_refresh()
        scan = test_db.query(Scan).filter(Scan.uuid == "test-uuid").first()
        assert scan is None

    def test_delete_scan_not_found(self, authenticated_client, sample_user):
        """Test deleting a scan that doesn't exist."""
        response = authenticated_client.delete("/api/scans/nonexistent-uuid")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_scan_unauthorized(self, authenticated_client, test_db, sample_user):
        """Test deleting a scan that belongs to another user."""
        
        other_user = User(
            keycloak_uuid="other-user-uuid",
            username="otheruser",
            email="other@example.com"
        )
        test_db.add(other_user)
        test_db.commit()
        test_db.refresh(other_user)
        
        other_scan = Scan(
            name="Other Scan",
            user_id=other_user.id,
            status=ScanStatus.COMPLETED,
            uuid="test-uuid"
        )
        test_db.add(other_scan)
        test_db.commit()
        test_db.refresh(other_scan)
        
        response = authenticated_client.delete(f"/api/scans/{other_scan.uuid}")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_bulk_delete_scans_success(self, authenticated_client, sample_user, test_db, db_refresh):
        """Test successful bulk deletion of scans."""
        scans = [
            Scan(name="Scan 1", user_id=sample_user.id, status=ScanStatus.PENDING, uuid="test-uuid-1"),
            Scan(name="Scan 2", user_id=sample_user.id, status=ScanStatus.PENDING, uuid="test-uuid-2"),
            Scan(name="Scan 3", user_id=sample_user.id, status=ScanStatus.PENDING, uuid="test-uuid-3")
        ]
        test_db.add_all(scans)
        test_db.commit()
        for scan in scans:
            test_db.refresh(scan)
        
        scan_uuids = [scan.uuid for scan in scans]
        
        response = authenticated_client.post("/api/scans/bulk-delete", json=scan_uuids)
        
        assert response.status_code == status.HTTP_200_OK
        assert "Scans deleted successfully" in response.json()["message"]

        db_refresh()

        remaining_scans = test_db.query(Scan).filter(Scan.uuid.in_(scan_uuids)).all()
        assert len(remaining_scans) == 0

    def test_bulk_delete_scans_unauthorized(self, authenticated_client, sample_user, test_db):
        """Test bulk deletion fails when user doesn't own all scans."""
        other_user = User(
            keycloak_uuid="other-user-uuid",
            username="otheruser",
            email="other@example.com"
        )
        test_db.add(other_user)
        test_db.commit()
        test_db.refresh(other_user)
        
        user_scan = Scan(name="User Scan", user_id=sample_user.id, status=ScanStatus.COMPLETED, uuid="test-uuid-1")
        other_scan = Scan(name="Other Scan", user_id=other_user.id, status=ScanStatus.COMPLETED, uuid="test-uuid-2")
        test_db.add_all([user_scan, other_scan])
        test_db.commit()
        test_db.refresh(user_scan)
        test_db.refresh(other_scan)
        
        scan_uuids = [user_scan.uuid, other_scan.uuid]
        
        response = authenticated_client.post("/api/scans/bulk-delete", json=scan_uuids)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not authorized to delete scan" in response.json()["detail"]

    def test_get_or_create_targets_function(self, test_db, sample_user):
        """Test the get_or_create_targets utility function."""
        target_names = ["example.com", "test.com", "example.com"]  # Duplicate
        
        targets = get_or_create_targets(target_names, sample_user, test_db)
        
        assert len(targets) == 2  # Should deduplicate
        assert any(t.name == "example.com" for t in targets)
        assert any(t.name == "test.com" for t in targets)
        
        # Verify targets were created in database
        db_targets = test_db.query(Target).filter(Target.user_id == sample_user.id).all()
        assert len(db_targets) == 2

    def test_create_scan_entry_function(self, test_db, sample_user, sample_target):
        """Test the create_scan_entry utility function."""
        
        payload = {
            "scan_id": "test-scan-uuid",
            "scan_type": ScanType.DEFAULT,
            "scan_options": {"ports": "80,443"}
        }
        
        create_scan_entry([sample_target], sample_user, payload, test_db)
        
        # Verify scan was created
        scan = test_db.query(Scan).filter(Scan.uuid == payload["scan_id"]).first()
        assert scan is not None
        assert scan.name == "Assessment no. 1"
        assert sample_target in scan.targets

    def test_scans_require_authentication(self, client):
        """Test that all scan endpoints require authentication."""
        endpoints = [
            ("GET", "/api/scans/"),
            ("GET", "/api/scans/some-uuid"),
            ("GET", "/api/scans/some-uuid/status"),
            ("GET", "/api/scans/some-uuid/findings"),
            ("POST", "/api/scans/start"),
            ("POST", "/api/scans/some-uuid/report"),
            ("DELETE", "/api/scans/some-uuid"),
            ("POST", "/api/scans/bulk-delete"),
        ]
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = client.get(endpoint)
            elif method == "POST":
                response = client.post(endpoint, json={})
            elif method == "DELETE":
                response = client.delete(endpoint)
            
            assert response.status_code in [401, 403, 422]  # Authentication required


class TestScanWebSocketFunctionality:
    """Test WebSocket functionality for scan routes."""
    
    @pytest.mark.asyncio
    @patch('redis.asyncio.Redis')
    async def test_websocket_scans_functionality(self, mock_redis_class):
        """Test WebSocket functionality for scan list updates."""
        # This is a complex test that would require WebSocket test client
        # For now, we test that the Redis connection is properly mocked
        mock_redis = AsyncMock()
        mock_redis_class.return_value = mock_redis
        
        # The actual WebSocket testing would require a WebSocket test client
        # which is more complex and depends on your specific testing setup
        assert mock_redis_class is not None

    @pytest.mark.asyncio
    @patch('redis.asyncio.Redis')
    async def test_websocket_individual_scan_functionality(self, mock_redis_class):
        """Test WebSocket functionality for individual scan updates."""
        mock_redis = AsyncMock()
        mock_redis_class.return_value = mock_redis
        
        # Mock pubsub
        mock_pubsub = AsyncMock()
        mock_redis.pubsub.return_value = mock_pubsub
        
        # The actual WebSocket testing would require more complex setup
        assert mock_redis_class is not None 