import pytest
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import tempfile
import os
from datetime import datetime, timezone
from pathlib import Path
import sys
import uuid
from httpx import AsyncClient

# Properly mock fastapi_keycloak before any imports
class MockOIDCUser:
    def __init__(self, sub="test-keycloak-uuid-123", username="testuser", email="test@example.com", preferred_username="testuser"):
        self.sub = sub
        self.username = username
        self.email = email
        self.preferred_username = preferred_username

class MockFastAPIKeycloak:
    def __init__(self, *args, **kwargs):
        pass
    
    def get_current_user(self, *args, **kwargs):
        def dependency():
            return MockOIDCUser()
        return dependency
    
    def get_user(self, *args, **kwargs):
        mock_user = Mock()
        mock_user.enabled = True
        mock_user.username = "testuser"
        mock_user.id = "test-keycloak-uuid-123"
        mock_user.firstName = "Test"
        mock_user.lastName = "User"
        mock_user.email = "test@example.com"
        mock_user.emailVerified = True
        mock_user.createdTimestamp = int(datetime.now().timestamp() * 1000)
        mock_user.attributes = {}
        return mock_user
    
    def get_user_roles(self, *args, **kwargs):
        mock_role = Mock()
        mock_role.name = "user"
        return [mock_role]
    
    def update_user(self, user):
        return user
    
    def add_swagger_config(self, app):
        pass

# Mock the entire module
mock_keycloak = MockFastAPIKeycloak
sys.modules['fastapi_keycloak'] = MagicMock()
sys.modules['fastapi_keycloak'].FastAPIKeycloak = mock_keycloak
sys.modules['fastapi_keycloak'].OIDCUser = MockOIDCUser

# Import your app and dependencies
from app.main import app
from app.database.base_class import Base
from app.database.db import get_db
from app.api.dependencies import idp
from app.api.routes.admin import require_admin_role
from app.models.user import User
from app.models.target import Target
from app.models.scan import Scan, ScanStatus
from app.models.finding import Finding, Severity
from app.models.report import Report, ReportStatus, ReportType


SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:root@localhost:3306/test_db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def test_db():
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(test_db):
    """Create a test client with a shared test_db session."""

    # Create a generator override function (as FastAPI expects)
    def override_get_db():
        try:
            yield test_db
        finally:
            # Ensure changes are committed after the API call
            try:
                test_db.commit()
            except Exception:
                test_db.rollback()

    # Set the dependency override before creating the TestClient
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    # Clean up
    app.dependency_overrides.clear()


@pytest.fixture
def mock_keycloak_user():
    """Mock Keycloak user object."""
    mock_user = Mock()
    mock_user.id = "test-keycloak-uuid-123"
    mock_user.sub = "test-keycloak-uuid-123"
    mock_user.username = "testuser"
    mock_user.firstName = "Test"
    mock_user.lastName = "User"
    mock_user.enabled = True
    mock_user.emailVerified = True
    mock_user.email = "test@example.com"
    mock_user.createdTimestamp = int(datetime.now().timestamp() * 1000)
    mock_user.attributes = {}
    return mock_user


@pytest.fixture
def mock_oidc_user():
    """Mock OIDC user object."""
    mock_user = Mock()
    mock_user.sub = "test-keycloak-uuid-123"
    mock_user.username = "testuser"
    mock_user.email = "test@example.com"
    mock_user.preferred_username = "testuser"
    return mock_user


@pytest.fixture
def mock_admin_user():
    """Mock admin OIDC user object."""
    mock_user = Mock()
    mock_user.sub = "admin-keycloak-uuid-456"
    mock_user.username = "admin"
    mock_user.email = "admin@example.com"
    mock_user.preferred_username = "admin"
    return mock_user


@pytest.fixture
def sample_user(test_db):
    """Create a sample user in the test database."""
    user = User(
        keycloak_uuid="test-keycloak-uuid-123",
        username="testuser",
        first_name="Test",
        last_name="User",
        enabled=True,
        email_verified=True,
        email="test@example.com"
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def sample_target(test_db, sample_user):
    """Create a sample target in the test database."""
    target = Target(
        name="example.com",
        uuid=uuid.uuid4(),
        user_id=sample_user.id
    )
    test_db.add(target)
    test_db.commit()
    test_db.refresh(target)
    return target


@pytest.fixture
def sample_scan(test_db, sample_user):
    """Create a sample scan in the test database."""
    scan = Scan(
        name="Test Scan",
        uuid=uuid.uuid4(),
        user_id=sample_user.id,
        status=ScanStatus.PENDING
    )
    test_db.add(scan)
    test_db.commit()
    test_db.refresh(scan)
    return scan


@pytest.fixture
def sample_finding(test_db, sample_target):
    """Create a sample finding in the test database."""
    finding = Finding(
        name="Test Finding",
        description="Test finding description",
        severity=Severity.HIGH,
        target_id=sample_target.id,
        port=80,
        service="http",
        uuid=uuid.uuid4()
    )
    test_db.add(finding)
    test_db.commit()
    test_db.refresh(finding)
    return finding


@pytest.fixture
def sample_report(test_db, sample_scan):
    """Create a sample report in the test database."""
    report = Report(
        name="Test Report",
        status=ReportStatus.GENERATED,
        uuid=uuid.uuid4(),
        scan_id=sample_scan.id
    )
    test_db.add(report)
    test_db.commit()
    test_db.refresh(report)
    return report


@pytest.fixture
def mock_idp():
    """Mock the FastAPI Keycloak idp dependency."""
    with patch('app.api.dependencies.idp') as mock:
        yield mock


@pytest.fixture
def authenticated_client(client, mock_oidc_user, mock_keycloak_user):
    """Create an authenticated test client."""
    class UserMockFastAPIKeycloak:
        def get_current_user(self, *args, **kwargs):
            def dependency():
                return mock_oidc_user
            return dependency
        
        def get_user(self, *args, **kwargs):
            return mock_keycloak_user
        
        def get_user_roles(self, *args, **kwargs):
            mock_role = Mock()
            mock_role.name = "user"
            return [mock_role]
        
        def update_user(self, user):
            return user
        
        def add_swagger_config(self, app):
            pass
    
    with patch('app.api.dependencies.idp', UserMockFastAPIKeycloak()):
        yield client

@pytest.fixture
def admin_client(client, mock_admin_user, mock_keycloak_user):
    """Create an authenticated admin test client."""
    # Create an admin version of the MockFastAPIKeycloak
    class AdminMockFastAPIKeycloak:
        def get_current_user(self, *args, **kwargs):
            def dependency():
                return mock_admin_user
            return dependency
        
        def get_user(self, *args, **kwargs):
            return mock_keycloak_user
        
        def get_user_roles(self, *args, **kwargs):
            mock_role = Mock()
            mock_role.name = "admin"
            return [mock_role]
        
        def update_user(self, user):
            return user
        
        def add_swagger_config(self, app):
            pass
    
    # Patch the idp instance with admin version
    with patch('app.api.dependencies.idp', AdminMockFastAPIKeycloak()):
        yield client


@pytest.fixture
def mock_httpx():
    """Mock httpx async client for external HTTP calls."""
    with patch('httpx.AsyncClient') as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        yield mock_async_client


@pytest.fixture
def mock_redis():
    """Mock Redis connection."""
    with patch('redis.Redis') as mock:
        yield mock


@pytest.fixture
def mock_celery():
    """Mock Celery for background tasks."""
    with patch('celery.Celery') as mock:
        yield mock


@pytest.fixture
def mock_socket():
    """Mock socket operations for DNS resolution."""
    with patch('socket.gethostbyname') as mock:
        mock.return_value = "192.168.1.1"
        yield mock


# Utility functions for tests
class TestData:
    """Helper class with test data constants."""
    
    VALID_TARGET_DATA = {"name": "example.com"}
    VALID_SCAN_DATA = {"name": "Test Scan"}
    VALID_FINDING_DATA = {
        "name": "Test Finding",
        "description": "Test description",
        "severity": Severity.HIGH,
        "port": 80,
        "service": "http",
        "target_id": 1
    }
    VALID_REPORT_DATA = {"name": "Test Report"}
    
    IP_API_RESPONSE = {
        "country": "United States",
        "countryCode": "US",
        "region": "CA",
        "regionName": "California",
        "city": "San Francisco",
        "zip": "94102",
        "lat": 37.7749,
        "lon": -122.4194,
        "timezone": "America/Los_Angeles",
        "isp": "Example ISP",
        "org": "Example Organization",
        "as": "AS12345 Example AS",
        "query": "192.168.1.1"
    }


@pytest.fixture
def test_data():
    """Provide test data constants."""
    return TestData 

@pytest.fixture
def db_refresh(test_db):
    """Helper to refresh database state after API calls."""
    def refresh_after_api_call():
        """Call this after API calls to ensure test sees committed changes."""
        test_db.commit()      # Commit any pending changes
        test_db.expire_all()  # Expire cached objects to force reload
    
    return refresh_after_api_call 