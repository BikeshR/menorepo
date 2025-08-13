"""
Error Handling Middleware for Pi5 Trading System Web Interface.

Comprehensive error handling with structured error responses,
error tracking, and security-aware error disclosure.
"""

import asyncio
import logging
import traceback
from typing import Dict, Any, Optional
from datetime import datetime
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.status import (
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
    HTTP_422_UNPROCESSABLE_ENTITY,
    HTTP_429_TOO_MANY_REQUESTS,
    HTTP_500_INTERNAL_SERVER_ERROR,
    HTTP_503_SERVICE_UNAVAILABLE
)

from core.exceptions import (
    TradingSystemError,
    AuthenticationError,
    OrderValidationError,
    RiskManagementError,
    DataValidationError,
    BrokerError,
    PortfolioError
)


logger = logging.getLogger(__name__)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for comprehensive error handling.
    
    Provides structured error responses, error tracking, and
    security-aware error disclosure to prevent information leaks.
    """
    
    def __init__(
        self,
        app,
        debug_mode: bool = False,
        include_traceback: bool = False,
        log_errors: bool = True,
        track_error_stats: bool = True
    ):
        """
        Initialize error handling middleware.
        
        Args:
            app: FastAPI application
            debug_mode: Enable debug mode with detailed error info
            include_traceback: Include traceback in error responses
            log_errors: Enable error logging
            track_error_stats: Track error statistics
        """
        super().__init__(app)
        
        self.debug_mode = debug_mode
        self.include_traceback = include_traceback and debug_mode
        self.log_errors = log_errors
        self.track_error_stats = track_error_stats
        
        # Error statistics tracking
        self.error_stats: Dict[str, int] = {}
        self.error_details: Dict[str, Dict[str, Any]] = {}
        
        self.logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def dispatch(self, request: Request, call_next):
        """Process request with comprehensive error handling."""
        try:
            response = await call_next(request)
            return response
            
        except Exception as error:
            return await self._handle_error(request, error)
    
    async def _handle_error(self, request: Request, error: Exception) -> JSONResponse:
        """Handle different types of errors with appropriate responses."""
        request_id = getattr(request.state, "request_id", "unknown")
        
        # Determine error type and create response
        if isinstance(error, AuthenticationError):
            response = self._create_error_response(
                error=error,
                status_code=HTTP_401_UNAUTHORIZED,
                error_code="AUTHENTICATION_ERROR",
                message="Authentication failed"
            )
        
        elif isinstance(error, PermissionError):
            response = self._create_error_response(
                error=error,
                status_code=HTTP_403_FORBIDDEN,
                error_code="PERMISSION_DENIED",
                message="Insufficient permissions"
            )
        
        elif isinstance(error, OrderValidationError):
            response = self._create_error_response(
                error=error,
                status_code=HTTP_400_BAD_REQUEST,
                error_code="ORDER_VALIDATION_ERROR",
                message="Order validation failed"
            )
        
        elif isinstance(error, RiskManagementError):
            response = self._create_error_response(
                error=error,
                status_code=HTTP_400_BAD_REQUEST,
                error_code="RISK_MANAGEMENT_ERROR",
                message="Risk limits exceeded"
            )
        
        elif isinstance(error, BrokerError):
            response = self._create_error_response(
                error=error,
                status_code=HTTP_503_SERVICE_UNAVAILABLE,
                error_code="BROKER_ERROR",
                message="Broker service unavailable"
            )
        
        elif isinstance(error, PortfolioError):
            response = self._create_error_response(
                error=error,
                status_code=HTTP_400_BAD_REQUEST,
                error_code="PORTFOLIO_ERROR",
                message="Portfolio operation failed"
            )
        
        elif isinstance(error, DataValidationError):
            response = self._create_error_response(
                error=error,
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                error_code="DATA_VALIDATION_ERROR",
                message="Data validation failed"
            )
        
        elif isinstance(error, TradingSystemError):
            response = self._create_error_response(
                error=error,
                status_code=HTTP_400_BAD_REQUEST,
                error_code="TRADING_SYSTEM_ERROR",
                message="Trading system error"
            )
        
        elif isinstance(error, ValueError):
            response = self._create_error_response(
                error=error,
                status_code=HTTP_400_BAD_REQUEST,
                error_code="INVALID_REQUEST",
                message="Invalid request parameters"
            )
        
        elif isinstance(error, FileNotFoundError):
            response = self._create_error_response(
                error=error,
                status_code=HTTP_404_NOT_FOUND,
                error_code="NOT_FOUND",
                message="Resource not found"
            )
        
        elif isinstance(error, asyncio.TimeoutError):
            response = self._create_error_response(
                error=error,
                status_code=HTTP_503_SERVICE_UNAVAILABLE,
                error_code="TIMEOUT_ERROR",
                message="Request timeout"
            )
        
        elif isinstance(error, ConnectionError):
            response = self._create_error_response(
                error=error,
                status_code=HTTP_503_SERVICE_UNAVAILABLE,
                error_code="CONNECTION_ERROR",
                message="Service connection failed"
            )
        
        else:
            # Generic internal server error
            response = self._create_error_response(
                error=error,
                status_code=HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="INTERNAL_SERVER_ERROR",
                message="An internal server error occurred"
            )
        
        # Add request ID to response
        response.headers["X-Request-ID"] = request_id
        
        # Log error if enabled
        if self.log_errors:
            await self._log_error(request, error, response.status_code)
        
        # Track error statistics
        if self.track_error_stats:
            self._track_error(error, response.status_code)
        
        return response
    
    def _create_error_response(
        self,
        error: Exception,
        status_code: int,
        error_code: str,
        message: str
    ) -> JSONResponse:
        """Create structured error response."""
        error_data = {
            "success": False,
            "error": {
                "code": error_code,
                "message": message,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        # Add detailed error information in debug mode
        if self.debug_mode:
            error_data["error"]["type"] = type(error).__name__
            
            if str(error) and str(error) != message:
                error_data["error"]["detail"] = str(error)
            
            # Add traceback in debug mode
            if self.include_traceback:
                error_data["error"]["traceback"] = traceback.format_exc()
        
        # Add specific error attributes for known error types
        if hasattr(error, "error_code"):
            error_data["error"]["internal_code"] = error.error_code
        
        if hasattr(error, "details"):
            error_data["error"]["details"] = error.details
        
        if hasattr(error, "field_errors"):
            error_data["error"]["field_errors"] = error.field_errors
        
        return JSONResponse(
            status_code=status_code,
            content=error_data
        )
    
    async def _log_error(self, request: Request, error: Exception, status_code: int):
        """Log error with context information."""
        try:
            request_id = getattr(request.state, "request_id", "unknown")
            
            # Build error context
            error_context = {
                "request_id": request_id,
                "error_type": type(error).__name__,
                "error_message": str(error),
                "status_code": status_code,
                "method": request.method,
                "url": str(request.url),
                "path": request.url.path,
                "client_ip": self._get_client_ip(request),
                "user_agent": request.headers.get("user-agent", ""),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Add user information if available
            user_info = self._get_user_info(request)
            if user_info:
                error_context["user"] = user_info
            
            # Add query parameters
            if request.query_params:
                error_context["query_params"] = dict(request.query_params)
            
            # Determine log level based on error type
            if status_code >= 500:
                log_level = logging.ERROR
            elif status_code >= 400:
                log_level = logging.WARNING
            else:
                log_level = logging.INFO
            
            # Log with structured data
            self.logger.log(
                log_level,
                f"Request error {status_code} {request.method} {request.url.path}: {error}",
                extra={"structured_data": error_context},
                exc_info=status_code >= 500  # Include traceback for server errors
            )
            
        except Exception as log_error:
            # Fallback logging if structured logging fails
            self.logger.error(f"Error logging failed: {log_error}")
            self.logger.error(f"Original error: {error}", exc_info=True)
    
    def _track_error(self, error: Exception, status_code: int):
        """Track error statistics."""
        try:
            error_type = type(error).__name__
            
            # Increment error count
            self.error_stats[error_type] = self.error_stats.get(error_type, 0) + 1
            
            # Store error details
            self.error_details[error_type] = {
                "last_occurrence": datetime.utcnow().isoformat(),
                "status_code": status_code,
                "count": self.error_stats[error_type]
            }
            
        except Exception as track_error:
            self.logger.error(f"Error tracking failed: {track_error}")
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address."""
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    def _get_user_info(self, request: Request) -> Optional[Dict[str, Any]]:
        """Extract user information from request."""
        try:
            user = getattr(request.state, "user", None)
            if user:
                return {
                    "id": getattr(user, "id", None),
                    "username": getattr(user, "username", None),
                    "role": getattr(user, "role", None)
                }
        except Exception:
            pass
        
        return None
    
    def get_error_stats(self) -> Dict[str, Any]:
        """Get error statistics."""
        total_errors = sum(self.error_stats.values())
        
        # Sort errors by frequency
        sorted_errors = sorted(
            self.error_stats.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        return {
            "total_errors": total_errors,
            "error_types": len(self.error_stats),
            "top_errors": sorted_errors[:10],  # Top 10 errors
            "error_details": self.error_details,
            "configuration": {
                "debug_mode": self.debug_mode,
                "include_traceback": self.include_traceback,
                "log_errors": self.log_errors,
                "track_error_stats": self.track_error_stats
            }
        }
    
    def reset_error_stats(self):
        """Reset error statistics (admin function)."""
        self.error_stats.clear()
        self.error_details.clear()
        self.logger.info("Error statistics reset")
    
    def get_error_summary(self) -> Dict[str, Any]:
        """Get summary of recent errors."""
        if not self.error_details:
            return {"message": "No errors recorded"}
        
        # Get most recent errors
        recent_errors = sorted(
            self.error_details.items(),
            key=lambda x: x[1]["last_occurrence"],
            reverse=True
        )[:5]
        
        return {
            "total_unique_errors": len(self.error_details),
            "total_error_count": sum(self.error_stats.values()),
            "most_recent_errors": [
                {
                    "type": error_type,
                    "count": details["count"],
                    "last_occurrence": details["last_occurrence"],
                    "status_code": details["status_code"]
                }
                for error_type, details in recent_errors
            ]
        }