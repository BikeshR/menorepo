"""
Authentication and Authorization for Pi5 Trading System Web Interface.

JWT-based authentication system with role-based access control,
password hashing, and user management.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

import jwt
from passlib.context import CryptContext

from .config import WebConfig
from .models import UserRole, UserInfo, TokenData, LoginResponse
from core.exceptions import AuthenticationError


logger = logging.getLogger(__name__)


@dataclass
class User:
    """Internal user data model."""
    id: str
    username: str
    email: str
    role: UserRole
    is_active: bool = True
    created_at: datetime = None
    last_login: datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
    
    def has_permission(self, required_role: UserRole) -> bool:
        """Check if user has required permission level."""
        role_hierarchy = {
            UserRole.VIEWER: 1,
            UserRole.TRADER: 2,
            UserRole.ADMIN: 3
        }
        
        user_level = role_hierarchy.get(self.role, 0)
        required_level = role_hierarchy.get(required_role, 0)
        
        return self.is_active and user_level >= required_level
    
    def to_user_info(self) -> UserInfo:
        """Convert to UserInfo model."""
        return UserInfo(
            id=self.id,
            username=self.username,
            email=self.email,
            role=self.role,
            is_active=self.is_active,
            created_at=self.created_at,
            last_login=self.last_login
        )


class AuthManager:
    """
    Authentication and authorization manager for the web interface.
    
    Handles user authentication, JWT token generation and validation,
    password hashing, and role-based access control.
    """
    
    def __init__(self, config: WebConfig):
        """
        Initialize authentication manager.
        
        Args:
            config: Web configuration
        """
        self.config = config
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
        # In-memory user store (replace with database in production)
        self._users: Dict[str, User] = {}
        self._user_credentials: Dict[str, str] = {}
        
        # Token blacklist (use Redis in production)
        self._blacklisted_tokens: set = set()
        
        # Session management
        self._active_sessions: Dict[str, datetime] = {}
        
        # Initialize logger first
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
        
        # Initialize default users
        self._initialize_default_users()
    
    def _initialize_default_users(self):
        """Initialize default users for development and demo."""
        default_users = [
            {
                "id": "admin-001",
                "username": "admin",
                "email": "admin@pi5trading.local",
                "password": "admin123",
                "role": UserRole.ADMIN
            },
            {
                "id": "trader-001", 
                "username": "trader",
                "email": "trader@pi5trading.local",
                "password": "trader123",
                "role": UserRole.TRADER
            },
            {
                "id": "viewer-001",
                "username": "viewer",
                "email": "viewer@pi5trading.local", 
                "password": "viewer123",
                "role": UserRole.VIEWER
            }
        ]
        
        for user_data in default_users:
            user = User(
                id=user_data["id"],
                username=user_data["username"],
                email=user_data["email"],
                role=user_data["role"]
            )
            
            self._users[user.username] = user
            self._user_credentials[user.username] = self.hash_password(user_data["password"])
            
            self._logger.info(f"Initialized default user: {user.username} ({user.role.value})")
    
    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt."""
        return self.pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def get_user(self, username: str) -> Optional[User]:
        """Get user by username."""
        return self._users.get(username)
    
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        for user in self._users.values():
            if user.id == user_id:
                return user
        return None
    
    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """
        Authenticate user with username and password.
        
        Args:
            username: Username
            password: Plain text password
            
        Returns:
            User object if authentication successful, None otherwise
        """
        user = self.get_user(username)
        if not user:
            self._logger.warning(f"User not found: {username}")
            return None
        
        stored_password = self._user_credentials.get(username)
        if not stored_password:
            self._logger.warning(f"No password found for user: {username}")
            return None
        
        if not self.verify_password(password, stored_password):
            self._logger.warning(f"Invalid password for user: {username}")
            return None
        
        if not user.is_active:
            self._logger.warning(f"Inactive user attempted login: {username}")
            return None
        
        # Update last login
        user.last_login = datetime.utcnow()
        
        self._logger.info(f"User authenticated successfully: {username}")
        return user
    
    def create_access_token(self, user: User, expires_delta: Optional[timedelta] = None) -> str:
        """
        Create JWT access token.
        
        Args:
            user: User object
            expires_delta: Token expiration time
            
        Returns:
            JWT token string
        """
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + self.config.access_token_expire_delta
        
        payload = {
            "sub": user.username,
            "user_id": user.id,
            "role": user.role.value,
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access",
            "jti": f"{user.id}_{int(datetime.utcnow().timestamp())}"  # JWT ID for tracking
        }
        
        token = jwt.encode(payload, self.config.jwt_secret_key, algorithm=self.config.jwt_algorithm)
        
        # Track active session
        self._active_sessions[payload["jti"]] = expire
        
        self._logger.debug(f"Access token created for user: {user.username}")
        return token
    
    def create_refresh_token(self, user: User) -> str:
        """
        Create JWT refresh token.
        
        Args:
            user: User object
            
        Returns:
            JWT refresh token string
        """
        expire = datetime.utcnow() + self.config.refresh_token_expire_delta
        
        payload = {
            "sub": user.username,
            "user_id": user.id,
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "refresh",
            "jti": f"{user.id}_refresh_{int(datetime.utcnow().timestamp())}"
        }
        
        token = jwt.encode(payload, self.config.jwt_secret_key, algorithm=self.config.jwt_algorithm)
        
        self._logger.debug(f"Refresh token created for user: {user.username}")
        return token
    
    def create_login_response(self, user: User) -> LoginResponse:
        """
        Create login response with tokens and user info.
        
        Args:
            user: User object
            
        Returns:
            LoginResponse object
        """
        access_token = self.create_access_token(user)
        refresh_token = self.create_refresh_token(user)
        
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=self.config.access_token_expire_minutes * 60,
            user=user.to_user_info()
        )
    
    async def verify_token(self, token: str) -> Optional[User]:
        """
        Verify JWT token and return user.
        
        Args:
            token: JWT token string
            
        Returns:
            User object if token is valid, None otherwise
        """
        try:
            # Check if token is blacklisted
            if token in self._blacklisted_tokens:
                self._logger.warning("Attempt to use blacklisted token")
                return None
            
            # Decode token
            payload = jwt.decode(
                token,
                self.config.jwt_secret_key,
                algorithms=[self.config.jwt_algorithm]
            )
            
            # Extract username and validate token type
            username: str = payload.get("sub")
            token_type = payload.get("type")
            jti = payload.get("jti")
            
            if username is None:
                self._logger.warning("Token missing username")
                return None
            
            if token_type != "access":
                self._logger.warning(f"Invalid token type: {token_type}")
                return None
            
            # Check if session is active
            if jti and jti not in self._active_sessions:
                self._logger.warning("Token session not found or expired")
                return None
            
            # Get user
            user = self.get_user(username)
            if user is None or not user.is_active:
                self._logger.warning(f"User not found or inactive: {username}")
                return None
            
            return user
            
        except jwt.ExpiredSignatureError:
            self._logger.warning("Token has expired")
            return None
        except jwt.JWTError as e:
            self._logger.warning(f"Token validation failed: {e}")
            return None
        except Exception as e:
            self._logger.error(f"Unexpected error during token verification: {e}")
            return None
    
    async def refresh_access_token(self, refresh_token: str) -> Optional[LoginResponse]:
        """
        Refresh access token using refresh token.
        
        Args:
            refresh_token: JWT refresh token
            
        Returns:
            New LoginResponse if successful, None otherwise
        """
        try:
            # Check if token is blacklisted
            if refresh_token in self._blacklisted_tokens:
                self._logger.warning("Attempt to use blacklisted refresh token")
                return None
            
            # Decode refresh token
            payload = jwt.decode(
                refresh_token,
                self.config.jwt_secret_key,
                algorithms=[self.config.jwt_algorithm]
            )
            
            # Check token type
            token_type = payload.get("type")
            if token_type != "refresh":
                self._logger.warning(f"Invalid refresh token type: {token_type}")
                return None
            
            # Get user
            username = payload.get("sub")
            user = self.get_user(username)
            if not user or not user.is_active:
                self._logger.warning(f"User not found or inactive for refresh: {username}")
                return None
            
            # Create new login response
            return self.create_login_response(user)
            
        except jwt.ExpiredSignatureError:
            self._logger.warning("Refresh token has expired")
            return None
        except jwt.JWTError as e:
            self._logger.warning(f"Refresh token validation failed: {e}")
            return None
        except Exception as e:
            self._logger.error(f"Unexpected error during token refresh: {e}")
            return None
    
    def blacklist_token(self, token: str):
        """Add token to blacklist."""
        try:
            payload = jwt.decode(
                token,
                self.config.jwt_secret_key,
                algorithms=[self.config.jwt_algorithm],
                options={"verify_exp": False}  # Allow expired tokens for blacklisting
            )
            
            jti = payload.get("jti")
            if jti:
                # Remove from active sessions
                self._active_sessions.pop(jti, None)
            
        except jwt.JWTError:
            pass  # Token might be malformed, still blacklist it
        
        self._blacklisted_tokens.add(token)
        self._logger.info("Token blacklisted")
    
    async def login(self, username: str, password: str) -> Optional[LoginResponse]:
        """
        User login with username and password.
        
        Args:
            username: Username
            password: Password
            
        Returns:
            LoginResponse if login successful, None otherwise
        """
        user = self.authenticate_user(username, password)
        if not user:
            return None
        
        response = self.create_login_response(user)
        self._logger.info(f"User logged in successfully: {username}")
        return response
    
    async def logout(self, token: str):
        """
        User logout - blacklist the token.
        
        Args:
            token: Access token to blacklist
        """
        self.blacklist_token(token)
        self._logger.info("User logged out")
    
    def create_user(
        self,
        username: str,
        email: str,
        password: str,
        role: UserRole = UserRole.VIEWER
    ) -> User:
        """
        Create a new user.
        
        Args:
            username: Username
            email: Email address
            password: Plain text password
            role: User role
            
        Returns:
            Created User object
            
        Raises:
            AuthenticationError: If user already exists
        """
        if username in self._users:
            raise AuthenticationError(f"User {username} already exists")
        
        # Check for email uniqueness
        for user in self._users.values():
            if user.email == email:
                raise AuthenticationError(f"Email {email} already exists")
        
        user_id = f"{role.value}-{len(self._users) + 1:03d}"
        user = User(
            id=user_id,
            username=username,
            email=email,
            role=role
        )
        
        self._users[username] = user
        self._user_credentials[username] = self.hash_password(password)
        
        self._logger.info(f"User created: {username} ({role.value})")
        return user
    
    def update_user_password(self, username: str, old_password: str, new_password: str) -> bool:
        """
        Update user password.
        
        Args:
            username: Username
            old_password: Current password
            new_password: New password
            
        Returns:
            True if password updated successfully
        """
        user = self.get_user(username)
        if not user:
            return False
        
        stored_password = self._user_credentials.get(username)
        if not stored_password or not self.verify_password(old_password, stored_password):
            return False
        
        self._user_credentials[username] = self.hash_password(new_password)
        self._logger.info(f"Password updated for user: {username}")
        return True
    
    def deactivate_user(self, username: str) -> bool:
        """Deactivate a user."""
        user = self.get_user(username)
        if not user:
            return False
        
        user.is_active = False
        self._logger.info(f"User deactivated: {username}")
        return True
    
    def activate_user(self, username: str) -> bool:
        """Activate a user."""
        user = self.get_user(username)
        if not user:
            return False
        
        user.is_active = True
        self._logger.info(f"User activated: {username}")
        return True
    
    def list_users(self) -> List[UserInfo]:
        """List all users."""
        return [user.to_user_info() for user in self._users.values()]
    
    def cleanup_expired_sessions(self):
        """Clean up expired sessions and blacklisted tokens."""
        now = datetime.utcnow()
        
        # Clean expired sessions
        expired_sessions = [
            jti for jti, expires_at in self._active_sessions.items()
            if expires_at < now
        ]
        
        for jti in expired_sessions:
            del self._active_sessions[jti]
        
        if expired_sessions:
            self._logger.info(f"Cleaned up {len(expired_sessions)} expired sessions")
        
        # Clean old blacklisted tokens (keep for 24 hours)
        # In production, this would be handled by Redis TTL
        if len(self._blacklisted_tokens) > 1000:
            # Simple cleanup - remove half of the tokens
            tokens_to_remove = list(self._blacklisted_tokens)[::2]
            for token in tokens_to_remove:
                self._blacklisted_tokens.discard(token)
            
            self._logger.info(f"Cleaned up {len(tokens_to_remove)} old blacklisted tokens")
    
    def get_auth_stats(self) -> Dict[str, Any]:
        """Get authentication statistics."""
        active_users = sum(1 for user in self._users.values() if user.is_active)
        role_counts = {}
        
        for user in self._users.values():
            role_counts[user.role.value] = role_counts.get(user.role.value, 0) + 1
        
        return {
            "total_users": len(self._users),
            "active_users": active_users,
            "inactive_users": len(self._users) - active_users,
            "role_distribution": role_counts,
            "active_sessions": len(self._active_sessions),
            "blacklisted_tokens": len(self._blacklisted_tokens)
        }