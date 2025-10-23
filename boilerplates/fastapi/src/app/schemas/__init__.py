"""Pydantic schemas for request/response validation."""

from app.schemas.auth import LoginRequest, RefreshTokenRequest, Token, TokenPayload
from app.schemas.common import (
    BaseSchema,
    ErrorResponse,
    MessageResponse,
    PaginatedResponse,
    PaginationParams,
    UUIDSchema,
)
from app.schemas.user import UserCreate, UserInDB, UserResponse, UserUpdate

__all__ = [
    # Common
    "BaseSchema",
    "ErrorResponse",
    "MessageResponse",
    "PaginatedResponse",
    "PaginationParams",
    "UUIDSchema",
    # Auth
    "Token",
    "TokenPayload",
    "LoginRequest",
    "RefreshTokenRequest",
    # User
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserInDB",
]
