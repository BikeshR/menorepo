"""
Web Interface Configuration for Pi5 Trading System.

Configuration management for the web interface including API settings,
authentication, rate limiting, and frontend configuration.
"""

import os
from typing import List, Optional
from dataclasses import dataclass
from datetime import timedelta


@dataclass
class WebConfig:
    """
    Configuration class for the Pi5 Trading System web interface.
    
    Contains all configuration parameters including database, authentication,
    rate limiting, security, and frontend settings.
    """
    
    # Application settings
    app_name: str = "Pi5 Trading System"
    app_version: str = "1.0.0"
    debug_mode: bool = False
    
    # Server settings  
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1
    
    # Database settings (inherits from trading system)
    database_url: str = "postgresql://pi5trader:tradingpass@localhost:5432/pi5_trading"
    db_pool_size: int = 10
    db_max_overflow: int = 20
    
    # Redis settings (for caching and sessions)
    redis_url: str = "redis://localhost:6379"
    redis_db: int = 0
    redis_password: Optional[str] = None
    
    # JWT Authentication settings
    jwt_secret_key: str = "pi5-trading-system-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    
    # Rate limiting settings
    rate_limit_requests: int = 100
    rate_limit_window: int = 60  # seconds
    rate_limit_enabled: bool = True
    
    # CORS settings
    cors_origins: List[str] = None
    cors_allow_credentials: bool = True
    cors_allow_methods: List[str] = None
    cors_allow_headers: List[str] = None
    
    # Security settings
    trusted_hosts: List[str] = None
    max_request_size: int = 16 * 1024 * 1024  # 16MB
    
    # WebSocket settings
    websocket_ping_interval: int = 20
    websocket_ping_timeout: int = 10
    max_websocket_connections: int = 50
    websocket_message_size: int = 1024 * 1024  # 1MB
    
    # Frontend settings
    frontend_enabled: bool = True
    static_files_dir: str = "web/static"
    upload_dir: str = "uploads"
    
    # API settings
    api_prefix: str = "/api/v1"
    docs_url: str = "/docs"
    redoc_url: str = "/redoc"
    openapi_url: str = "/openapi.json"
    
    # Logging settings
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    log_file: Optional[str] = None
    access_log: bool = True
    
    # Performance settings
    response_cache_ttl: int = 300  # 5 minutes
    background_task_timeout: int = 300  # 5 minutes
    request_timeout: int = 30  # 30 seconds
    
    # Trading system integration
    enable_paper_trading: bool = True
    enable_live_trading: bool = False
    default_initial_cash: float = 100000.0
    
    def __post_init__(self):
        """Initialize configuration from environment variables."""
        self._load_from_env()
        self._set_defaults()
        self._validate_config()
    
    def _load_from_env(self):
        """Load configuration from environment variables."""
        # Application settings
        self.app_name = os.getenv("APP_NAME", self.app_name)
        self.app_version = os.getenv("APP_VERSION", self.app_version)
        self.debug_mode = os.getenv("DEBUG", "false").lower() == "true"
        
        # Server settings
        self.host = os.getenv("WEB_HOST", self.host)
        self.port = int(os.getenv("WEB_PORT", str(self.port)))
        self.workers = int(os.getenv("WEB_WORKERS", str(self.workers)))
        
        # Database settings - build URL from components or use full URL
        if os.getenv("DATABASE_URL"):
            self.database_url = os.getenv("DATABASE_URL")
        else:
            # Build from individual components for Docker
            db_host = os.getenv("DB_HOST", "localhost")
            db_port = os.getenv("DB_PORT", "5432") 
            db_name = os.getenv("DB_NAME", "pi5_trading")
            db_user = os.getenv("DB_USER", "pi5trader")
            db_password = os.getenv("DB_PASSWORD", "tradingpass")
            self.database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
        
        self.db_pool_size = int(os.getenv("DB_POOL_SIZE", str(self.db_pool_size)))
        
        # Redis settings - build URL from components or use full URL  
        if os.getenv("REDIS_URL"):
            self.redis_url = os.getenv("REDIS_URL")
        else:
            # Build from individual components for Docker
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = os.getenv("REDIS_PORT", "6379")
            self.redis_url = f"redis://{redis_host}:{redis_port}"
        
        self.redis_db = int(os.getenv("REDIS_DB", str(self.redis_db)))
        self.redis_password = os.getenv("REDIS_PASSWORD")
        
        # Authentication settings
        self.jwt_secret_key = os.getenv("JWT_SECRET_KEY", self.jwt_secret_key)
        self.jwt_algorithm = os.getenv("JWT_ALGORITHM", self.jwt_algorithm)
        self.access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(self.access_token_expire_minutes)))
        self.refresh_token_expire_days = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", str(self.refresh_token_expire_days)))
        
        # Rate limiting
        self.rate_limit_requests = int(os.getenv("RATE_LIMIT_REQUESTS", str(self.rate_limit_requests)))
        self.rate_limit_window = int(os.getenv("RATE_LIMIT_WINDOW", str(self.rate_limit_window)))
        self.rate_limit_enabled = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
        
        # Security settings
        if os.getenv("TRUSTED_HOSTS"):
            self.trusted_hosts = os.getenv("TRUSTED_HOSTS").split(",")
        
        # WebSocket settings
        self.websocket_ping_interval = int(os.getenv("WS_PING_INTERVAL", str(self.websocket_ping_interval)))
        self.websocket_ping_timeout = int(os.getenv("WS_PING_TIMEOUT", str(self.websocket_ping_timeout)))
        self.max_websocket_connections = int(os.getenv("MAX_WS_CONNECTIONS", str(self.max_websocket_connections)))
        
        # Frontend settings
        self.frontend_enabled = os.getenv("FRONTEND_ENABLED", "true").lower() == "true"
        self.static_files_dir = os.getenv("STATIC_FILES_DIR", self.static_files_dir)
        self.upload_dir = os.getenv("UPLOAD_DIR", self.upload_dir)
        
        # Trading settings
        self.enable_paper_trading = os.getenv("ENABLE_PAPER_TRADING", "true").lower() == "true"
        self.enable_live_trading = os.getenv("ENABLE_LIVE_TRADING", "false").lower() == "true"
        self.default_initial_cash = float(os.getenv("DEFAULT_INITIAL_CASH", str(self.default_initial_cash)))
        
        # Logging settings
        self.log_level = os.getenv("LOG_LEVEL", self.log_level).upper()
        self.log_file = os.getenv("LOG_FILE")
        self.access_log = os.getenv("ACCESS_LOG", "true").lower() == "true"
    
    def _set_defaults(self):
        """Set default values for configuration."""
        if self.cors_origins is None:
            if self.debug_mode:
                self.cors_origins = ["*"]
            else:
                self.cors_origins = [
                    "http://localhost:3000",  # React dev server
                    "http://localhost:8000",  # FastAPI server
                    f"http://{self.host}:{self.port}"
                ]
        
        if self.cors_allow_methods is None:
            self.cors_allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
        
        if self.cors_allow_headers is None:
            self.cors_allow_headers = ["Authorization", "Content-Type", "Accept"]
        
        if self.trusted_hosts is None:
            if self.debug_mode:
                self.trusted_hosts = ["*"]
            else:
                self.trusted_hosts = ["localhost", "127.0.0.1", self.host]
    
    def _validate_config(self):
        """Validate configuration parameters."""
        if self.port < 1 or self.port > 65535:
            raise ValueError(f"Invalid port number: {self.port}")
        
        if self.db_pool_size < 1:
            raise ValueError(f"Invalid database pool size: {self.db_pool_size}")
        
        if self.access_token_expire_minutes < 1:
            raise ValueError(f"Invalid access token expiry: {self.access_token_expire_minutes}")
        
        if self.rate_limit_requests < 1:
            raise ValueError(f"Invalid rate limit requests: {self.rate_limit_requests}")
        
        if self.rate_limit_window < 1:
            raise ValueError(f"Invalid rate limit window: {self.rate_limit_window}")
        
        if self.workers < 1:
            raise ValueError(f"Invalid number of workers: {self.workers}")
        
        if self.max_websocket_connections < 1:
            raise ValueError(f"Invalid max WebSocket connections: {self.max_websocket_connections}")
        
        # Validate JWT secret key
        if len(self.jwt_secret_key) < 32 and not self.debug_mode:
            raise ValueError("JWT secret key must be at least 32 characters in production")
        
        # Validate directories
        if not os.path.exists(self.upload_dir):
            os.makedirs(self.upload_dir, exist_ok=True)
    
    @property
    def access_token_expire_delta(self) -> timedelta:
        """Get access token expiration timedelta."""
        return timedelta(minutes=self.access_token_expire_minutes)
    
    @property
    def refresh_token_expire_delta(self) -> timedelta:
        """Get refresh token expiration timedelta."""
        return timedelta(days=self.refresh_token_expire_days)
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.debug_mode
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return not self.debug_mode
    
    def get_database_url(self, async_driver: bool = True) -> str:
        """
        Get database URL with optional async driver.
        
        Args:
            async_driver: Whether to use async database driver
            
        Returns:
            Database URL string
        """
        if async_driver and self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+asyncpg://")
        return self.database_url
    
    def get_redis_config(self) -> dict:
        """Get Redis configuration dictionary."""
        config = {
            "url": self.redis_url,
            "db": self.redis_db,
            "decode_responses": True,
            "socket_timeout": 5,
            "socket_connect_timeout": 5,
            "retry_on_timeout": True
        }
        
        if self.redis_password:
            config["password"] = self.redis_password
        
        return config
    
    def get_cors_config(self) -> dict:
        """Get CORS configuration dictionary."""
        return {
            "allow_origins": self.cors_origins,
            "allow_credentials": self.cors_allow_credentials,
            "allow_methods": self.cors_allow_methods,
            "allow_headers": self.cors_allow_headers
        }
    
    def get_websocket_config(self) -> dict:
        """Get WebSocket configuration dictionary."""
        return {
            "ping_interval": self.websocket_ping_interval,
            "ping_timeout": self.websocket_ping_timeout,
            "max_connections": self.max_websocket_connections,
            "max_message_size": self.websocket_message_size
        }
    
    def to_dict(self, include_sensitive: bool = False) -> dict:
        """
        Convert configuration to dictionary.
        
        Args:
            include_sensitive: Whether to include sensitive information
            
        Returns:
            Configuration dictionary
        """
        config_dict = {
            "app_name": self.app_name,
            "app_version": self.app_version,
            "debug_mode": self.debug_mode,
            "host": self.host,
            "port": self.port,
            "workers": self.workers,
            "db_pool_size": self.db_pool_size,
            "rate_limit_enabled": self.rate_limit_enabled,
            "rate_limit_requests": self.rate_limit_requests,
            "rate_limit_window": self.rate_limit_window,
            "access_token_expire_minutes": self.access_token_expire_minutes,
            "refresh_token_expire_days": self.refresh_token_expire_days,
            "max_websocket_connections": self.max_websocket_connections,
            "frontend_enabled": self.frontend_enabled,
            "enable_paper_trading": self.enable_paper_trading,
            "enable_live_trading": self.enable_live_trading,
            "default_initial_cash": self.default_initial_cash,
            "log_level": self.log_level,
            "access_log": self.access_log
        }
        
        if include_sensitive:
            config_dict.update({
                "database_url": self.database_url,
                "redis_url": self.redis_url,
                "jwt_secret_key": self.jwt_secret_key[:8] + "...",  # Partial for security
            })
        
        return config_dict
    
    def __repr__(self) -> str:
        """String representation of configuration."""
        return f"WebConfig({self.to_dict()})"