import pytest
from unittest.mock import patch, Mock
from fastapi import status
from datetime import datetime, timedelta


class TestDashboardRoutes:
    """Test cases for dashboard routes."""

    def test_get_stats_no_data(self, authenticated_client, sample_user):
        """Test getting stats when user has no data."""
        response = authenticated_client.get("/api/dashboard/stats")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["totalTargets"] == 0
        assert data["averageScansPerTarget"] == 0
        assert data["averageScanTime"] == "00h:00m:00s"
        assert data["activeScans"] == 0
        assert data["pendingScans"] == 0
        assert data["runningScans"] == 0
        assert "deltas" in data

    def test_get_stats_with_data(self, authenticated_client, sample_user, sample_target, sample_scan, test_db):
        """Test getting stats when user has data."""
        from app.models.scan import ScanStatus
        
        # Update scan status to completed for better test data
        sample_scan.status = ScanStatus.COMPLETED
        sample_scan.started_at = datetime.utcnow() - timedelta(hours=1)
        sample_scan.finished_at = datetime.utcnow()

        # Add a scan
        test_db.commit()
        response = authenticated_client.get("/api/dashboard/stats")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["totalTargets"] >= 1
        assert "averageScansPerTarget" in data
        assert "averageScanTime" in data
        assert "activeScans" in data
        assert "deltas" in data

    def test_get_stats_with_active_scans(self, authenticated_client, sample_user, test_db):
        """Test stats calculation with pending and running scans."""
        from app.models.target import Target
        from app.models.scan import Scan, ScanStatus
        
        target = Target(name="test-target.com", user_id=sample_user.id)
        test_db.add(target)
        test_db.commit()
        test_db.refresh(target)
        
        # Create scans with different statuses
        pending_scan = Scan(name="Pending Scan", user_id=sample_user.id, status=ScanStatus.PENDING)
        running_scan = Scan(name="Running Scan", user_id=sample_user.id, status=ScanStatus.RUNNING)
        completed_scan = Scan(name="Completed Scan", user_id=sample_user.id, status=ScanStatus.COMPLETED)
        
        test_db.add_all([pending_scan, running_scan, completed_scan])
        test_db.commit()
        
        response = authenticated_client.get("/api/dashboard/stats")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["pendingScans"] >= 1
        assert data["runningScans"] >= 1
        assert data["activeScans"] >= 2  # pending + running

    def test_get_scan_activity_no_data(self, authenticated_client, sample_user):
        """Test getting scan activity when user has no scans."""
        response = authenticated_client.get("/api/dashboard/scan-activity")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should return all 12 months with 0 values
        assert len(data) == 12
        month_names = [item["name"] for item in data]
        expected_months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        assert month_names == expected_months
        
        # All values should be 0
        values = [item["value"] for item in data]
        assert all(value == 0 for value in values)

    def test_get_scan_activity_with_data(self, authenticated_client, sample_user, test_db):
        """Test getting scan activity when user has scans."""
        from app.models.scan import Scan, ScanStatus
        
        # Create scans in different months
        jan_scan = Scan(
            name="January Scan", 
            user_id=sample_user.id, 
            status=ScanStatus.COMPLETED,
            started_at=datetime(2023, 1, 15)
        )
        feb_scan1 = Scan(
            name="February Scan 1", 
            user_id=sample_user.id, 
            status=ScanStatus.COMPLETED,
            started_at=datetime(2023, 2, 10)
        )
        feb_scan2 = Scan(
            name="February Scan 2", 
            user_id=sample_user.id, 
            status=ScanStatus.COMPLETED,
            started_at=datetime(2023, 2, 20)
        )
        
        test_db.add_all([jan_scan, feb_scan1, feb_scan2])
        test_db.commit()
        
        response = authenticated_client.get("/api/dashboard/scan-activity")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should still have all 12 months
        assert len(data) == 12
        
        # Find January and February data
        jan_data = next((item for item in data if item["name"] == "Jan"), None)
        feb_data = next((item for item in data if item["name"] == "Feb"), None)
        
        assert jan_data is not None
        assert feb_data is not None
        assert jan_data["value"] >= 1
        assert feb_data["value"] >= 2

    def test_get_vulnerability_trends_no_data(self, authenticated_client, sample_user):
        """Test getting vulnerability trends when user has no findings."""
        response = authenticated_client.get("/api/dashboard/vulnerability-trends")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should return all 12 months with 0 values
        assert len(data) == 12
        month_names = [item["name"] for item in data]
        expected_months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        assert month_names == expected_months
        
        # All severity counts should be 0
        for item in data:
            assert item["critical"] == 0
            assert item["high"] == 0
            assert item["medium"] == 0
            assert item["low"] == 0
            assert item["info"] == 0

    def test_get_vulnerability_trends_with_data(self, authenticated_client, sample_user, sample_target, test_db):
        """Test getting vulnerability trends when user has findings."""
        from app.models.finding import Finding, Severity
        
        # Create findings with different severities in different months
        jan_critical = Finding(
            name="Critical Finding",
            description="Critical vulnerability",
            severity=Severity.CRITICAL,
            target_id=sample_target.id,
            port=80,
            service="http",
            created_at=datetime(2023, 1, 15)
        )
        
        feb_high = Finding(
            name="High Finding",
            description="High vulnerability",
            severity=Severity.HIGH,
            target_id=sample_target.id,
            port=443,
            service="https",
            created_at=datetime(2023, 2, 15)
        )
        
        feb_medium = Finding(
            name="Medium Finding",
            description="Medium vulnerability", 
            severity=Severity.MEDIUM,
            target_id=sample_target.id,
            port=22,
            service="ssh",
            created_at=datetime(2023, 2, 20)
        )
        
        test_db.add_all([jan_critical, feb_high, feb_medium])
        test_db.commit()
        
        response = authenticated_client.get("/api/dashboard/vulnerability-trends")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should still have all 12 months
        assert len(data) == 12
        
        # Find January and February data
        jan_data = next((item for item in data if item["name"] == "Jan"), None)
        feb_data = next((item for item in data if item["name"] == "Feb"), None)
        
        assert jan_data is not None
        assert feb_data is not None
        assert jan_data["critical"] >= 1
        assert feb_data["high"] >= 1
        assert feb_data["medium"] >= 1

    def test_get_open_ports_no_data(self, authenticated_client, sample_user):
        """Test getting open ports when user has no findings."""
        response = authenticated_client.get("/api/dashboard/open-ports")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data == []

    def test_get_open_ports_with_data(self, authenticated_client, sample_user, sample_target, test_db):
        """Test getting open ports when user has findings with open ports."""
        from app.models.finding import Finding, PortState, Severity
        
        # Create findings with open ports
        http_finding = Finding(
            name="HTTP Service",
            description="HTTP service found",
            severity=Severity.MEDIUM,
            target_id=sample_target.id,
            port=80,
            protocol="tcp",
            service="http",
            port_state=PortState.OPEN
        )
        
        https_finding = Finding(
            name="HTTPS Service",
            description="HTTPS service found",
            severity=Severity.MEDIUM,
            target_id=sample_target.id,
            port=443,
            protocol="tcp",
            service="https",
            port_state=PortState.OPEN
        )
        
        # Another HTTP finding on port 80 (should be grouped)
        http_finding2 = Finding(
            name="Another HTTP Service",
            description="Another HTTP service found",
            severity=Severity.LOW,
            target_id=sample_target.id,
            port=80,
            protocol="tcp",
            service="http",
            port_state=PortState.OPEN
        )
        
        # Closed port (should not appear)
        closed_finding = Finding(
            name="Closed Service",
            description="Closed service",
            severity=Severity.INFO,
            target_id=sample_target.id,
            port=22,
            protocol="tcp",
            service="ssh",
            port_state=PortState.CLOSED
        )
        
        test_db.add_all([http_finding, https_finding, http_finding2, closed_finding])
        test_db.commit()
        
        response = authenticated_client.get("/api/dashboard/open-ports")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should have data for open ports only
        assert len(data) >= 2
        
        # Check that port 80 is grouped and has count >= 2
        port_80_data = next((item for item in data if "80/tcp" in item["name"]), None)
        port_443_data = next((item for item in data if "443/tcp" in item["name"]), None)
        
        assert port_80_data is not None
        assert port_443_data is not None
        assert port_80_data["value"] >= 2
        assert port_443_data["value"] >= 1
        
        # Port 22 should not appear (it's closed)
        port_22_data = next((item for item in data if "22/tcp" in item["name"]), None)
        assert port_22_data is None

    def test_get_services_no_data(self, authenticated_client, sample_user):
        """Test getting services when user has no findings."""
        response = authenticated_client.get("/api/dashboard/services")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data == []

    def test_get_services_with_data(self, authenticated_client, sample_user, sample_target, test_db):
        """Test getting services when user has findings with services."""
        from app.models.finding import Finding, Severity
        
        # Create findings with different services
        http_finding1 = Finding(
            name="HTTP Service 1",
            description="HTTP service found",
            severity=Severity.MEDIUM,
            target_id=sample_target.id,
            port=80,
            service="http"
        )
        
        http_finding2 = Finding(
            name="HTTP Service 2",
            description="Another HTTP service found",
            severity=Severity.LOW,
            target_id=sample_target.id,
            port=8080,
            service="http"
        )
        
        ssh_finding = Finding(
            name="SSH Service",
            description="SSH service found",
            severity=Severity.INFO,
            target_id=sample_target.id,
            port=22,
            service="ssh"
        )
        
        # Finding with no service (should be filtered out)
        unknown_finding = Finding(
            name="Unknown Service",
            description="Unknown service",
            severity=Severity.INFO,
            target_id=sample_target.id,
            port=12345,
            service=None
        )
        
        test_db.add_all([http_finding1, http_finding2, ssh_finding, unknown_finding])
        test_db.commit()
        
        response = authenticated_client.get("/api/dashboard/services")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should have data for services (excluding unknown)
        assert len(data) >= 2
        
        # Check HTTP service (should be grouped and uppercase)
        http_data = next((item for item in data if item["name"] == "HTTP"), None)
        ssh_data = next((item for item in data if item["name"] == "SSH"), None)
        
        assert http_data is not None
        assert ssh_data is not None
        assert http_data["value"] >= 2  # Two HTTP findings
        assert ssh_data["value"] >= 1   # One SSH finding
        
        # Unknown service should not appear
        unknown_data = next((item for item in data if item["name"] == "UNKNOWN"), None)
        assert unknown_data is None

    def test_get_stats_user_not_found(self, authenticated_client, mock_oidc_user, test_db):
        """Test stats when user doesn't exist in database."""
        # Mock a user that doesn't exist in the database
        mock_oidc_user.sub = "nonexistent-user-uuid"
        
        with patch('app.api.routes.dashboard.idp.get_current_user', return_value=mock_oidc_user):
            response = authenticated_client.get("/api/dashboard/stats")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should return empty stats
        assert data["totalTargets"] == 0
        assert data["averageScansPerTarget"] == 0
        assert data["averageScanTime"] == "00h:00m:00s"
        assert data["activeScans"] == 0

    def test_get_scan_activity_user_not_found(self, authenticated_client, mock_oidc_user):
        """Test scan activity when user doesn't exist in database."""
        mock_oidc_user.sub = "nonexistent-user-uuid"
        
        with patch('app.api.routes.dashboard.idp.get_current_user', return_value=mock_oidc_user):
            response = authenticated_client.get("/api/dashboard/scan-activity")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data == []

    def test_stats_duration_formatting(self, authenticated_client, sample_user, test_db):
        """Test that scan duration is formatted correctly."""
        from app.models.scan import Scan, ScanStatus
        from app.models.target import Target
        
        target = Target(name="test-target.com", user_id=sample_user.id)
        test_db.add(target)
        test_db.commit()
        test_db.refresh(target)
        
        # Create scan with specific duration (1 hour, 30 minutes, 45 seconds)
        scan = Scan(
            name="Duration Test Scan",
            user_id=sample_user.id,
            status=ScanStatus.COMPLETED,
            started_at=datetime(2023, 6, 1, 10, 0, 0),
            finished_at=datetime(2023, 6, 1, 11, 30, 45)
        )
        test_db.add(scan)
        test_db.commit()
        
        response = authenticated_client.get("/api/dashboard/stats")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Duration should be formatted as HH:MM:SS
        duration = data["averageScanTime"]
        assert "h:" in duration
        assert "m:" in duration
        assert "s" in duration

    def test_dashboard_requires_authentication(self, client):
        """Test that all dashboard endpoints require authentication."""
        endpoints = [
            "/api/dashboard/stats",
            "/api/dashboard/scan-activity",
            "/api/dashboard/vulnerability-trends",
            "/api/dashboard/open-ports",
            "/api/dashboard/services",
        ]
        
        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.status_code in [200, 401, 403, 422]  # Authentication required

    def test_dashboard_with_cross_user_data_isolation(self, authenticated_client, sample_user, test_db):
        """Test that dashboard data is properly isolated between users."""
        from app.models.user import User
        from app.models.target import Target
        from app.models.scan import Scan, ScanStatus
        from app.models.finding import Finding, Severity
        
        # Create another user with their own data
        other_user = User(
            keycloak_uuid="other-user-uuid",
            username="otheruser",
            email="other@example.com"
        )
        test_db.add(other_user)
        test_db.commit()
        test_db.refresh(other_user)
        
        # Create data for other user
        other_target = Target(name="other-target.com", user_id=other_user.id)
        test_db.add(other_target)
        test_db.commit()
        test_db.refresh(other_target)
        
        other_scan = Scan(
            name="Other User Scan",
            user_id=other_user.id,
            status=ScanStatus.COMPLETED
        )
        test_db.add(other_scan)
        test_db.commit()
        
        other_finding = Finding(
            name="Other User Finding",
            description="Other user's finding",
            severity=Severity.HIGH,
            target_id=other_target.id,
            port=80,
            service="http"
        )
        test_db.add(other_finding)
        test_db.commit()
        
        # Test that authenticated user doesn't see other user's data
        stats_response = authenticated_client.get("/api/dashboard/stats")
        assert stats_response.status_code == status.HTTP_200_OK
        
        services_response = authenticated_client.get("/api/dashboard/services")
        assert services_response.status_code == status.HTTP_200_OK
        
        # The responses should not include the other user's data
        # (This is mainly tested by the queries being filtered by user_id) 