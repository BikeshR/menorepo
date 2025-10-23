"""
Authentication endpoints.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import SessionDep
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.schemas.auth import LoginRequest, RefreshTokenRequest, Token
from app.schemas.user import UserCreate, UserResponse
from app.services.user_service import UserService

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Authentication"],
    summary="Register new user",
    description="Create a new user account",
)
async def register(
    session: SessionDep,
    user_data: UserCreate,
) -> UserResponse:
    """Register a new user."""
    user = await UserService.create(session, user_data)
    return UserResponse.model_validate(user)


@router.post(
    "/login",
    response_model=Token,
    tags=["Authentication"],
    summary="Login",
    description="Login with email and password to get access tokens",
)
async def login(
    session: SessionDep,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Token:
    """
    Login endpoint using OAuth2 password flow.
    Username field should contain the email address.
    """
    user = await UserService.authenticate(session, form_data.username, form_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return Token(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post(
    "/login/json",
    response_model=Token,
    tags=["Authentication"],
    summary="Login with JSON",
    description="Login with email and password using JSON body",
)
async def login_json(
    session: SessionDep,
    login_data: LoginRequest,
) -> Token:
    """Login endpoint accepting JSON body."""
    user = await UserService.authenticate(session, login_data.email, login_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    return Token(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post(
    "/refresh",
    response_model=Token,
    tags=["Authentication"],
    summary="Refresh access token",
    description="Get new access token using refresh token",
)
async def refresh_token(
    session: SessionDep,
    refresh_data: RefreshTokenRequest,
) -> Token:
    """Refresh access token using refresh token."""
    try:
        payload = decode_token(refresh_data.refresh_token)
        user_id: str | None = payload.get("sub")
        token_type: str | None = payload.get("type")

        if user_id is None or token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        # Verify user still exists and is active
        user = await UserService.get_by_id(session, user_id)
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user",
            )

        return Token(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
