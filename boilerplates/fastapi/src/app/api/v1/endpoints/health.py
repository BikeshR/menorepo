"""
Health check endpoints.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, status
from sqlalchemy import text

from app.api.deps import SessionDep
from app.core.config import settings
from app.schemas.common import BaseSchema

router = APIRouter()


class HealthResponse(BaseSchema):
    """Health check response schema."""

    status: str
    timestamp: datetime
    version: str
    environment: str


class DetailedHealthResponse(HealthResponse):
    """Detailed health check response with database status."""

    database: str


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    tags=["Health"],
    summary="Basic health check",
    description="Returns basic health status of the API",
)
async def health_check() -> HealthResponse:
    """Basic health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(timezone.utc),
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
    )


@router.get(
    "/health/detailed",
    response_model=DetailedHealthResponse,
    status_code=status.HTTP_200_OK,
    tags=["Health"],
    summary="Detailed health check",
    description="Returns detailed health status including database connectivity",
)
async def detailed_health_check(session: SessionDep) -> DetailedHealthResponse:
    """Detailed health check endpoint with database status."""
    # Check database connectivity
    try:
        await session.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception:
        db_status = "unhealthy"

    return DetailedHealthResponse(
        status="healthy" if db_status == "healthy" else "degraded",
        timestamp=datetime.now(timezone.utc),
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        database=db_status,
    )
