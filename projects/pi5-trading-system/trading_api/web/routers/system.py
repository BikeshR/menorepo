"""
System Monitoring API Endpoints.

REST API endpoints for system health monitoring,
performance metrics, and configuration management.
"""

import logging
from datetime import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status

from ..models import (
    BaseResponse,
    SystemHealth,
    SystemMetrics,
    LogEntry,
    SystemConfiguration,
    UserRole
)
from ..auth import User


logger = logging.getLogger(__name__)

router = APIRouter()


def require_permission(required_role: UserRole):
    """Dependency to check user permissions."""
    def _check_permission(current_user: User = Depends(lambda: None)):
        if not current_user or not current_user.has_permission(required_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return _check_permission


@router.get("/health", response_model=SystemHealth, summary="Get System Health")
async def get_system_health(
    current_user: User = Depends(lambda: None)
):
    """Get comprehensive system health status."""
    try:
        # Mock system health data
        health = SystemHealth(
            status="healthy",
            version="1.0.0",
            uptime_seconds=3600 * 24 * 5,  # 5 days
            components={
                "database": {
                    "status": "healthy",
                    "connected": True,
                    "response_time": 5.2
                },
                "event_bus": {
                    "status": "healthy", 
                    "active_connections": 3,
                    "messages_per_second": 15.7
                },
                "strategy_manager": {
                    "status": "healthy",
                    "active_strategies": 2,
                    "total_strategies": 4
                },
                "order_manager": {
                    "status": "healthy",
                    "pending_orders": 3,
                    "execution_rate": 99.2
                }
            },
            system={
                "cpu_usage": 23.5,
                "memory_usage": 34.2,
                "disk_usage": 45.8,
                "network_status": "connected"
            },
            timestamp=datetime.utcnow()
        )
        
        return health
        
    except Exception as e:
        logger.error(f"Error retrieving system health: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve system health"
        )


@router.get("/metrics", response_model=SystemMetrics, summary="Get System Metrics")
async def get_system_metrics(
    current_user: User = Depends(lambda: None)
):
    """Get detailed system performance metrics."""
    try:
        # Mock metrics data
        metrics = SystemMetrics(
            cpu_usage_percent=23.5,
            memory_usage_percent=34.2,
            memory_available_mb=2048.5,
            disk_usage_percent=45.8,
            network_io={
                "bytes_sent": 1024000,
                "bytes_received": 2048000
            },
            active_connections=15,
            request_rate=25.3,
            error_rate=0.2,
            response_time_avg=156.7,
            timestamp=datetime.utcnow()
        )
        
        return metrics
        
    except Exception as e:
        logger.error(f"Error retrieving system metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve system metrics"
        )


@router.get("/config", response_model=SystemConfiguration, summary="Get System Configuration")
async def get_system_configuration(
    current_user: User = Depends(require_permission(UserRole.ADMIN))
):
    """Get system configuration (Admin only)."""
    try:
        config = SystemConfiguration(
            trading_enabled=True,
            paper_trading_enabled=True,
            risk_limits={
                "max_position_size": 0.1,
                "max_portfolio_exposure": 0.8,
                "max_daily_loss": 0.05
            },
            supported_brokers=["paper", "interactive_brokers", "alpaca"],
            supported_data_providers=["yahoo", "alpha_vantage"],
            max_positions=50,
            max_strategies=10,
            timezone="UTC"
        )
        
        return config
        
    except Exception as e:
        logger.error(f"Error retrieving system configuration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve system configuration"
        )


@router.get("/logs", response_model=List[LogEntry], summary="Get System Logs")
async def get_system_logs(
    level: str = "INFO",
    limit: int = 100,
    current_user: User = Depends(require_permission(UserRole.ADMIN))
):
    """Get recent system logs (Admin only)."""
    try:
        # Mock log entries
        logs = [
            LogEntry(
                timestamp=datetime.utcnow(),
                level="INFO",
                logger="trading_api.web.app",
                message="System health check completed successfully",
                module="app.py",
                function="health_check",
                line=123
            ),
            LogEntry(
                timestamp=datetime.utcnow(),
                level="INFO", 
                logger="trading_api.strategies.manager",
                message="Strategy RSIMeanReversion started successfully",
                module="manager.py",
                function="start_strategy", 
                line=45
            ),
            LogEntry(
                timestamp=datetime.utcnow(),
                level="WARNING",
                logger="trading_api.orders.manager",
                message="High latency detected in order processing",
                module="manager.py",
                function="process_order",
                line=234
            )
        ]
        
        # Filter by level
        if level != "ALL":
            logs = [log for log in logs if log.level == level]
        
        return logs[:limit]
        
    except Exception as e:
        logger.error(f"Error retrieving system logs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve system logs"
        )


@router.post("/restart", response_model=BaseResponse, summary="Restart System")
async def restart_system(
    current_user: User = Depends(require_permission(UserRole.ADMIN))
):
    """Restart system components (Admin only)."""
    try:
        logger.info(f"System restart initiated by user {current_user.username}")
        
        # In practice, this would trigger a graceful restart
        # For demo, just return success message
        
        return BaseResponse(
            success=True,
            message="System restart initiated successfully"
        )
        
    except Exception as e:
        logger.error(f"Error initiating system restart: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restart system"
        )


@router.get("/status", response_model=Dict[str, Any], summary="Get System Status")
async def get_system_status(
    current_user: User = Depends(lambda: None)
):
    """Get overview of system status and key metrics."""
    try:
        status_data = {
            "system": {
                "status": "operational",
                "uptime_hours": 120.5,
                "version": "1.0.0",
                "environment": "development"
            },
            "trading": {
                "status": "active",
                "active_strategies": 2,
                "pending_orders": 3,
                "positions": 8
            },
            "performance": {
                "cpu_usage": 23.5,
                "memory_usage": 34.2,
                "response_time": 156.7,
                "error_rate": 0.2
            },
            "connectivity": {
                "database": "connected",
                "brokers": "connected",
                "data_feeds": "connected"
            }
        }
        
        return status_data
        
    except Exception as e:
        logger.error(f"Error retrieving system status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve system status"
        )