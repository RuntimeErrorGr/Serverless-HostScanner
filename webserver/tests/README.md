# Webserver Test Suite

This directory contains comprehensive tests for all webserver route logic with proper mocking of external dependencies.

## Overview

The test suite covers all API routes in the webserver:

- **Authentication routes** (`test_auth_routes.py`) - User authentication and Keycloak integration
- **Target routes** (`test_target_routes.py`) - CRUD operations for scan targets  
- **Scan routes** (`test_scan_routes.py`) - Scan lifecycle, WebSocket functionality, OpenFaaS integration
- **Finding routes** (`test_finding_routes.py`) - Vulnerability findings management
- **Report routes** (`test_report_routes.py`) - Report generation and file downloads
- **Dashboard routes** (`test_dashboard_routes.py`) - Statistics and data aggregation
- **Admin routes** (`test_admin_routes.py`) - User management and admin functionality

## Key Features

### Comprehensive Mocking
All external dependencies are properly mocked:
- **Keycloak** - Authentication and user management
- **MySQL/MariaDB** - Database connections (using in-memory SQLite for tests)
- **Redis** - Real-time messaging and caching
- **OpenFaaS** - External function calls
- **HTTP clients** - External API calls (IP geolocation, etc.)

### Test Database
- Uses in-memory SQLite database for each test
- Fresh database instance per test function
- All models and relationships properly created

### Authentication Testing
- Mock authenticated and unauthenticated requests
- Role-based access control testing
- User authorization boundary testing

### Error Handling
- Tests for various error conditions
- Network failures and external service outages
- Invalid input validation
- Database constraint violations

## Running Tests

### Install Dependencies
```bash
# Make sure you're in the webserver directory
cd webserver

# Install test dependencies (already in pyproject.toml)
poetry install --with dev
```

### Run All Tests
```bash
# Run all tests with coverage
poetry run pytest

# Run with more verbose output
poetry run pytest -v

# Run without coverage
poetry run pytest --no-cov
```

### Run Specific Test Files
```bash
# Run auth tests only
poetry run pytest tests/test_auth_routes.py

# Run target and scan tests
poetry run pytest tests/test_target_routes.py tests/test_scan_routes.py
```

### Run Specific Test Classes or Methods
```bash
# Run specific test class
poetry run pytest tests/test_auth_routes.py::TestAuthRoutes

# Run specific test method
poetry run pytest tests/test_auth_routes.py::TestAuthRoutes::test_sync_user_callback_creates_new_user
```

### Test Coverage
```bash
# Generate HTML coverage report
poetry run pytest --cov-report=html

# View coverage report
open htmlcov/index.html
```

## Test Structure

### Fixtures (`conftest.py`)
- `test_db` - Fresh database session for each test
- `client` - FastAPI test client
- `authenticated_client` - Pre-authenticated test client
- `sample_user`, `sample_target`, `sample_scan`, etc. - Sample data objects
- `mock_*` fixtures - Mocked external services

### Test Organization
Each test file follows the pattern:
```python
class TestRouteModuleName:
    """Test cases for route module."""
    
    def test_endpoint_success_case(self, fixtures):
        """Test successful operation."""
        # Arrange, Act, Assert
    
    def test_endpoint_error_case(self, fixtures):
        """Test error handling."""
        # Test various error conditions
    
    def test_endpoint_authorization(self, fixtures):
        """Test authorization checks."""
        # Verify proper access control
```

## Mocked Dependencies

### Keycloak
- `idp.get_current_user()` - Returns mock authenticated user
- `idp.get_user()` - Returns mock user details
- `idp.get_user_roles()` - Returns mock user roles
- `idp.update_user()` - Mock user updates

### Database
- Uses SQLite in-memory database
- Fresh instance per test
- All models and relationships available

### Redis
- `redis.Redis` - Mock Redis client
- `redis.asyncio.Redis` - Mock async Redis client
- WebSocket pub/sub functionality mocked

### HTTP Clients
- `httpx.AsyncClient` - Mock async HTTP client
- External API responses (IP geolocation, etc.)

### File System
- `os.path.exists` - Mock file existence checks
- `os.remove` - Mock file deletion
- `FileResponse` - Mock file downloads

## Best Practices

### Test Isolation
- Each test is completely isolated
- No shared state between tests
- Fresh database and mocks per test

### Realistic Data
- Tests use realistic sample data
- Edge cases and boundary conditions tested
- Both success and failure scenarios covered

### Authorization Testing
- Every endpoint tested for authentication requirements
- User isolation verified (users can't access others' data)
- Admin role requirements tested

### Error Handling
- External service failures simulated
- Invalid input data tested
- Database errors handled gracefully

## Adding New Tests

When adding new routes or modifying existing ones:

1. **Update existing test files** if modifying existing routes
2. **Create new test files** for completely new route modules
3. **Add new fixtures** in `conftest.py` if needed
4. **Mock new external dependencies** as required
5. **Test both success and failure scenarios**
6. **Verify authorization and user isolation**

### Example New Test
```python
def test_new_endpoint_success(self, authenticated_client, test_data):
    """Test new endpoint success case."""
    response = authenticated_client.post("/api/new-endpoint", json=test_data.VALID_DATA)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "expected_field" in data

def test_new_endpoint_unauthorized(self, client):
    """Test new endpoint requires authentication."""
    response = client.post("/api/new-endpoint", json={})
    assert response.status_code in [401, 403, 422]
```

## Troubleshooting

### Common Issues

1. **Import Errors**
   - Ensure you're running tests from the webserver directory
   - Check that all dependencies are installed with `poetry install --with dev`

2. **Database Errors**
   - Tests use SQLite, ensure your models are compatible
   - Check that foreign key relationships are properly defined

3. **Mock Issues**
   - Verify mock patches target the correct module paths
   - Check that mocked functions return appropriate data types

4. **Async Test Issues**
   - For async tests, use `@pytest.mark.asyncio`
   - Ensure async fixtures are properly configured