"""
FastAPI Application for Pi5 Trading System Dashboard.

This module provides the main FastAPI application with comprehensive REST API endpoints
for monitoring and controlling the Pi5 Trading System. Includes real-time WebSocket
connections, authentication, and full system integration.

Features:
- Strategy management and monitoring
- Portfolio and position tracking
- Order management and history
- System health and performance monitoring
- Real-time WebSocket updates
- Comprehensive authentication and authorization
- Rate limiting and security measures
- Auto-generated OpenAPI documentation
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, Any
import uvicorn

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
import uvloop

from api.routers import (
    strategies_router,
    portfolio_router, 
    orders_router,
    system_router,
    websocket_router
)
from api.middleware import (
    RateLimitMiddleware,
    LoggingMiddleware,
    ErrorHandlingMiddleware
)
from api.auth import AuthManager
from api.config import APIConfig
from core.exceptions import TradingSystemError


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global application state
app_state: Dict[str, Any] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown."""
    # Startup
    logger.info("Starting Pi5 Trading System Dashboard API...")
    
    try:
        # Initialize application configuration
        config = APIConfig()
        app_state['config'] = config
        
        # Initialize authentication manager
        auth_manager = AuthManager(config)
        app_state['auth_manager'] = auth_manager
        
        # Initialize database connections
        from database.connection_manager import DatabaseManager
        db_manager = DatabaseManager(
            database_url=config.database_url,
            pool_size=config.db_pool_size
        )
        await db_manager.initialize()
        app_state['db_manager'] = db_manager
        
        # Initialize trading system connections
        from events.event_bus import EventBus
        event_bus = EventBus()
        app_state['event_bus'] = event_bus
        
        # Initialize WebSocket manager
        from api.websocket_manager import WebSocketManager
        websocket_manager = WebSocketManager(event_bus)
        await websocket_manager.start()
        app_state['websocket_manager'] = websocket_manager
        
        logger.info("Dashboard API started successfully")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to start dashboard API: {e}")
        raise
    
    # Shutdown
    logger.info("Shutting down Pi5 Trading System Dashboard API...")
    
    try:
        # Clean shutdown of WebSocket manager
        if 'websocket_manager' in app_state:
            await app_state['websocket_manager'].stop()
        
        # Close database connections
        if 'db_manager' in app_state:
            await app_state['db_manager'].close()
        
        logger.info("Dashboard API shutdown complete")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


# Create FastAPI application
app = FastAPI(
    title="Pi5 Trading System API",
    description="""
    Comprehensive REST API for the Pi5 Trading System providing real-time monitoring,
    control, and analytics for algorithmic trading operations.
    
    ## Features
    
    * **Strategy Management** - Start, stop, and configure trading strategies
    * **Portfolio Monitoring** - Real-time portfolio and position tracking
    * **Order Management** - View and manage trading orders and history
    * **System Health** - Monitor system performance and health metrics
    * **Real-time Updates** - WebSocket connections for live data streaming
    * **Security** - JWT authentication with role-based access control
    * **Rate Limiting** - Request throttling and abuse prevention
    
    ## Authentication
    
    Most endpoints require authentication via JWT token in the Authorization header:
    ```
    Authorization: Bearer <jwt_token>
    ```
    
    Use the `/auth/login` endpoint to obtain a token.
    """,
    version="1.0.0",
    contact={
        "name": "Pi5 Trading System",
        "email": "support@pi5trading.com",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Security scheme
security = HTTPBearer()


# Middleware setup
def setup_middleware(app: FastAPI) -> None:
    """Set up application middleware."""
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Trusted host middleware
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"]  # Configure appropriately for production
    )
    
    # Custom middleware
    app.add_middleware(ErrorHandlingMiddleware)
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(RateLimitMiddleware)


# Authentication dependency
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated user."""
    try:
        auth_manager = app_state.get('auth_manager')
        if not auth_manager:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service unavailable"
            )
        
        user = await auth_manager.verify_token(credentials.credentials)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        
        return user
        
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )


# Global exception handler
@app.exception_handler(TradingSystemError)
async def trading_system_error_handler(request, exc: TradingSystemError):
    """Handle trading system specific errors."""
    return JSONResponse(
        status_code=400,
        content={
            "error": "TradingSystemError",
            "detail": str(exc),
            "timestamp": datetime.utcnow().isoformat()
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalServerError",
            "detail": "An internal server error occurred",
            "timestamp": datetime.utcnow().isoformat()
        }
    )


# Health check endpoint (no auth required)
@app.get("/health", tags=["System"], summary="System Health Check")
async def health_check():
    """
    Check system health and return status information.
    
    Returns basic health information including:
    - API status
    - Database connectivity
    - System uptime
    - Memory usage
    """
    try:
        # Check database connection
        db_healthy = False
        if 'db_manager' in app_state:
            db_manager = app_state['db_manager']
            db_healthy = await db_manager.health_check()
        
        # Get basic system info
        import psutil
        memory_info = psutil.virtual_memory()
        
        health_data = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0",
            "database": {
                "connected": db_healthy,
                "status": "healthy" if db_healthy else "unhealthy"
            },
            "system": {
                "memory_usage_percent": memory_info.percent,
                "memory_available_mb": round(memory_info.available / (1024 * 1024), 2),
                "uptime_seconds": (datetime.utcnow() - datetime.utcnow()).total_seconds()
            }
        }
        
        return health_data
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e)
            }
        )


# API Info endpoint (no auth required)
@app.get("/", tags=["System"], summary="API Information")
async def root():
    """Get basic API information and available endpoints."""
    return {
        "name": "Pi5 Trading System API",
        "version": "1.0.0",
        "description": "Comprehensive REST API for algorithmic trading operations",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "health_url": "/health",
        "timestamp": datetime.utcnow().isoformat()
    }


# Setup middleware
setup_middleware(app)

# Include API routers
app.include_router(
    strategies_router,
    prefix="/api/v1/strategies",
    tags=["Strategies"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    portfolio_router,
    prefix="/api/v1/portfolio",
    tags=["Portfolio"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    orders_router,
    prefix="/api/v1/orders",
    tags=["Orders"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    system_router,
    prefix="/api/v1/system",
    tags=["System"],
    dependencies=[Depends(get_current_user)]
)

app.include_router(
    websocket_router,
    prefix="/ws",
    tags=["WebSocket"]
)

# Authentication router (no auth required for login)
from api.routers.auth import auth_router
app.include_router(
    auth_router,
    prefix="/auth",
    tags=["Authentication"]
)


def main():
    """Main application entry point."""
    # Use uvloop for better performance
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
    
    # Run with uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Set to True for development
        loop="uvloop",
        log_level="info",
        access_log=True
    )


if __name__ == "__main__":
    main()