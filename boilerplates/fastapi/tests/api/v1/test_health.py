"""
Tests for health check endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient


@pytest.mark.unit
def test_health_check(client: TestClient) -> None:
    """Test basic health check endpoint."""
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert "version" in data
    assert "environment" in data


@pytest.mark.unit
@pytest.mark.asyncio
async def test_health_check_async(async_client: AsyncClient) -> None:
    """Test basic health check endpoint with async client."""
    response = await async_client.get("/api/v1/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert "version" in data
    assert "environment" in data


@pytest.mark.integration
def test_detailed_health_check(client: TestClient) -> None:
    """Test detailed health check endpoint."""
    response = client.get("/api/v1/health/detailed")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "database" in data
    assert data["database"] in ["healthy", "unhealthy"]
    assert "timestamp" in data
    assert "version" in data


@pytest.mark.integration
@pytest.mark.asyncio
async def test_detailed_health_check_async(async_client: AsyncClient) -> None:
    """Test detailed health check endpoint with async client."""
    response = await async_client.get("/api/v1/health/detailed")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "database" in data
    assert data["database"] in ["healthy", "unhealthy"]
