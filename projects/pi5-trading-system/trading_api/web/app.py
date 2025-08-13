"""
FastAPI Web Application for Pi5 Trading System.

Integrated web interface providing REST API endpoints and WebSocket connections
for monitoring and controlling the Pi5 Trading System. Directly integrated with
the trading system components for maximum efficiency.
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, Any, Optional
import uvicorn

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvloop

# Import trading system components
from database.connection_manager import DatabaseManager
from database.repositories.market_data import MarketDataRepository
from events.event_bus import EventBus
from strategies.manager import StrategyManager
from portfolio.manager import PortfolioManager
from orders.enhanced_order_manager import EnhancedOrderManager
from orders.brokers.broker_manager import BrokerManager
from risk.manager import RiskManagerImplementation
from core.interfaces import RiskLimits

# Import web components
from .routers import (
    strategies_router,
    portfolio_router,
    orders_router,
    system_router,
    websocket_router,
    auth_router
)
from .middleware import (
    RateLimitMiddleware,
    LoggingMiddleware,
    ErrorHandlingMiddleware
)
from .auth import AuthManager
from .config import WebConfig
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
    logger.info("Starting Pi5 Trading System Web Interface...")
    
    try:
        # Initialize configuration
        config = WebConfig()
        app_state['config'] = config
        
        # Initialize database manager with retry logic for startup
        db_manager = DatabaseManager(
            database_url=config.database_url,
            max_connections=config.db_pool_size,
            retry_attempts=5,
            retry_delay=2.0
        )
        await db_manager.initialize()
        app_state['db_manager'] = db_manager
        
        # Initialize event bus
        event_bus = EventBus()
        await event_bus.start()
        app_state['event_bus'] = event_bus
        
        # Initialize risk manager
        risk_limits = RiskLimits(
            max_position_size=0.1,
            max_portfolio_exposure=0.8,
            max_daily_loss=0.05
        )
        risk_manager = RiskManagerImplementation(
            risk_limits=risk_limits,
            db_manager=db_manager,
            event_bus=event_bus
        )
        app_state['risk_manager'] = risk_manager
        
        # Initialize broker manager
        broker_manager = BrokerManager(event_bus=event_bus)
        # Add paper trading broker by default
        from orders.brokers.paper_broker import PaperTradingBroker
        from orders.brokers.broker_manager import BrokerConfig, BrokerType
        
        paper_config = BrokerConfig(
            broker_type=BrokerType.PAPER,
            config={
                'initial_cash': 100000,
                'commission_per_trade': 1.0,
                'max_slippage_bps': 5
            }
        )
        broker_manager.add_broker("paper", paper_config, market_data_repo=None)
        await broker_manager.start()
        app_state['broker_manager'] = broker_manager
        
        # Initialize enhanced order manager
        enhanced_order_manager = EnhancedOrderManager(
            event_bus=event_bus,
            db_manager=db_manager,
            risk_manager=risk_manager,
            broker_manager=broker_manager
        )
        await enhanced_order_manager.start()
        app_state['enhanced_order_manager'] = enhanced_order_manager
        
        # Initialize portfolio manager
        market_data_repo = MarketDataRepository(db_manager)
        portfolio_manager = PortfolioManager(
            event_bus=event_bus,
            db_manager=db_manager,
            market_data_repo=market_data_repo,
            initial_cash=100000.0
        )
        await portfolio_manager.start()
        app_state['portfolio_manager'] = portfolio_manager
        
        # Initialize strategy manager
        strategy_manager = StrategyManager(
            event_bus=event_bus,
            db_manager=db_manager
        )
        await strategy_manager.start()
        app_state['strategy_manager'] = strategy_manager
        
        # Initialize authentication manager
        auth_manager = AuthManager(config)
        app_state['auth_manager'] = auth_manager
        
        # Initialize WebSocket manager
        from .websocket_manager import WebSocketManager
        websocket_manager = WebSocketManager(event_bus)
        await websocket_manager.start()
        app_state['websocket_manager'] = websocket_manager
        
        logger.info("Pi5 Trading System Web Interface started successfully")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to start web interface: {e}")
        raise
    
    # Shutdown
    logger.info("Shutting down Pi5 Trading System Web Interface...")
    
    try:
        # Stop all managers in reverse order
        if 'websocket_manager' in app_state:
            await app_state['websocket_manager'].stop()
        
        if 'strategy_manager' in app_state:
            await app_state['strategy_manager'].stop()
        
        if 'portfolio_manager' in app_state:
            await app_state['portfolio_manager'].stop()
        
        if 'enhanced_order_manager' in app_state:
            await app_state['enhanced_order_manager'].stop()
        
        if 'broker_manager' in app_state:
            await app_state['broker_manager'].stop()
        
        if 'event_bus' in app_state:
            await app_state['event_bus'].stop()
        
        if 'db_manager' in app_state:
            await app_state['db_manager'].close()
        
        logger.info("Web interface shutdown complete")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


# Create FastAPI application
app = FastAPI(
    title="Pi5 Trading System",
    description="""
    ## Professional Algorithmic Trading Platform
    
    The Pi5 Trading System provides a comprehensive web interface for monitoring
    and controlling your algorithmic trading operations.
    
    ### Features
    
    * **🚀 Real-time Trading** - Execute multiple strategies simultaneously
    * **📊 Portfolio Management** - Track positions and performance in real-time  
    * **⚡ Risk Management** - Sophisticated risk controls and position sizing
    * **📈 Strategy Analytics** - Performance metrics and correlation analysis
    * **🔄 Multi-Broker Support** - Paper trading and live broker integration
    * **🌐 WebSocket Streaming** - Real-time data updates via WebSocket
    * **🔐 Secure Authentication** - JWT-based authentication with role-based access
    * **📱 Mobile Responsive** - Full functionality on desktop and mobile
    
    ### Quick Start
    
    1. **Login** using `/auth/login` with your credentials
    2. **View Portfolio** at `/api/v1/portfolio/summary`  
    3. **Monitor Strategies** at `/api/v1/strategies/active`
    4. **Real-time Updates** via WebSocket at `/ws`
    
    ### Authentication
    
    Most endpoints require JWT authentication. Include your token in the Authorization header:
    ```
    Authorization: Bearer <your_jwt_token>
    ```
    
    Default login credentials:
    - **Admin**: username=`admin`, password=`admin123`
    - **Trader**: username=`trader`, password=`trader123`  
    - **Viewer**: username=`viewer`, password=`viewer123`
    
    ### WebSocket Events
    
    Connect to `/ws` for real-time updates:
    - Portfolio changes
    - Order executions
    - Strategy signals
    - System health updates
    """,
    version="1.0.0",
    contact={
        "name": "Pi5 Trading System",
        "url": "https://github.com/pi5trading/pi5-trading-system",
        "email": "support@pi5trading.com",
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Security scheme
security = HTTPBearer()


def setup_middleware(app: FastAPI) -> None:
    """Set up application middleware."""
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Trusted host middleware
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"]  # Configure for production
    )
    
    # Custom middleware
    app.add_middleware(ErrorHandlingMiddleware)
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(RateLimitMiddleware)


# Dependencies
def get_db_manager() -> DatabaseManager:
    """Get database manager dependency."""
    return app_state.get('db_manager')


def get_event_bus() -> EventBus:
    """Get event bus dependency."""
    return app_state.get('event_bus')


def get_strategy_manager() -> StrategyManager:
    """Get strategy manager dependency."""
    return app_state.get('strategy_manager')


def get_portfolio_manager() -> PortfolioManager:
    """Get portfolio manager dependency."""
    return app_state.get('portfolio_manager')


def get_order_manager() -> EnhancedOrderManager:
    """Get enhanced order manager dependency."""
    return app_state.get('enhanced_order_manager')


def get_broker_manager() -> BrokerManager:
    """Get broker manager dependency."""
    return app_state.get('broker_manager')


def get_websocket_manager():
    """Get WebSocket manager dependency."""
    return app_state.get('websocket_manager')


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
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )


# Optional authentication dependency (for public endpoints)
async def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))):
    """Get current user if authenticated, None otherwise."""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


# Global exception handlers
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
    System health check endpoint.
    
    Returns comprehensive health information including:
    - API status and version
    - Database connectivity
    - Trading system component status
    - System resource usage
    - Active connections
    """
    try:
        health_data = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0",
            "components": {}
        }
        
        # Check database
        db_manager = get_db_manager()
        if db_manager:
            db_healthy = await db_manager.health_check()
            health_data["components"]["database"] = {
                "status": "healthy" if db_healthy else "unhealthy",
                "connected": db_healthy
            }
        
        # Check strategy manager
        strategy_manager = get_strategy_manager()
        if strategy_manager:
            strategy_status = strategy_manager.get_manager_status()
            health_data["components"]["strategies"] = {
                "status": "healthy",
                "active_strategies": strategy_status.get("active_strategies", 0),
                "total_strategies": strategy_status.get("total_strategies", 0)
            }
        
        # Check portfolio manager
        portfolio_manager = get_portfolio_manager()
        if portfolio_manager:
            health_data["components"]["portfolio"] = {
                "status": "healthy",
                "tracked_symbols": len(portfolio_manager.get_all_positions())
            }
        
        # Check order manager
        order_manager = get_order_manager()
        if order_manager:
            order_stats = order_manager.get_execution_analytics()
            health_data["components"]["orders"] = {
                "status": "healthy",
                "total_orders": order_stats.get("total_orders", 0),
                "pending_orders": order_stats.get("pending_orders", 0)
            }
        
        # Get system metrics
        try:
            import psutil
            memory_info = psutil.virtual_memory()
            cpu_percent = psutil.cpu_percent(interval=1)
            
            health_data["system"] = {
                "memory_usage_percent": memory_info.percent,
                "memory_available_mb": round(memory_info.available / (1024 * 1024), 2),
                "cpu_usage_percent": cpu_percent
            }
        except ImportError:
            health_data["system"] = {"status": "metrics_unavailable"}
        
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


# API Info endpoint (moved to /api/info to avoid conflict with dashboard)
@app.get("/api/info", tags=["System"], summary="API Information")
async def api_info():
    """Get basic API information and available endpoints."""
    return {
        "name": "Pi5 Trading System",
        "version": "1.0.0",
        "description": "Professional Algorithmic Trading Platform",
        "docs_url": "/docs",
        "redoc_url": "/redoc", 
        "health_url": "/health",
        "websocket_url": "/ws",
        "timestamp": datetime.utcnow().isoformat(),
        "features": [
            "Real-time Portfolio Management",
            "Multi-Strategy Execution",
            "Advanced Risk Controls",
            "Live Broker Integration",
            "WebSocket Streaming",
            "Comprehensive Analytics"
        ]
    }


# Setup middleware
setup_middleware(app)

# Mount static files (for React frontend)
# Prepare React Dashboard static files
dashboard_build_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "dashboard", "build")
if os.path.exists(dashboard_build_path):
    # Mount static assets (JS, CSS, images, etc.) - these need exact path matches
    static_path = os.path.join(dashboard_build_path, "static")
    if os.path.exists(static_path):
        app.mount("/static", StaticFiles(directory=static_path), name="static")
        logger.info(f"React static assets mounted from {static_path}")
    else:
        logger.warning(f"Static directory not found at {static_path}")
    
    # Also mount favicon.ico and manifest.json from build root
    favicon_path = os.path.join(dashboard_build_path, "favicon.ico")
    manifest_path = os.path.join(dashboard_build_path, "manifest.json")
    
    if os.path.exists(favicon_path):
        @app.get("/favicon.ico")
        async def favicon():
            return FileResponse(favicon_path)
    
    if os.path.exists(manifest_path):
        @app.get("/manifest.json")
        async def manifest():
            return FileResponse(manifest_path)
            
    logger.info(f"Dashboard build directory found at {dashboard_build_path}")
else:
    logger.warning("Dashboard build directory not found - dashboard will not be available")

# Include routers with dependencies
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

# WebSocket router (auth handled per connection)
app.include_router(
    websocket_router,
    prefix="/ws",
    tags=["WebSocket"]
)

# Authentication router (no auth required for login)
app.include_router(
    auth_router,
    prefix="/auth",
    tags=["Authentication"]
)

# Add root route for dashboard and SPA fallback
if os.path.exists(dashboard_build_path):
    from fastapi.responses import FileResponse
    
    @app.get("/", response_class=FileResponse)
    async def serve_dashboard():
        """Serve React dashboard at root path."""
        index_path = os.path.join(dashboard_build_path, "index.html")
        return FileResponse(index_path, media_type="text/html")
    
    @app.get("/{full_path:path}")
    async def serve_spa_fallback(full_path: str):
        """
        SPA fallback for client-side routing - serves index.html for dashboard routes only.
        """
        # Only serve SPA for dashboard routes, reject API routes
        api_prefixes = ("api/", "docs", "redoc", "health", "ws/", "auth/", "static/")
        
        if full_path.startswith(api_prefixes):
            # This is an API route that doesn't exist - return 404
            raise HTTPException(status_code=404, detail="API endpoint not found")
        
        # This looks like a dashboard route (e.g., /portfolio, /orders)
        # Serve index.html and let React Router handle it
        index_path = os.path.join(dashboard_build_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path, media_type="text/html")
        else:
            raise HTTPException(status_code=404, detail="Dashboard not found")
    
    logger.info("React SPA configured - dashboard at / with client-side routing support")


def create_app() -> FastAPI:
    """
    Application factory function that creates and configures the FastAPI application.
    
    This follows the Application Factory pattern for better modularity and testing.
    
    Returns:
        FastAPI: Configured application instance
    """
    return app


def main():
    """Entry point for standalone execution (development only)."""
    import uvicorn
    
    logger.info("🚀 Starting Pi5 Trading System Web Application (Development Mode)")
    
    # Use uvloop for better performance
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
    
    # Run with uvicorn
    uvicorn.run(
        "trading_api.web.app:app",
        host="0.0.0.0",
        port=8080,
        reload=True,  # Development mode
        loop="uvloop",
        log_level="info",
        access_log=True,
        workers=1
    )


if __name__ == "__main__":
    main()