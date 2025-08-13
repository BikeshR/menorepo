"""
Rate Limiting Middleware for Pi5 Trading System Web Interface.

Implements request rate limiting using a sliding window algorithm
to prevent abuse and ensure fair resource usage.
"""

import asyncio
import time
import logging
from collections import defaultdict, deque
from typing import Dict, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from datetime import datetime


logger = logging.getLogger(__name__)


class SlidingWindowRateLimiter:
    """
    Sliding window rate limiter implementation.
    
    Uses a sliding window approach to track requests over time,
    providing more accurate rate limiting than fixed windows.
    """
    
    def __init__(self, max_requests: int, window_seconds: int):
        """
        Initialize rate limiter.
        
        Args:
            max_requests: Maximum requests allowed in window
            window_seconds: Time window in seconds
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, deque] = defaultdict(lambda: deque())
        self.last_cleanup = time.time()
        self.cleanup_interval = 60  # Cleanup every minute
    
    def is_allowed(self, identifier: str) -> Tuple[bool, Dict[str, any]]:
        """
        Check if request is allowed for identifier.
        
        Args:
            identifier: Unique identifier (IP, user ID, etc.)
            
        Returns:
            Tuple of (allowed, rate_limit_info)
        """
        now = time.time()
        
        # Periodic cleanup of old entries
        if now - self.last_cleanup > self.cleanup_interval:
            self._cleanup_old_entries(now)
            self.last_cleanup = now
        
        # Get request timestamps for this identifier
        request_times = self.requests[identifier]
        
        # Remove requests outside the current window
        cutoff_time = now - self.window_seconds
        while request_times and request_times[0] < cutoff_time:
            request_times.popleft()
        
        # Check if we're within rate limit
        current_requests = len(request_times)
        allowed = current_requests < self.max_requests
        
        if allowed:
            # Add current request timestamp
            request_times.append(now)
        
        # Calculate rate limit info
        remaining = max(0, self.max_requests - current_requests - (1 if allowed else 0))
        reset_time = int(request_times[0] + self.window_seconds) if request_times else int(now + self.window_seconds)
        
        rate_limit_info = {
            "limit": self.max_requests,
            "remaining": remaining,
            "reset": reset_time,
            "reset_after": max(0, reset_time - int(now)),
            "current": current_requests + (1 if allowed else 0)
        }
        
        return allowed, rate_limit_info
    
    def _cleanup_old_entries(self, now: float):
        """Clean up old request entries to prevent memory leaks."""
        cutoff_time = now - (self.window_seconds * 2)  # Keep extra buffer
        identifiers_to_remove = []
        
        for identifier, request_times in self.requests.items():
            # Remove old requests
            while request_times and request_times[0] < cutoff_time:
                request_times.popleft()
            
            # Remove identifier if no recent requests
            if not request_times:
                identifiers_to_remove.append(identifier)
        
        # Remove empty identifiers
        for identifier in identifiers_to_remove:
            del self.requests[identifier]
        
        if identifiers_to_remove:
            logger.debug(f"Cleaned up {len(identifiers_to_remove)} inactive rate limit entries")


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for request rate limiting.
    
    Implements per-IP and per-user rate limiting with different limits
    for authenticated vs unauthenticated requests.
    """
    
    def __init__(
        self,
        app,
        requests_per_minute: int = 100,
        requests_per_minute_authenticated: int = 200,
        burst_multiplier: int = 2,
        enable_user_limits: bool = True,
        exempt_paths: list = None
    ):
        """
        Initialize rate limiting middleware.
        
        Args:
            app: FastAPI application
            requests_per_minute: Rate limit for unauthenticated requests
            requests_per_minute_authenticated: Rate limit for authenticated requests
            burst_multiplier: Multiplier for burst allowance
            enable_user_limits: Enable per-user rate limiting
            exempt_paths: Paths to exempt from rate limiting
        """
        super().__init__(app)
        
        self.ip_limiter = SlidingWindowRateLimiter(
            max_requests=requests_per_minute,
            window_seconds=60
        )
        
        self.auth_limiter = SlidingWindowRateLimiter(
            max_requests=requests_per_minute_authenticated,
            window_seconds=60
        )
        
        self.user_limiters = {}  # Per-user rate limiters
        self.burst_multiplier = burst_multiplier
        self.enable_user_limits = enable_user_limits
        
        # Default exempt paths
        self.exempt_paths = exempt_paths or [
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/favicon.ico"
        ]
        
        self.logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def dispatch(self, request: Request, call_next):
        """Process request with rate limiting."""
        # Skip rate limiting for exempt paths
        if any(request.url.path.startswith(path) for path in self.exempt_paths):
            return await call_next(request)
        
        # Get client identifier
        client_ip = self._get_client_ip(request)
        user_id = self._get_user_id(request)
        
        # Determine which rate limiter to use
        if user_id and self.enable_user_limits:
            # Use per-user rate limiting for authenticated users
            if user_id not in self.user_limiters:
                self.user_limiters[user_id] = SlidingWindowRateLimiter(
                    max_requests=self.auth_limiter.max_requests,
                    window_seconds=60
                )
            
            limiter = self.user_limiters[user_id]
            identifier = f"user:{user_id}"
        else:
            # Use IP-based rate limiting
            limiter = self.ip_limiter if not user_id else self.auth_limiter
            identifier = f"ip:{client_ip}"
        
        # Check rate limit
        allowed, rate_info = limiter.is_allowed(identifier)
        
        if not allowed:
            # Rate limit exceeded
            self.logger.warning(
                f"Rate limit exceeded for {identifier}. "
                f"Current: {rate_info['current']}, Limit: {rate_info['limit']}"
            )
            
            return JSONResponse(
                status_code=429,
                content={
                    "error": "RateLimitExceeded",
                    "message": "Too many requests. Please try again later.",
                    "retry_after": rate_info["reset_after"],
                    "limit": rate_info["limit"],
                    "remaining": rate_info["remaining"],
                    "reset": rate_info["reset"]
                },
                headers={
                    "X-RateLimit-Limit": str(rate_info["limit"]),
                    "X-RateLimit-Remaining": str(rate_info["remaining"]),
                    "X-RateLimit-Reset": str(rate_info["reset"]),
                    "Retry-After": str(rate_info["reset_after"])
                }
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(rate_info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(rate_info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(rate_info["reset"])
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request."""
        # Check for forwarded headers (load balancer/proxy)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP in the chain
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fall back to client host
        return request.client.host if request.client else "unknown"
    
    def _get_user_id(self, request: Request) -> str:
        """Extract user ID from authenticated request."""
        try:
            # Check if user is set by auth middleware
            user = getattr(request.state, "user", None)
            if user and hasattr(user, "id"):
                return user.id
            
            # Try to extract from Authorization header
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return None
            
            # For now, return None - user will be set by auth middleware
            # This is a simplified implementation
            return None
            
        except Exception as e:
            self.logger.debug(f"Could not extract user ID: {e}")
            return None
    
    def get_rate_limit_stats(self) -> Dict[str, any]:
        """Get rate limiting statistics."""
        ip_entries = len(self.ip_limiter.requests)
        auth_entries = len(self.auth_limiter.requests)
        user_entries = sum(len(limiter.requests) for limiter in self.user_limiters.values())
        
        return {
            "ip_limiter": {
                "max_requests": self.ip_limiter.max_requests,
                "window_seconds": self.ip_limiter.window_seconds,
                "active_ips": ip_entries
            },
            "auth_limiter": {
                "max_requests": self.auth_limiter.max_requests,
                "window_seconds": self.auth_limiter.window_seconds,
                "active_entries": auth_entries
            },
            "user_limiters": {
                "total_users": len(self.user_limiters),
                "active_entries": user_entries
            },
            "exempt_paths": self.exempt_paths
        }
    
    def reset_limits_for_identifier(self, identifier: str):
        """Reset rate limits for a specific identifier (admin function)."""
        # Reset IP limiter
        if identifier.startswith("ip:"):
            ip = identifier[3:]
            if ip in self.ip_limiter.requests:
                del self.ip_limiter.requests[ip]
                self.logger.info(f"Reset rate limits for IP: {ip}")
        
        # Reset user limiter
        elif identifier.startswith("user:"):
            user_id = identifier[5:]
            if user_id in self.user_limiters:
                del self.user_limiters[user_id]
                self.logger.info(f"Reset rate limits for user: {user_id}")
    
    def clear_all_limits(self):
        """Clear all rate limit data (admin function)."""
        self.ip_limiter.requests.clear()
        self.auth_limiter.requests.clear()
        self.user_limiters.clear()
        self.logger.info("Cleared all rate limit data")