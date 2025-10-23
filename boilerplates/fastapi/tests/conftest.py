"""
Pytest configuration and fixtures.
"""

import asyncio
from collections.abc import AsyncGenerator, Generator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.base import Base
from app.db.session import get_session
from app.main import app

# Test database URL (SQLite in memory for testing)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Create test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)

# Create test session factory
TestSessionLocal = sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """
    Create an event loop for the test session.
    """
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Create a test database session.

    Yields:
        AsyncSession: Test database session
    """
    # Create tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session
    async with TestSessionLocal() as session:
        yield session

    # Drop tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
def override_get_session(db_session: AsyncSession) -> Any:
    """
    Override the get_session dependency to use test session.

    Args:
        db_session: Test database session

    Returns:
        Dependency override function
    """

    async def _override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    return _override_get_session


@pytest.fixture
def client(override_get_session: Any) -> Generator[TestClient, None, None]:
    """
    Create a test client with dependency overrides.

    Args:
        override_get_session: Override for database session

    Yields:
        TestClient: Test client
    """
    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
async def async_client(override_get_session: Any) -> AsyncGenerator[AsyncClient, None]:
    """
    Create an async test client with dependency overrides.

    Args:
        override_get_session: Override for database session

    Yields:
        AsyncClient: Async test client
    """
    app.dependency_overrides[get_session] = override_get_session
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as async_test_client:
        yield async_test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user_data() -> dict[str, str]:
    """
    Sample user data for testing.

    Returns:
        dict: User data
    """
    return {
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpassword123",
        "full_name": "Test User",
    }
