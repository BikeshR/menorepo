"""
User management endpoints.
"""

from uuid import UUID

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentSuperuser, CurrentUser, SessionDep
from app.schemas.common import MessageResponse, PaginatedResponse, PaginationParams
from app.schemas.user import UserResponse, UserUpdate
from app.services.user_service import UserService

router = APIRouter()


@router.get(
    "/me",
    response_model=UserResponse,
    tags=["Users"],
    summary="Get current user",
    description="Get the currently authenticated user's information",
)
async def get_current_user_info(
    current_user: CurrentUser,
) -> UserResponse:
    """Get current user's information."""
    return UserResponse.model_validate(current_user)


@router.patch(
    "/me",
    response_model=UserResponse,
    tags=["Users"],
    summary="Update current user",
    description="Update the currently authenticated user's information",
)
async def update_current_user_info(
    session: SessionDep,
    current_user: CurrentUser,
    user_data: UserUpdate,
) -> UserResponse:
    """Update current user's information."""
    user = await UserService.update(session, current_user.id, user_data)
    return UserResponse.model_validate(user)


@router.get(
    "/",
    response_model=PaginatedResponse[UserResponse],
    tags=["Users"],
    summary="List users",
    description="List all users (superuser only)",
)
async def list_users(
    session: SessionDep,
    current_superuser: CurrentSuperuser,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
) -> PaginatedResponse[UserResponse]:
    """List all users with pagination (superuser only)."""
    pagination = PaginationParams(page=page, page_size=page_size)
    users, total = await UserService.list_users(
        session,
        offset=pagination.offset,
        limit=pagination.limit,
    )

    return PaginatedResponse.create(
        items=[UserResponse.model_validate(user) for user in users],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    tags=["Users"],
    summary="Get user by ID",
    description="Get a specific user by ID (superuser only)",
)
async def get_user(
    session: SessionDep,
    current_superuser: CurrentSuperuser,
    user_id: UUID,
) -> UserResponse:
    """Get user by ID (superuser only)."""
    user = await UserService.get_by_id(session, user_id)
    return UserResponse.model_validate(user)


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    tags=["Users"],
    summary="Update user",
    description="Update a specific user (superuser only)",
)
async def update_user(
    session: SessionDep,
    current_superuser: CurrentSuperuser,
    user_id: UUID,
    user_data: UserUpdate,
) -> UserResponse:
    """Update user (superuser only)."""
    user = await UserService.update(session, user_id, user_data)
    return UserResponse.model_validate(user)


@router.delete(
    "/{user_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    tags=["Users"],
    summary="Delete user",
    description="Delete a specific user (superuser only)",
)
async def delete_user(
    session: SessionDep,
    current_superuser: CurrentSuperuser,
    user_id: UUID,
) -> MessageResponse:
    """Delete user (superuser only)."""
    await UserService.delete(session, user_id)
    return MessageResponse(message="User deleted successfully")
