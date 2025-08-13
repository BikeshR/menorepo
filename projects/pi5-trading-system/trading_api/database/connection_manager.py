"""
Database connection manager for Pi5 Trading System.

Provides async database connection management with connection pooling,
health monitoring, and automatic reconnection for TimescaleDB.

Features:
- Async connection pooling with asyncpg
- Connection health monitoring and recovery
- Transaction management with context managers
- Query performance monitoring and logging
- Graceful shutdown with connection cleanup
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta

import asyncpg
from asyncpg.pool import Pool

from core.exceptions import (
    DatabaseConnectionError,
    DatabaseError,
    ConfigurationError,
)


logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    Async database connection manager with pooling and health monitoring.
    
    Manages database connections to TimescaleDB with automatic reconnection,
    connection pooling, and health checks for high availability.
    """
    
    def __init__(
        self,
        database_url: str,
        min_connections: int = 5,
        max_connections: int = 20,
        max_queries: int = 50000,
        max_inactive_connection_lifetime: float = 300.0,
        timeout: float = 30.0,
        retry_attempts: int = 3,
        retry_delay: float = 1.0,
    ):
        """
        Initialize database manager.
        
        Args:
            database_url: PostgreSQL connection URL
            min_connections: Minimum connections in pool
            max_connections: Maximum connections in pool
            max_queries: Max queries per connection before refresh
            max_inactive_connection_lifetime: Max idle time in seconds
            timeout: Connection timeout in seconds
            retry_attempts: Number of retry attempts for failed operations
            retry_delay: Delay between retry attempts in seconds
        """
        self.database_url = database_url
        self.min_connections = min_connections
        self.max_connections = max_connections
        self.max_queries = max_queries
        self.max_inactive_connection_lifetime = max_inactive_connection_lifetime
        self.timeout = timeout
        self.retry_attempts = retry_attempts
        self.retry_delay = retry_delay
        
        self._pool: Optional[Pool] = None
        self._is_connected = False
        self._connection_attempts = 0
        self._last_health_check: Optional[datetime] = None
        self._health_check_interval = timedelta(seconds=30)
        self._stats = {
            'total_queries': 0,
            'failed_queries': 0,
            'total_connections': 0,
            'failed_connections': 0,
            'last_error': None,
        }
    
    async def initialize(self) -> None:
        """Initialize database connection pool with retry logic."""
        last_error = None
        
        for attempt in range(self.retry_attempts):
            try:
                if attempt > 0:
                    wait_time = self.retry_delay * (2 ** (attempt - 1))  # Exponential backoff
                    logger.info(f"Database connection attempt {attempt + 1}/{self.retry_attempts} (waiting {wait_time}s)")
                    await asyncio.sleep(wait_time)
                else:
                    logger.info("Initializing database connection pool...")
                
                # Validate database URL
                if not self.database_url:
                    raise ConfigurationError("Database URL not configured")
                
                # Create connection pool
                self._pool = await asyncpg.create_pool(
                    self.database_url,
                    min_size=self.min_connections,
                    max_size=self.max_connections,
                    max_queries=self.max_queries,
                    max_inactive_connection_lifetime=self.max_inactive_connection_lifetime,
                    timeout=self.timeout,
                    command_timeout=self.timeout,
                    server_settings={
                        'application_name': 'pi5_trading_system',
                        'timezone': 'UTC',
                    }
                )
                
                self._is_connected = True
                self._connection_attempts = 0
                self._last_health_check = datetime.utcnow()
                self._stats['total_connections'] += 1
                
                # Verify TimescaleDB extension
                await self._verify_timescaledb()
                
                logger.info(
                    f"Database connection pool initialized "
                    f"({self.min_connections}-{self.max_connections} connections)"
                )
                return  # Success - exit retry loop
                
            except Exception as e:
                last_error = e
                self._stats['failed_connections'] += 1
                self._stats['last_error'] = str(e)
                logger.warning(f"Database connection attempt {attempt + 1} failed: {e}")
                
                if attempt < self.retry_attempts - 1:
                    continue  # Try again
        
        # All attempts failed
        self._is_connected = False
        logger.error(f"Failed to initialize database connection after {self.retry_attempts} attempts")
        raise DatabaseConnectionError(
            f"Failed to initialize database connection after {self.retry_attempts} attempts: {last_error}",
            context={'database_url': self.database_url, 'attempts': self.retry_attempts}
        ) from last_error
    
    async def close(self) -> None:
        """Close database connection pool."""
        try:
            if self._pool:
                logger.info("Closing database connection pool...")
                await self._pool.close()
                self._pool = None
                self._is_connected = False
                logger.info("Database connection pool closed")
        except Exception as e:
            logger.error(f"Error closing database connection: {e}")
            raise DatabaseError(f"Error closing database connection: {e}") from e
    
    @property
    def is_connected(self) -> bool:
        """Check if database is connected."""
        return self._is_connected and self._pool is not None
    
    @property
    def stats(self) -> Dict[str, Any]:
        """Get connection statistics."""
        pool_stats = {}
        if self._pool:
            pool_stats = {
                'pool_size': self._pool.get_size(),
                'pool_min_size': self._pool.get_min_size(),
                'pool_max_size': self._pool.get_max_size(),
                'pool_idle_size': self._pool.get_idle_size(),
            }
        
        return {
            **self._stats,
            **pool_stats,
            'is_connected': self._is_connected,
            'last_health_check': self._last_health_check.isoformat() if self._last_health_check else None,
        }
    
    async def health_check(self) -> bool:
        """
        Perform database health check.
        
        Returns:
            True if database is healthy, False otherwise
        """
        try:
            if not self.is_connected:
                return False
            
            async with self._pool.acquire() as conn:
                # Test basic connectivity and TimescaleDB
                result = await conn.fetchval(
                    "SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'"
                )
                
                if result != 1:
                    logger.warning("TimescaleDB extension not found")
                    return False
                
                self._last_health_check = datetime.utcnow()
                return True
                
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            self._stats['last_error'] = str(e)
            return False
    
    async def execute(
        self,
        query: str,
        *args,
        timeout: Optional[float] = None,
    ) -> str:
        """
        Execute a SQL command.
        
        Args:
            query: SQL query to execute
            *args: Query parameters
            timeout: Query timeout override
            
        Returns:
            Command status string
        """
        return await self._execute_with_retry(
            lambda conn: conn.execute(query, *args, timeout=timeout or self.timeout),
            query,
            args
        )
    
    async def fetch(
        self,
        query: str,
        *args,
        timeout: Optional[float] = None,
    ) -> List[asyncpg.Record]:
        """
        Fetch multiple rows from query.
        
        Args:
            query: SQL query to execute
            *args: Query parameters
            timeout: Query timeout override
            
        Returns:
            List of database records
        """
        return await self._execute_with_retry(
            lambda conn: conn.fetch(query, *args, timeout=timeout or self.timeout),
            query,
            args
        )
    
    async def fetchrow(
        self,
        query: str,
        *args,
        timeout: Optional[float] = None,
    ) -> Optional[asyncpg.Record]:
        """
        Fetch a single row from query.
        
        Args:
            query: SQL query to execute
            *args: Query parameters  
            timeout: Query timeout override
            
        Returns:
            Database record or None
        """
        return await self._execute_with_retry(
            lambda conn: conn.fetchrow(query, *args, timeout=timeout or self.timeout),
            query,
            args
        )
    
    async def fetchval(
        self,
        query: str,
        *args,
        timeout: Optional[float] = None,
    ) -> Any:
        """
        Fetch a single value from query.
        
        Args:
            query: SQL query to execute
            *args: Query parameters
            timeout: Query timeout override
            
        Returns:
            Single value or None
        """
        return await self._execute_with_retry(
            lambda conn: conn.fetchval(query, *args, timeout=timeout or self.timeout),
            query,
            args
        )
    
    async def executemany(
        self,
        query: str,
        args_list: List[tuple],
        timeout: Optional[float] = None,
    ) -> None:
        """
        Execute query with multiple parameter sets.
        
        Args:
            query: SQL query to execute
            args_list: List of parameter tuples
            timeout: Query timeout override
        """
        await self._execute_with_retry(
            lambda conn: conn.executemany(query, args_list, timeout=timeout or self.timeout),
            query,
            args_list
        )
    
    @asynccontextmanager
    async def transaction(self, isolation: str = 'read_committed'):
        """
        Database transaction context manager.
        
        Args:
            isolation: Transaction isolation level
            
        Usage:
            async with db.transaction():
                await db.execute("INSERT INTO...")
                await db.execute("UPDATE...")
        """
        if not self.is_connected:
            raise DatabaseConnectionError("Database not connected")
        
        async with self._pool.acquire() as conn:
            async with conn.transaction(isolation=isolation):
                # Create a temporary connection wrapper for transaction context
                transaction_manager = _TransactionManager(conn, self)
                try:
                    yield transaction_manager
                except Exception:
                    # Transaction will be rolled back automatically
                    raise
    
    async def _execute_with_retry(
        self,
        operation,
        query: str,
        args: Union[tuple, List[tuple]],
    ) -> Any:
        """Execute database operation with retry logic."""
        last_exception = None
        
        for attempt in range(self.retry_attempts):
            try:
                if not self.is_connected:
                    raise DatabaseConnectionError("Database not connected")
                
                async with self._pool.acquire() as conn:
                    start_time = datetime.utcnow()
                    result = await operation(conn)
                    duration = (datetime.utcnow() - start_time).total_seconds()
                    
                    self._stats['total_queries'] += 1
                    
                    # Log slow queries
                    if duration > 1.0:
                        logger.warning(
                            f"Slow query detected: {duration:.2f}s - {query[:100]}..."
                        )
                    
                    return result
                    
            except (asyncpg.PostgresError, asyncpg.InterfaceError) as e:
                last_exception = e
                self._stats['failed_queries'] += 1
                self._stats['last_error'] = str(e)
                
                logger.warning(
                    f"Database operation failed (attempt {attempt + 1}/{self.retry_attempts}): {e}"
                )
                
                if attempt < self.retry_attempts - 1:
                    await asyncio.sleep(self.retry_delay * (attempt + 1))
                    
                    # Try to reconnect on connection errors
                    if isinstance(e, asyncpg.InterfaceError):
                        await self._attempt_reconnection()
                else:
                    break
            
            except Exception as e:
                # Non-recoverable error
                self._stats['failed_queries'] += 1
                self._stats['last_error'] = str(e)
                logger.error(f"Database operation failed with non-recoverable error: {e}")
                raise DatabaseError(
                    f"Database operation failed: {e}",
                    context={'query': query[:100], 'args_count': len(args) if args else 0}
                ) from e
        
        # All retries failed
        logger.error(f"Database operation failed after {self.retry_attempts} attempts")
        raise DatabaseError(
            f"Database operation failed after {self.retry_attempts} attempts: {last_exception}",
            context={'query': query[:100], 'last_error': str(last_exception)}
        ) from last_exception
    
    async def _verify_timescaledb(self) -> None:
        """Verify TimescaleDB extension is available."""
        try:
            result = await self.fetchval(
                "SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'"
            )
            if result != 1:
                logger.warning(
                    "TimescaleDB extension not found. "
                    "Some time-series optimizations may not be available."
                )
        except Exception as e:
            logger.warning(f"Could not verify TimescaleDB extension: {e}")
    
    async def _attempt_reconnection(self) -> None:
        """Attempt to reconnect to database."""
        try:
            logger.info("Attempting database reconnection...")
            await self.close()
            await asyncio.sleep(self.retry_delay)
            await self.initialize()
            logger.info("Database reconnection successful")
        except Exception as e:
            logger.error(f"Database reconnection failed: {e}")


class _TransactionManager:
    """Internal transaction manager for scoped database operations."""
    
    def __init__(self, connection: asyncpg.Connection, db_manager: DatabaseManager):
        self._conn = connection
        self._db_manager = db_manager
    
    async def execute(self, query: str, *args, timeout: Optional[float] = None) -> str:
        """Execute query within transaction."""
        try:
            self._db_manager._stats['total_queries'] += 1
            return await self._conn.execute(query, *args, timeout=timeout)
        except Exception as e:
            self._db_manager._stats['failed_queries'] += 1
            self._db_manager._stats['last_error'] = str(e)
            raise
    
    async def fetch(self, query: str, *args, timeout: Optional[float] = None) -> List[asyncpg.Record]:
        """Fetch rows within transaction."""
        try:
            self._db_manager._stats['total_queries'] += 1
            return await self._conn.fetch(query, *args, timeout=timeout)
        except Exception as e:
            self._db_manager._stats['failed_queries'] += 1
            self._db_manager._stats['last_error'] = str(e)
            raise
    
    async def fetchrow(self, query: str, *args, timeout: Optional[float] = None) -> Optional[asyncpg.Record]:
        """Fetch single row within transaction."""
        try:
            self._db_manager._stats['total_queries'] += 1
            return await self._conn.fetchrow(query, *args, timeout=timeout)
        except Exception as e:
            self._db_manager._stats['failed_queries'] += 1
            self._db_manager._stats['last_error'] = str(e)
            raise
    
    async def fetchval(self, query: str, *args, timeout: Optional[float] = None) -> Any:
        """Fetch single value within transaction."""
        try:
            self._db_manager._stats['total_queries'] += 1
            return await self._conn.fetchval(query, *args, timeout=timeout)
        except Exception as e:
            self._db_manager._stats['failed_queries'] += 1
            self._db_manager._stats['last_error'] = str(e)
            raise