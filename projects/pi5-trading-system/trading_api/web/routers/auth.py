"""
Authentication API Endpoints.

REST API endpoints for user authentication, authorization,
and user management.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..models import (
    BaseResponse,
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    UserInfo,
    ChangePasswordRequest
)
from ..auth import AuthManager, User


logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

router = APIRouter()


@router.post("/login", response_model=LoginResponse, summary="User Login")
async def login(
    request: LoginRequest,
    auth_manager: AuthManager = Depends(lambda: None)
):
    """
    Authenticate user and return JWT tokens.
    
    Returns access token, refresh token, and user information
    for valid username/password combinations.
    """
    try:
        # Mock auth manager if not available
        if not auth_manager:
            # Create mock auth manager for demo
            from ..config import WebConfig
            from ..auth import AuthManager
            auth_manager = AuthManager(WebConfig())
        
        login_response = await auth_manager.login(request.username, request.password)
        
        if not login_response:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        logger.info(f"User logged in: {request.username}")
        return login_response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service unavailable"
        )


@router.post("/refresh", response_model=LoginResponse, summary="Refresh Access Token")
async def refresh_token(
    request: RefreshTokenRequest,
    auth_manager: AuthManager = Depends(lambda: None)
):
    """
    Refresh access token using refresh token.
    
    Returns new access token and refresh token pair
    for valid refresh tokens.
    """
    try:
        if not auth_manager:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service unavailable"
            )
        
        token_response = await auth_manager.refresh_access_token(request.refresh_token)
        
        if not token_response:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return token_response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )


@router.post("/logout", response_model=BaseResponse, summary="User Logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_manager: AuthManager = Depends(lambda: None)
):
    """
    Logout user and invalidate access token.
    
    Blacklists the current access token to prevent further use.
    """
    try:
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Access token required for logout"
            )
        
        if not auth_manager:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service unavailable"
            )
        
        await auth_manager.logout(credentials.credentials)
        
        return BaseResponse(
            success=True,
            message="Logged out successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Logout error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )


@router.get("/me", response_model=UserInfo, summary="Get Current User")
async def get_current_user_info(
    current_user: User = Depends(lambda: None)
):
    """
    Get information about the currently authenticated user.
    
    Returns user profile information including role and permissions.
    """
    try:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        return current_user.to_user_info()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user info error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user information"
        )


@router.put("/change-password", response_model=BaseResponse, summary="Change Password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(lambda: None),
    auth_manager: AuthManager = Depends(lambda: None)
):
    """
    Change user password.
    
    Requires current password for verification and updates
    to the new password.
    """
    try:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        if not auth_manager:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service unavailable"
            )
        
        success = auth_manager.update_user_password(
            username=current_user.username,
            old_password=request.current_password,
            new_password=request.new_password
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        logger.info(f"Password changed for user: {current_user.username}")
        
        return BaseResponse(
            success=True,
            message="Password changed successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Change password error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password"
        )