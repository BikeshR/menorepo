"""
API v1 router combining all endpoint routers.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, health, users

# Create v1 API router
api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
