import pytest
from unittest.mock import patch, Mock, mock_open
from fastapi import status
import os
import tempfile
from app.models.user import User
from app.models.scan import Scan, ScanStatus
from app.models.report import Report


class TestReportRoutes:
    """Test cases for report routes."""

    def test_get_reports_empty_list(self, authenticated_client, sample_user):
        """Test getting reports when user has no reports."""
        response = authenticated_client.get("/api/reports/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert data["data"] == []

    def test_get_reports_with_data(self, authenticated_client, sample_user, sample_report, test_db):
        """Test getting reports when user has reports."""
        response = authenticated_client.get("/api/reports/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert len(data["data"]) == 1
        
        report_data = data["data"][0]
        assert report_data["id"] == sample_report.id
        assert report_data["uuid"] == sample_report.uuid
        assert report_data["name"] == sample_report.name
        assert report_data["status"] == sample_report.status.value
        assert "created_at" in report_data
        assert "updated_at" in report_data

    def test_get_reports_only_user_reports(self, authenticated_client, sample_user, test_db):
        """Test that users only see reports from their own scans."""
        # Create another user and their scan/report
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
            status=ScanStatus.COMPLETED
        )
        test_db.add(other_scan)
        test_db.commit()
        test_db.refresh(other_scan)
        
        other_report = Report(
            name="Other Report",
            scan_id=other_scan.id,
            status="GENERATED"
        )
        test_db.add(other_report)
        test_db.commit()
        
        response = authenticated_client.get("/api/reports/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should not include the other user's report
        assert len(data["data"]) == 0

    def test_get_report_by_uuid_success(self, authenticated_client, sample_report):
        """Test getting a specific report by UUID."""
        response = authenticated_client.get(f"/api/reports/{sample_report.uuid}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == sample_report.id
        assert data["uuid"] == sample_report.uuid
        assert data["name"] == sample_report.name
        assert data["status"] == sample_report.status.value

    def test_get_report_not_found(self, authenticated_client, sample_user, test_db):
        """Test getting a report that doesn't exist."""
        response = authenticated_client.get("/api/reports/nonexistent-uuid")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Report not found" in response.json()["detail"]

    def test_get_report_unauthorized(self, authenticated_client, test_db, sample_user):
        """Test getting a report that belongs to another user."""
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
            status=ScanStatus.COMPLETED
        )
        test_db.add(other_scan)
        test_db.commit()
        test_db.refresh(other_scan)
        
        other_report = Report(
            name="Other Report",
            scan_id=other_scan.id,
            status="GENERATED"
        )
        test_db.add(other_report)
        test_db.commit()
        test_db.refresh(other_report)
        
        response = authenticated_client.get(f"/api/reports/{other_report.uuid}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch('os.path.exists')
    @patch('os.remove')
    def test_delete_report_success(self, mock_remove, mock_exists, authenticated_client, sample_report, test_db, db_refresh):
        """Test successful report deletion."""
        mock_exists.return_value = True
        report_uuid = sample_report.uuid
        
        response = authenticated_client.delete(f"/api/reports/{report_uuid}")
        
        assert response.status_code == status.HTTP_200_OK
        assert "Report deleted successfully" in response.json()["message"]

        db_refresh()
        
        # Verify report was deleted from database
        report = test_db.query(Report).filter(Report.uuid == report_uuid).first()
        assert report is None

    def test_delete_report_not_found(self, authenticated_client, sample_user):
        """Test deleting a report that doesn't exist."""
        response = authenticated_client.delete("/api/reports/nonexistent-uuid")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_report_unauthorized(self, authenticated_client, test_db, sample_user, db_refresh):
        """Test deleting a report that belongs to another user."""
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
            status=ScanStatus.COMPLETED
        )
        test_db.add(other_scan)
        test_db.commit()
        test_db.refresh(other_scan)
        
        other_report = Report(
            name="Other Report",
            scan_id=other_scan.id,
            status="GENERATED"
        )
        test_db.add(other_report)
        test_db.commit()
        test_db.refresh(other_report)
        
        db_refresh()
        
        response = authenticated_client.delete(f"/api/reports/{other_report.uuid}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_download_report_not_found(self, authenticated_client, sample_user):
        """Test downloading a report that doesn't exist."""
        response = authenticated_client.get("/api/reports/nonexistent-uuid/download")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch('os.path.exists')
    def test_download_report_not_ready(self, mock_exists, authenticated_client, test_db, sample_user, db_refresh):
        """Test downloading a report that is not ready."""
        scan = Scan(
            name="Test Scan",
            user_id=sample_user.id,
            status=ScanStatus.COMPLETED
        )
        test_db.add(scan)
        test_db.commit()
        test_db.refresh(scan)
        
        report = Report(
            name="Test Report",
            scan_id=scan.id,
            status="PENDING"  # Not generated yet
        )
        test_db.add(report)
        test_db.commit()
        test_db.refresh(report)
        
        response = authenticated_client.get(f"/api/reports/{report.uuid}/download")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Report is not ready for download" in response.json()["detail"]

    @patch('os.path.exists')
    def test_download_report_file_not_found(self, mock_exists, authenticated_client, test_db, sample_user, db_refresh):
        """Test downloading a report when file doesn't exist."""
        scan = Scan(
            name="Test Scan",
            user_id=sample_user.id,
            status=ScanStatus.COMPLETED
        )
        test_db.add(scan)
        test_db.commit()
        test_db.refresh(scan)
        
        report = Report(
            name="Test Report",
            scan_id=scan.id,
            status="GENERATED",
            url="/tmp/nonexistent-report.pdf"
        )
        test_db.add(report)
        test_db.commit()
        test_db.refresh(report)
        
        mock_exists.return_value = False
        
        response = authenticated_client.get(f"/api/reports/{report.uuid}/download")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Report file not found" in response.json()["detail"]

    def test_bulk_delete_reports_success(self, authenticated_client, sample_user, test_db, db_refresh):
        """Test successful bulk deletion of reports."""
        # Create scan
        scan = Scan(
            name="Test Scan",
            user_id=sample_user.id,
            status=ScanStatus.COMPLETED
        )
        test_db.add(scan)
        test_db.commit()
        test_db.refresh(scan)
        
        # Create reports
        reports = [
            Report(name="Report 1", scan_id=scan.id, status="GENERATED"),
            Report(name="Report 2", scan_id=scan.id, status="GENERATED"),
            Report(name="Report 3", scan_id=scan.id, status="GENERATED")
        ]
        test_db.add_all(reports)
        test_db.commit()
        for report in reports:
            test_db.refresh(report)

        db_refresh()
        
        report_uuids = [report.uuid for report in reports]
        
        response = authenticated_client.post("/api/reports/bulk-delete", json=report_uuids)
        
        assert response.status_code == status.HTTP_200_OK
        assert "3 report(s) deleted successfully" in response.json()["message"]

        db_refresh()
        
        # Verify reports were deleted
        remaining_reports = test_db.query(Report).filter(Report.uuid.in_(report_uuids)).all()
        assert len(remaining_reports) == 0

    def test_bulk_delete_reports_unauthorized(self, authenticated_client, sample_user, test_db, db_refresh):
        """Test bulk deletion fails when user doesn't own all reports."""
        # Create another user
        other_user = User(
            keycloak_uuid="other-user-uuid",
            username="otheruser",
            email="other@example.com"
        )
        test_db.add(other_user)
        test_db.commit()
        test_db.refresh(other_user)
        
        # Create scans for both users
        user_scan = Scan(name="User Scan", user_id=sample_user.id, status=ScanStatus.COMPLETED)
        other_scan = Scan(name="Other Scan", user_id=other_user.id, status=ScanStatus.COMPLETED)
        test_db.add_all([user_scan, other_scan])
        test_db.commit()
        test_db.refresh(user_scan)
        test_db.refresh(other_scan)
        
        # Create reports
        user_report = Report(name="User Report", scan_id=user_scan.id, status="GENERATED")
        other_report = Report(name="Other Report", scan_id=other_scan.id, status="GENERATED")
        test_db.add_all([user_report, other_report])
        test_db.commit()
        test_db.refresh(user_report)
        test_db.refresh(other_report)
        
        report_uuids = [user_report.uuid, other_report.uuid]
        
        response = authenticated_client.post("/api/reports/bulk-delete", json=report_uuids)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not authorized to delete report" in response.json()["detail"]

    def test_bulk_delete_reports_empty_list(self, authenticated_client, sample_user):
        """Test bulk deletion with empty list."""
        response = authenticated_client.post("/api/reports/bulk-delete", json=[])
        
        assert response.status_code == status.HTTP_200_OK
        assert "0 report(s) deleted successfully" in response.json()["message"]

    @patch('os.path.exists')
    @patch('os.remove')
    def test_delete_report_file_removal_failure(self, mock_remove, mock_exists, authenticated_client, test_db, sample_user, db_refresh):
        """Test report deletion when file removal fails."""
        scan = Scan(
            name="Test Scan",
            user_id=sample_user.id,
            status=ScanStatus.COMPLETED
        )
        test_db.add(scan)
        test_db.commit()
        test_db.refresh(scan)
        
        report = Report(
            name="Test Report",
            scan_id=scan.id,
            status="GENERATED",
            url="/tmp/test-report.pdf"
        )
        test_db.add(report)
        test_db.commit()
        test_db.refresh(report)
        
        mock_exists.return_value = True
        mock_remove.side_effect = OSError("Permission denied")
        
        response = authenticated_client.delete(f"/api/reports/{report.uuid}")
        
        # Should still succeed even if file removal fails
        assert response.status_code == status.HTTP_200_OK
        assert "Report deleted successfully" in response.json()["message"]

    def test_download_report_media_type_detection(self, authenticated_client, test_db, sample_user, db_refresh):
        """Test that download sets correct media type based on report type."""
        scan = Scan(
            name="Test Scan",
            user_id=sample_user.id,
            status=ScanStatus.COMPLETED
        )
        test_db.add(scan)
        test_db.commit()
        test_db.refresh(scan)
        
        test_cases = [
            ("PDF", "pdf", "application/pdf"),
            ("JSON", "json", "text/plain"),
            ("CSV", "csv", "text/csv"),
        ]
        
        for report_type, type_value, expected_media_type in test_cases:
            with patch('os.path.exists', return_value=True):
                with patch('app.api.routes.report.FileResponse') as mock_file_response:
                    report = Report(
                        name=f"Test Report {report_type}",
                        scan_id=scan.id,
                        status="GENERATED",
                        url=f"/tmp/test-report.{type_value}",
                        type=type_value
                    )
                    test_db.add(report)
                    test_db.commit()
                    test_db.refresh(report)
                    
                    response = authenticated_client.get(f"/api/reports/{report.uuid}/download")
                    
                    assert response.status_code == status.HTTP_200_OK
                    # Verify correct media type was used
                    call_args = mock_file_response.call_args
                    assert call_args[1]["media_type"] == expected_media_type
                    
                    # Clean up for next iteration
                    test_db.delete(report)
                    test_db.commit()

    def test_reports_require_authentication(self, client):
        """Test that all report endpoints require authentication."""
        endpoints = [
            ("GET", "/api/reports/"),
            ("GET", "/api/reports/some-uuid"),
            ("GET", "/api/reports/some-uuid/download"),
            ("DELETE", "/api/reports/some-uuid"),
            ("POST", "/api/reports/bulk-delete"),
        ]
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = client.get(endpoint)
            elif method == "POST":
                response = client.post(endpoint, json={})
            elif method == "DELETE":
                response = client.delete(endpoint)
            
            assert response.status_code in [401, 403, 422]  # Authentication required 