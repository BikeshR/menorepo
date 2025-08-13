"""
Logging Middleware for Pi5 Trading System Web Interface.

Comprehensive request/response logging with performance metrics,
error tracking, and security monitoring.
"""

import asyncio
import time
import logging
import json
from typing import Dict, Any, Optional, List
from datetime import datetime
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import uuid


logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for comprehensive request/response logging.
    
    Logs all requests with timing, user information, and response details.
    Provides structured logging for monitoring and debugging.
    """
    
    def __init__(
        self,
        app,
        log_requests: bool = True,
        log_responses: bool = True,
        log_request_body: bool = False,
        log_response_body: bool = False,
        max_body_size: int = 1024,
        exclude_paths: list = None,
        include_headers: list = None,
        exclude_headers: list = None
    ):
        """
        Initialize logging middleware.
        
        Args:
            app: FastAPI application
            log_requests: Whether to log requests
            log_responses: Whether to log responses
            log_request_body: Whether to log request body
            log_response_body: Whether to log response body
            max_body_size: Maximum body size to log (bytes)
            exclude_paths: Paths to exclude from logging
            include_headers: Headers to include in logs
            exclude_headers: Headers to exclude from logs
        """
        super().__init__(app)
        
        self.log_requests = log_requests
        self.log_responses = log_responses
        self.log_request_body = log_request_body
        self.log_response_body = log_response_body
        self.max_body_size = max_body_size
        
        # Default exclude paths (health checks, static files)
        self.exclude_paths = exclude_paths or [
            "/health",
            "/favicon.ico",
            "/static/",
            "/docs",
            "/redoc",
            "/openapi.json"
        ]
        
        # Header filtering
        self.include_headers = include_headers or [
            "user-agent",
            "content-type",
            "accept",
            "authorization",
            "x-forwarded-for",
            "x-real-ip"
        ]
        
        self.exclude_headers = exclude_headers or [
            "cookie",
            "set-cookie",
            "authorization"  # Will be sanitized instead
        ]
        
        # Request tracking
        self.active_requests: Dict[str, Dict[str, Any]] = {}
        
        self.logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def dispatch(self, request: Request, call_next):
        """Process request with comprehensive logging."""
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Skip logging for excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        start_time = time.time()
        
        # Log request
        if self.log_requests:
            await self._log_request(request, request_id)
        
        # Track active request
        self.active_requests[request_id] = {
            "method": request.method,
            "url": str(request.url),
            "start_time": start_time,
            "client_ip": self._get_client_ip(request),
            "user_agent": request.headers.get("user-agent", "")
        }
        
        # Process request and capture response
        try:
            response = await call_next(request)
            
            # Calculate request duration
            duration = time.time() - start_time
            
            # Log response
            if self.log_responses:
                await self._log_response(request, response, request_id, duration)
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            duration = time.time() - start_time
            
            # Log error
            self._log_error(request, e, request_id, duration)
            
            # Re-raise exception
            raise
            
        finally:
            # Clean up active request tracking
            self.active_requests.pop(request_id, None)
    
    async def _log_request(self, request: Request, request_id: str):
        """Log incoming request details."""
        try:
            # Extract basic request info
            log_data = {
                "event": "request_start",
                "request_id": request_id,
                "timestamp": datetime.utcnow().isoformat(),
                "method": request.method,
                "url": str(request.url),
                "path": request.url.path,
                "query_params": dict(request.query_params) if request.query_params else None,
                "client_ip": self._get_client_ip(request),
                "user_agent": request.headers.get("user-agent", ""),
                "content_type": request.headers.get("content-type"),
                "content_length": request.headers.get("content-length")
            }
            
            # Add filtered headers
            headers = self._filter_headers(dict(request.headers))
            if headers:
                log_data["headers"] = headers
            
            # Add user information if available
            user_info = self._get_user_info(request)
            if user_info:
                log_data["user"] = user_info
            
            # Add request body if enabled and appropriate
            if self.log_request_body and self._should_log_body(request):
                body = await self._get_request_body(request)
                if body:
                    log_data["body"] = body
            
            # Log structured data
            self.logger.info(
                f"Request {request.method} {request.url.path}",
                extra={"structured_data": log_data}
            )
            
        except Exception as e:
            self.logger.error(f"Error logging request: {e}")
    
    async def _log_response(
        self, 
        request: Request, 
        response: Response, 
        request_id: str, 
        duration: float
    ):
        """Log response details."""
        try:
            log_data = {
                "event": "request_complete",
                "request_id": request_id,
                "timestamp": datetime.utcnow().isoformat(),
                "method": request.method,
                "url": str(request.url),
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration * 1000, 2),
                "response_size": response.headers.get("content-length")
            }
            
            # Add user information
            user_info = self._get_user_info(request)
            if user_info:
                log_data["user"] = user_info
            
            # Add response headers
            response_headers = self._filter_headers(dict(response.headers))
            if response_headers:
                log_data["response_headers"] = response_headers
            
            # Performance categorization
            if duration > 5.0:
                log_data["performance"] = "very_slow"
            elif duration > 2.0:
                log_data["performance"] = "slow"
            elif duration > 1.0:
                log_data["performance"] = "medium"
            else:
                log_data["performance"] = "fast"
            
            # Log level based on status code and performance
            log_level = self._determine_log_level(response.status_code, duration)
            
            message = (
                f"Response {response.status_code} {request.method} {request.url.path} "
                f"({duration*1000:.2f}ms)"
            )
            
            self.logger.log(
                log_level,
                message,
                extra={"structured_data": log_data}
            )
            
        except Exception as e:
            self.logger.error(f"Error logging response: {e}")
    
    def _log_error(self, request: Request, error: Exception, request_id: str, duration: float):
        """Log request error."""
        try:
            log_data = {
                "event": "request_error",
                "request_id": request_id,
                "timestamp": datetime.utcnow().isoformat(),
                "method": request.method,
                "url": str(request.url),
                "path": request.url.path,
                "error_type": type(error).__name__,
                "error_message": str(error),
                "duration_ms": round(duration * 1000, 2)
            }
            
            # Add user information
            user_info = self._get_user_info(request)
            if user_info:
                log_data["user"] = user_info
            
            self.logger.error(
                f"Request error {request.method} {request.url.path}: {error}",
                extra={"structured_data": log_data},
                exc_info=True
            )
            
        except Exception as e:
            self.logger.error(f"Error logging error: {e}")
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address."""
        # Check for forwarded headers
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
    
    def _filter_headers(self, headers: Dict[str, str]) -> Dict[str, str]:
        """Filter headers for logging."""
        filtered = {}
        
        for key, value in headers.items():
            key_lower = key.lower()
            
            # Skip excluded headers
            if key_lower in self.exclude_headers:
                continue
            
            # Include only specified headers if list is provided
            if self.include_headers and key_lower not in self.include_headers:
                continue
            
            # Sanitize authorization header
            if key_lower == "authorization":
                if value.startswith("Bearer "):
                    filtered[key] = "Bearer ***"
                else:
                    filtered[key] = "***"
            else:
                filtered[key] = value
        
        return filtered
    
    def _should_log_body(self, request: Request) -> bool:
        """Determine if request body should be logged."""
        content_type = request.headers.get("content-type", "")
        
        # Log JSON and form data
        if content_type.startswith(("application/json", "application/x-www-form-urlencoded")):
            return True
        
        # Skip binary content
        if content_type.startswith(("image/", "video/", "audio/", "application/octet-stream")):
            return False
        
        return True
    
    async def _get_request_body(self, request: Request) -> Optional[str]:
        """Get request body for logging."""
        try:
            body = await request.body()
            
            if not body:
                return None
            
            if len(body) > self.max_body_size:
                return f"<body too large: {len(body)} bytes>"
            
            # Try to decode as JSON for pretty formatting
            try:
                import json
                json_data = json.loads(body)
                return json.dumps(json_data, indent=2)
            except (json.JSONDecodeError, UnicodeDecodeError):
                # Fall back to string representation
                try:
                    return body.decode("utf-8")
                except UnicodeDecodeError:
                    return f"<binary data: {len(body)} bytes>"
        
        except Exception as e:
            self.logger.debug(f"Error reading request body: {e}")
            return None
    
    def _determine_log_level(self, status_code: int, duration: float) -> int:
        """Determine appropriate log level based on response."""
        # Error responses
        if status_code >= 500:
            return logging.ERROR
        elif status_code >= 400:
            return logging.WARNING
        
        # Slow responses
        if duration > 2.0:
            return logging.WARNING
        
        # Normal responses
        return logging.INFO
    
    def get_logging_stats(self) -> Dict[str, Any]:
        """Get logging statistics."""
        active_count = len(self.active_requests)
        
        # Calculate average request duration for active requests
        if active_count > 0:
            current_time = time.time()
            active_durations = [
                current_time - req["start_time"]
                for req in self.active_requests.values()
            ]
            avg_active_duration = sum(active_durations) / len(active_durations)
        else:
            avg_active_duration = 0
        
        return {
            "active_requests": active_count,
            "average_active_duration": round(avg_active_duration, 2),
            "configuration": {
                "log_requests": self.log_requests,
                "log_responses": self.log_responses,
                "log_request_body": self.log_request_body,
                "log_response_body": self.log_response_body,
                "max_body_size": self.max_body_size,
                "exclude_paths_count": len(self.exclude_paths)
            }
        }
    
    def get_active_requests(self) -> List[Dict[str, Any]]:
        """Get list of currently active requests."""
        current_time = time.time()
        
        return [
            {
                "request_id": req_id,
                "method": req["method"],
                "url": req["url"],
                "duration": round(current_time - req["start_time"], 2),
                "client_ip": req["client_ip"],
                "user_agent": req["user_agent"][:100] + "..." if len(req["user_agent"]) > 100 else req["user_agent"]
            }
            for req_id, req in self.active_requests.items()
        ]