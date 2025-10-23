"""
User service for business logic related to users.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, NotFoundException
from app.core.security import get_password_hash, verify_password
from app.db.models import User
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    """Service for user-related operations."""

    @staticmethod
    async def get_by_id(session: AsyncSession, user_id: UUID) -> User:
        """
        Get user by ID.

        Args:
            session: Database session
            user_id: User ID

        Returns:
            User object

        Raises:
            NotFoundException: If user not found
        """
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundException(f"User with id {user_id} not found")
        return user

    @staticmethod
    async def get_by_email(session: AsyncSession, email: str) -> User | None:
        """
        Get user by email.

        Args:
            session: Database session
            email: User email

        Returns:
            User object or None if not found
        """
        result = await session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_username(session: AsyncSession, username: str) -> User | None:
        """
        Get user by username.

        Args:
            session: Database session
            username: Username

        Returns:
            User object or None if not found
        """
        result = await session.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    @staticmethod
    async def create(session: AsyncSession, user_data: UserCreate) -> User:
        """
        Create a new user.

        Args:
            session: Database session
            user_data: User creation data

        Returns:
            Created user object

        Raises:
            ConflictException: If email or username already exists
        """
        # Check if email exists
        existing_user = await UserService.get_by_email(session, user_data.email)
        if existing_user:
            raise ConflictException(f"User with email {user_data.email} already exists")

        # Check if username exists
        existing_user = await UserService.get_by_username(session, user_data.username)
        if existing_user:
            raise ConflictException(f"User with username {user_data.username} already exists")

        # Create user
        user = User(
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            hashed_password=get_password_hash(user_data.password),
        )
        session.add(user)
        await session.flush()
        await session.refresh(user)
        return user

    @staticmethod
    async def update(session: AsyncSession, user_id: UUID, user_data: UserUpdate) -> User:
        """
        Update user information.

        Args:
            session: Database session
            user_id: User ID
            user_data: User update data

        Returns:
            Updated user object

        Raises:
            NotFoundException: If user not found
            ConflictException: If email or username already exists
        """
        user = await UserService.get_by_id(session, user_id)

        # Check email conflict
        if user_data.email and user_data.email != user.email:
            existing = await UserService.get_by_email(session, user_data.email)
            if existing:
                raise ConflictException(f"User with email {user_data.email} already exists")
            user.email = user_data.email

        # Check username conflict
        if user_data.username and user_data.username != user.username:
            existing = await UserService.get_by_username(session, user_data.username)
            if existing:
                raise ConflictException(
                    f"User with username {user_data.username} already exists"
                )
            user.username = user_data.username

        # Update other fields
        if user_data.full_name is not None:
            user.full_name = user_data.full_name

        if user_data.password:
            user.hashed_password = get_password_hash(user_data.password)

        await session.flush()
        await session.refresh(user)
        return user

    @staticmethod
    async def delete(session: AsyncSession, user_id: UUID) -> None:
        """
        Delete a user.

        Args:
            session: Database session
            user_id: User ID

        Raises:
            NotFoundException: If user not found
        """
        user = await UserService.get_by_id(session, user_id)
        await session.delete(user)
        await session.flush()

    @staticmethod
    async def authenticate(session: AsyncSession, email: str, password: str) -> User | None:
        """
        Authenticate user with email and password.

        Args:
            session: Database session
            email: User email
            password: Plain text password

        Returns:
            User object if authentication successful, None otherwise
        """
        user = await UserService.get_by_email(session, email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        if not user.is_active:
            return None
        return user

    @staticmethod
    async def list_users(
        session: AsyncSession,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[User], int]:
        """
        List users with pagination.

        Args:
            session: Database session
            offset: Offset for pagination
            limit: Limit for pagination

        Returns:
            Tuple of (list of users, total count)
        """
        # Get total count
        count_result = await session.execute(select(func.count()).select_from(User))
        total = count_result.scalar_one()

        # Get users
        result = await session.execute(select(User).offset(offset).limit(limit))
        users = list(result.scalars().all())

        return users, total


# Import func for count
from sqlalchemy import func  # noqa: E402
