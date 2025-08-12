"""
Base repository implementation for Pi5 Trading System.

Provides abstract base class for all repositories with common CRUD operations,
query building utilities, and consistent error handling.

Features:
- Generic CRUD operations with type hints
- Query builder utilities for complex queries
- Automatic connection management
- Consistent error handling and logging
- Transaction support with context managers
"""

import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional, Type, TypeVar, Union

import asyncpg

from core.exceptions import (
    DatabaseError,
    PositionNotFoundError,
    OrderNotFoundError,
    StrategyNotFoundError,
)
from database.connection_manager import DatabaseManager


logger = logging.getLogger(__name__)

T = TypeVar('T')


class BaseRepository(ABC):
    """
    Abstract base repository for data access operations.
    
    Provides common CRUD operations and utilities for all repositories
    with consistent error handling and connection management.
    """
    
    def __init__(self, db_manager: DatabaseManager, table_name: str):
        """
        Initialize base repository.
        
        Args:
            db_manager: Database connection manager
            table_name: Primary table name for this repository
        """
        self.db = db_manager
        self.table_name = table_name
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def create(self, data: Dict[str, Any]) -> str:
        """
        Create a new record.
        
        Args:
            data: Record data dictionary
            
        Returns:
            Created record ID
        """
        try:
            # Generate UUID if not provided
            if 'id' not in data:
                data['id'] = str(uuid.uuid4())
            
            # Add timestamp fields if not provided
            now = datetime.utcnow()
            if 'created_at' not in data:
                data['created_at'] = now
            if 'updated_at' not in data and self._has_updated_at_column():
                data['updated_at'] = now
            
            columns = list(data.keys())
            values = list(data.values())
            placeholders = ', '.join(f'${i+1}' for i in range(len(values)))
            
            query = f"""
                INSERT INTO {self.table_name} ({', '.join(columns)})
                VALUES ({placeholders})
                RETURNING id
            """
            
            result = await self.db.fetchval(query, *values)
            
            self._logger.debug(f"Created record in {self.table_name} with ID: {result}")
            return result
            
        except Exception as e:
            self._logger.error(f"Failed to create record in {self.table_name}: {e}")
            raise DatabaseError(
                f"Failed to create record in {self.table_name}: {e}",
                context={'table': self.table_name, 'data_keys': list(data.keys())}
            ) from e
    
    async def get_by_id(self, record_id: str) -> Optional[asyncpg.Record]:
        """
        Get record by ID.
        
        Args:
            record_id: Record ID to fetch
            
        Returns:
            Database record or None if not found
        """
        try:
            query = f"SELECT * FROM {self.table_name} WHERE id = $1"
            result = await self.db.fetchrow(query, record_id)
            
            if result:
                self._logger.debug(f"Found record in {self.table_name} with ID: {record_id}")
            else:
                self._logger.debug(f"No record found in {self.table_name} with ID: {record_id}")
                
            return result
            
        except Exception as e:
            self._logger.error(f"Failed to get record from {self.table_name} by ID {record_id}: {e}")
            raise DatabaseError(
                f"Failed to get record from {self.table_name}: {e}",
                context={'table': self.table_name, 'record_id': record_id}
            ) from e
    
    async def update(self, record_id: str, data: Dict[str, Any]) -> bool:
        """
        Update record by ID.
        
        Args:
            record_id: Record ID to update
            data: Updated data dictionary
            
        Returns:
            True if record was updated, False if not found
        """
        try:
            if not data:
                return False
            
            # Add updated_at if column exists
            if self._has_updated_at_column() and 'updated_at' not in data:
                data['updated_at'] = datetime.utcnow()
            
            # Build SET clause
            set_clauses = []
            values = []
            for i, (key, value) in enumerate(data.items(), 1):
                set_clauses.append(f"{key} = ${i}")
                values.append(value)
            
            values.append(record_id)  # For WHERE clause
            
            query = f"""
                UPDATE {self.table_name} 
                SET {', '.join(set_clauses)}
                WHERE id = ${len(values)}
            """
            
            result = await self.db.execute(query, *values)
            
            # Check if any rows were affected
            affected_rows = int(result.split()[-1]) if result.startswith('UPDATE') else 0
            success = affected_rows > 0
            
            if success:
                self._logger.debug(f"Updated record in {self.table_name} with ID: {record_id}")
            else:
                self._logger.debug(f"No record updated in {self.table_name} with ID: {record_id}")
                
            return success
            
        except Exception as e:
            self._logger.error(f"Failed to update record in {self.table_name} with ID {record_id}: {e}")
            raise DatabaseError(
                f"Failed to update record in {self.table_name}: {e}",
                context={'table': self.table_name, 'record_id': record_id, 'data_keys': list(data.keys())}
            ) from e
    
    async def delete(self, record_id: str) -> bool:
        """
        Delete record by ID.
        
        Args:
            record_id: Record ID to delete
            
        Returns:
            True if record was deleted, False if not found
        """
        try:
            query = f"DELETE FROM {self.table_name} WHERE id = $1"
            result = await self.db.execute(query, record_id)
            
            # Check if any rows were affected
            affected_rows = int(result.split()[-1]) if result.startswith('DELETE') else 0
            success = affected_rows > 0
            
            if success:
                self._logger.debug(f"Deleted record from {self.table_name} with ID: {record_id}")
            else:
                self._logger.debug(f"No record deleted from {self.table_name} with ID: {record_id}")
                
            return success
            
        except Exception as e:
            self._logger.error(f"Failed to delete record from {self.table_name} with ID {record_id}: {e}")
            raise DatabaseError(
                f"Failed to delete record from {self.table_name}: {e}",
                context={'table': self.table_name, 'record_id': record_id}
            ) from e
    
    async def list_all(
        self,
        limit: Optional[int] = None,
        offset: int = 0,
        order_by: str = "created_at DESC"
    ) -> List[asyncpg.Record]:
        """
        List all records with pagination.
        
        Args:
            limit: Maximum number of records to return
            offset: Number of records to skip
            order_by: ORDER BY clause
            
        Returns:
            List of database records
        """
        try:
            query_parts = [f"SELECT * FROM {self.table_name}"]
            query_values = []
            
            if order_by:
                query_parts.append(f"ORDER BY {order_by}")
            
            if limit is not None:
                query_parts.append(f"LIMIT ${len(query_values) + 1}")
                query_values.append(limit)
            
            if offset > 0:
                query_parts.append(f"OFFSET ${len(query_values) + 1}")
                query_values.append(offset)
            
            query = " ".join(query_parts)
            results = await self.db.fetch(query, *query_values)
            
            self._logger.debug(f"Listed {len(results)} records from {self.table_name}")
            return results
            
        except Exception as e:
            self._logger.error(f"Failed to list records from {self.table_name}: {e}")
            raise DatabaseError(
                f"Failed to list records from {self.table_name}: {e}",
                context={'table': self.table_name, 'limit': limit, 'offset': offset}
            ) from e
    
    async def count(self, where_clause: Optional[str] = None, where_values: Optional[List[Any]] = None) -> int:
        """
        Count records with optional WHERE clause.
        
        Args:
            where_clause: Optional WHERE clause
            where_values: Values for WHERE clause parameters
            
        Returns:
            Count of matching records
        """
        try:
            query_parts = [f"SELECT COUNT(*) FROM {self.table_name}"]
            query_values = where_values or []
            
            if where_clause:
                query_parts.append(f"WHERE {where_clause}")
            
            query = " ".join(query_parts)
            result = await self.db.fetchval(query, *query_values)
            
            self._logger.debug(f"Counted {result} records from {self.table_name}")
            return result
            
        except Exception as e:
            self._logger.error(f"Failed to count records from {self.table_name}: {e}")
            raise DatabaseError(
                f"Failed to count records from {self.table_name}: {e}",
                context={'table': self.table_name, 'where_clause': where_clause}
            ) from e
    
    async def exists(self, record_id: str) -> bool:
        """
        Check if record exists by ID.
        
        Args:
            record_id: Record ID to check
            
        Returns:
            True if record exists, False otherwise
        """
        try:
            query = f"SELECT 1 FROM {self.table_name} WHERE id = $1 LIMIT 1"
            result = await self.db.fetchval(query, record_id)
            return result is not None
            
        except Exception as e:
            self._logger.error(f"Failed to check existence in {self.table_name} for ID {record_id}: {e}")
            raise DatabaseError(
                f"Failed to check record existence in {self.table_name}: {e}",
                context={'table': self.table_name, 'record_id': record_id}
            ) from e
    
    async def find_by(
        self,
        where_clause: str,
        where_values: List[Any],
        limit: Optional[int] = None,
        order_by: Optional[str] = None
    ) -> List[asyncpg.Record]:
        """
        Find records by custom WHERE clause.
        
        Args:
            where_clause: WHERE clause (without 'WHERE' keyword)
            where_values: Values for WHERE clause parameters
            limit: Maximum number of records to return
            order_by: ORDER BY clause
            
        Returns:
            List of matching database records
        """
        try:
            query_parts = [f"SELECT * FROM {self.table_name} WHERE {where_clause}"]
            query_values = list(where_values)
            
            if order_by:
                query_parts.append(f"ORDER BY {order_by}")
            
            if limit is not None:
                query_parts.append(f"LIMIT ${len(query_values) + 1}")
                query_values.append(limit)
            
            query = " ".join(query_parts)
            results = await self.db.fetch(query, *query_values)
            
            self._logger.debug(f"Found {len(results)} records from {self.table_name}")
            return results
            
        except Exception as e:
            self._logger.error(f"Failed to find records from {self.table_name}: {e}")
            raise DatabaseError(
                f"Failed to find records from {self.table_name}: {e}",
                context={'table': self.table_name, 'where_clause': where_clause}
            ) from e
    
    async def find_one_by(
        self,
        where_clause: str,
        where_values: List[Any]
    ) -> Optional[asyncpg.Record]:
        """
        Find single record by custom WHERE clause.
        
        Args:
            where_clause: WHERE clause (without 'WHERE' keyword)
            where_values: Values for WHERE clause parameters
            
        Returns:
            Database record or None if not found
        """
        results = await self.find_by(where_clause, where_values, limit=1)
        return results[0] if results else None
    
    async def bulk_create(self, records: List[Dict[str, Any]]) -> List[str]:
        """
        Create multiple records in a single transaction.
        
        Args:
            records: List of record data dictionaries
            
        Returns:
            List of created record IDs
        """
        if not records:
            return []
        
        try:
            async with self.db.transaction() as tx:
                created_ids = []
                
                for record_data in records:
                    # Generate UUID if not provided
                    if 'id' not in record_data:
                        record_data['id'] = str(uuid.uuid4())
                    
                    # Add timestamp fields
                    now = datetime.utcnow()
                    if 'created_at' not in record_data:
                        record_data['created_at'] = now
                    if 'updated_at' not in record_data and self._has_updated_at_column():
                        record_data['updated_at'] = now
                    
                    columns = list(record_data.keys())
                    values = list(record_data.values())
                    placeholders = ', '.join(f'${i+1}' for i in range(len(values)))
                    
                    query = f"""
                        INSERT INTO {self.table_name} ({', '.join(columns)})
                        VALUES ({placeholders})
                        RETURNING id
                    """
                    
                    record_id = await tx.fetchval(query, *values)
                    created_ids.append(record_id)
                
                self._logger.debug(f"Bulk created {len(created_ids)} records in {self.table_name}")
                return created_ids
                
        except Exception as e:
            self._logger.error(f"Failed to bulk create records in {self.table_name}: {e}")
            raise DatabaseError(
                f"Failed to bulk create records in {self.table_name}: {e}",
                context={'table': self.table_name, 'record_count': len(records)}
            ) from e
    
    def _has_updated_at_column(self) -> bool:
        """
        Check if table has updated_at column.
        Override in subclasses if table doesn't follow convention.
        
        Returns:
            True if table has updated_at column
        """
        # Most tables have updated_at, override in subclasses that don't
        return self.table_name not in ['market_data', 'realtime_quotes', 'system_events', 'strategy_performance']
    
    def _build_where_clause(
        self,
        filters: Dict[str, Any],
        start_param_idx: int = 1
    ) -> tuple[str, List[Any]]:
        """
        Build WHERE clause from filters dictionary.
        
        Args:
            filters: Dictionary of column: value filters
            start_param_idx: Starting parameter index for SQL placeholders
            
        Returns:
            Tuple of (where_clause, parameter_values)
        """
        if not filters:
            return "", []
        
        clauses = []
        values = []
        param_idx = start_param_idx
        
        for column, value in filters.items():
            if value is None:
                clauses.append(f"{column} IS NULL")
            elif isinstance(value, (list, tuple)):
                # IN clause for multiple values
                placeholders = ', '.join(f'${param_idx + i}' for i in range(len(value)))
                clauses.append(f"{column} IN ({placeholders})")
                values.extend(value)
                param_idx += len(value)
            else:
                clauses.append(f"{column} = ${param_idx}")
                values.append(value)
                param_idx += 1
        
        where_clause = " AND ".join(clauses)
        return where_clause, values