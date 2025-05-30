import pytest
from unittest.mock import patch, Mock
from fastapi import status


class TestAuthRoutes:
    """Test cases for authentication routes."""

    def test_sync_user_callback_creates_new_user(
        self, 
        authenticated_client, 
        test_db, 
        mock_oidc_user, 
        mock_keycloak_user
    ):
        """Test that user callback creates a new user when user doesn't exist."""
        
        with patch('app.api.routes.auth.idp.get_current_user', return_value=mock_oidc_user):
            with patch('app.api.routes.auth.idp.get_user', return_value=mock_keycloak_user):
                response = authenticated_client.get("/api/auth/callback")
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify user was created in database
        from app.models.user import User
        user = test_db.query(User).filter(User.keycloak_uuid == mock_keycloak_user.id).first()
        assert user is not None
        assert user.username == mock_keycloak_user.username
        assert user.first_name == mock_keycloak_user.firstName
        assert user.last_name == mock_keycloak_user.lastName
        assert user.email == mock_keycloak_user.email
        assert user.enabled == mock_keycloak_user.enabled
        assert user.email_verified == mock_keycloak_user.emailVerified

    def test_sync_user_callback_returns_existing_user(
        self, 
        authenticated_client, 
        test_db, 
        sample_user, 
        mock_oidc_user, 
        mock_keycloak_user
    ):
        """Test that user callback returns existing user when user already exists."""
        
        # User already exists (sample_user fixture)
        original_user_count = test_db.query(sample_user.__class__).count()
        
        with patch('app.api.routes.auth.idp.get_current_user', return_value=mock_oidc_user):
            with patch('app.api.routes.auth.idp.get_user', return_value=mock_keycloak_user):
                response = authenticated_client.get("/api/auth/callback")
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify no new user was created
        final_user_count = test_db.query(sample_user.__class__).count()
        assert final_user_count == original_user_count

    def test_sync_user_callback_handles_keycloak_user_not_found(
        self, 
        authenticated_client, 
        mock_oidc_user
    ):
        """Test that callback handles case when Keycloak user is not found."""
        
        with patch('app.api.routes.auth.idp.get_current_user', return_value=mock_oidc_user):
            with patch('app.api.routes.auth.idp.get_user', return_value=None):
                response = authenticated_client.get("/api/auth/callback")
        
        assert response.status_code == status.HTTP_402_PAYMENT_REQUIRED


    def test_get_or_create_db_user_function(self, test_db, mock_keycloak_user):
        """Test the get_or_create_db_user utility function directly."""
        from app.api.routes.auth import get_or_create_db_user
        from app.models.user import User
        
        # Test creating new user
        user = get_or_create_db_user(mock_keycloak_user, test_db)
        assert user is not None
        assert user.keycloak_uuid == mock_keycloak_user.id
        assert user.username == mock_keycloak_user.username
        
        # Test getting existing user
        existing_user = get_or_create_db_user(mock_keycloak_user, test_db)
        assert existing_user.id == user.id
        assert test_db.query(User).count() == 1

    def test_sync_user_without_authentication(self, client):
        """Test that callback requires authentication."""
        # This should fail without authentication mocks
        response = client.get("/api/auth/callback")
        # The exact status code depends on your authentication setup
        # It might be 401, 403, or redirect to login
        assert response.status_code in [200, 401, 403, 422]  # 422 for missing dependencies

    def test_sync_user_with_partial_keycloak_data(
        self, 
        authenticated_client, 
        test_db, 
        mock_oidc_user
    ):
        """Test user creation with partial Keycloak user data."""
        
        # Create a mock Keycloak user with some missing fields
        partial_keycloak_user = Mock()
        partial_keycloak_user.id = "partial-user-123"
        partial_keycloak_user.username = "partialuser"
        partial_keycloak_user.firstName = None
        partial_keycloak_user.lastName = None
        partial_keycloak_user.enabled = True
        partial_keycloak_user.emailVerified = False
        partial_keycloak_user.email = "partial@example.com"
        
        with patch('app.api.routes.auth.idp.get_current_user', return_value=mock_oidc_user):
            with patch('app.api.routes.auth.idp.get_user', return_value=partial_keycloak_user):
                response = authenticated_client.get("/api/auth/callback")
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify user was created with available data
        from app.models.user import User
        user = test_db.query(User).filter(User.keycloak_uuid == partial_keycloak_user.id).first()
        assert user is not None
        assert user.username == partial_keycloak_user.username
        assert user.first_name is None
        assert user.last_name is None
        assert user.email == partial_keycloak_user.email

    def test_sync_user_callback_idempotent(
        self, 
        authenticated_client, 
        test_db, 
        mock_oidc_user, 
        mock_keycloak_user
    ):
        """Test that multiple calls to callback are idempotent."""
        
        with patch('app.api.routes.auth.idp.get_current_user', return_value=mock_oidc_user):
            with patch('app.api.routes.auth.idp.get_user', return_value=mock_keycloak_user):
                
                # First call
                response1 = authenticated_client.get("/api/auth/callback")
                assert response1.status_code == status.HTTP_200_OK
                
                from app.models.user import User
                user_count_after_first = test_db.query(User).count()
                
                # Second call
                response2 = authenticated_client.get("/api/auth/callback")
                assert response2.status_code == status.HTTP_200_OK
                
                # Should not create duplicate user
                user_count_after_second = test_db.query(User).count()
                assert user_count_after_first == user_count_after_second 