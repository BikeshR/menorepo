"""
User schemas for request/response validation.
"""

from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field

from app.schemas.common import BaseSchema


class UserBase(BaseSchema):
    """Base user schema with common fields."""

    email: EmailStr = Field(..., description="User email address")
    username: str = Field(..., min_length=3, max_length=50, description="Username")
    full_name: str | None = Field(None, max_length=255, description="Full name")


class UserCreate(UserBase):
    """Schema for creating a new user."""

    password: str = Field(..., min_length=8, description="User password")


class UserUpdate(BaseSchema):
    """Schema for updating user information."""

    email: EmailStr | None = Field(None, description="User email address")
    username: str | None = Field(None, min_length=3, max_length=50, description="Username")
    full_name: str | None = Field(None, max_length=255, description="Full name")
    password: str | None = Field(None, min_length=8, description="New password")


class UserResponse(UserBase):
    """Schema for user response."""

    id: UUID = Field(..., description="User ID")
    is_active: bool = Field(..., description="Whether user is active")
    is_superuser: bool = Field(..., description="Whether user is a superuser")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class UserInDB(UserResponse):
    """Schema for user in database (includes hashed password)."""

    hashed_password: str = Field(..., description="Hashed password")
