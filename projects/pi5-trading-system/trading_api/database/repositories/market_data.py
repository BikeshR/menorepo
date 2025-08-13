"""
Market data repository for Pi5 Trading System.

Handles time-series market data operations with TimescaleDB optimization.
Provides efficient storage and querying of OHLCV data, real-time quotes,
and market statistics.

Features:
- Efficient time-series data insertion and querying
- OHLCV data aggregation and resampling
- Real-time quote management with deduplication
- Market data quality validation
- Historical data range queries with TimescaleDB optimization
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import asyncpg
import pandas as pd
from typing import TYPE_CHECKING

from core.exceptions import (
    DataQualityError,
    DataNotFoundError,
    DatabaseError,
)
from database.repositories.base import BaseRepository

if TYPE_CHECKING:
    from database.connection_manager import DatabaseManager


logger = logging.getLogger(__name__)


class MarketDataRepository(BaseRepository):
    """
    Repository for market data and time-series operations.
    
    Handles OHLCV data, real-time quotes, and market statistics
    with TimescaleDB optimization for efficient time-series queries.
    """
    
    def __init__(self, db_manager: "DatabaseManager"):
        """Initialize market data repository."""
        super().__init__(db_manager, "market_data")
    
    async def insert_ohlcv_data(
        self,
        symbol: str,
        timestamp: datetime,
        open_price: float,
        high_price: float,
        low_price: float,
        close_price: float,
        volume: int,
        interval_type: str = "1min",
        source: str = "unknown",
        vwap: Optional[float] = None,
        trade_count: Optional[int] = None
    ) -> str:
        """
        Insert OHLCV market data record.
        
        Args:
            symbol: Trading symbol
            timestamp: Data timestamp
            open_price: Opening price
            high_price: High price
            low_price: Low price  
            close_price: Closing price
            volume: Volume
            interval_type: Time interval (1min, 5min, 1h, 1d, etc.)
            source: Data source identifier
            vwap: Volume weighted average price
            trade_count: Number of trades
            
        Returns:
            Inserted record ID
        """
        try:
            # Validate OHLC price relationships
            self._validate_ohlc_prices(open_price, high_price, low_price, close_price)
            
            data = {
                'time': timestamp,
                'symbol': symbol.upper(),
                'open_price': open_price,
                'high_price': high_price,
                'low_price': low_price,
                'close_price': close_price,
                'volume': volume,
                'interval_type': interval_type,
                'source': source,
                'vwap': vwap,
                'trade_count': trade_count,
            }
            
            # Use UPSERT to handle duplicate timestamps
            query = """
                INSERT INTO market_data (
                    time, symbol, open_price, high_price, low_price, close_price,
                    volume, interval_type, source, vwap, trade_count
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (time, symbol, interval_type, source) 
                DO UPDATE SET
                    open_price = EXCLUDED.open_price,
                    high_price = EXCLUDED.high_price,
                    low_price = EXCLUDED.low_price,
                    close_price = EXCLUDED.close_price,
                    volume = EXCLUDED.volume,
                    vwap = EXCLUDED.vwap,
                    trade_count = EXCLUDED.trade_count,
                    created_at = NOW()
                RETURNING id
            """
            
            result = await self.db.fetchval(
                query,
                timestamp, symbol.upper(), open_price, high_price, low_price, 
                close_price, volume, interval_type, source, vwap, trade_count
            )
            
            self._logger.debug(f"Inserted OHLCV data for {symbol} at {timestamp}")
            return result
            
        except Exception as e:
            self._logger.error(f"Failed to insert OHLCV data for {symbol}: {e}")
            raise DatabaseError(
                f"Failed to insert OHLCV data: {e}",
                context={'symbol': symbol, 'timestamp': timestamp.isoformat()}
            ) from e
    
    async def bulk_insert_ohlcv(self, ohlcv_records: List[Dict]) -> int:
        """
        Bulk insert OHLCV records for efficient data loading.
        
        Args:
            ohlcv_records: List of OHLCV data dictionaries
            
        Returns:
            Number of records inserted
        """
        if not ohlcv_records:
            return 0
        
        try:
            async with self.db.transaction() as tx:
                query = """
                    INSERT INTO market_data (
                        time, symbol, open_price, high_price, low_price, close_price,
                        volume, interval_type, source, vwap, trade_count
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (time, symbol, interval_type, source) 
                    DO UPDATE SET
                        open_price = EXCLUDED.open_price,
                        high_price = EXCLUDED.high_price,
                        low_price = EXCLUDED.low_price,
                        close_price = EXCLUDED.close_price,
                        volume = EXCLUDED.volume,
                        vwap = EXCLUDED.vwap,
                        trade_count = EXCLUDED.trade_count,
                        created_at = NOW()
                """
                
                args_list = []
                for record in ohlcv_records:
                    # Validate required fields
                    required_fields = ['time', 'symbol', 'open_price', 'high_price', 'low_price', 'close_price', 'volume']
                    for field in required_fields:
                        if field not in record:
                            raise ValueError(f"Missing required field: {field}")
                    
                    # Validate OHLC relationships
                    self._validate_ohlc_prices(
                        record['open_price'], record['high_price'], 
                        record['low_price'], record['close_price']
                    )
                    
                    args_list.append((
                        record['time'],
                        record['symbol'].upper(),
                        record['open_price'],
                        record['high_price'],
                        record['low_price'], 
                        record['close_price'],
                        record['volume'],
                        record.get('interval_type', '1min'),
                        record.get('source', 'bulk_import'),
                        record.get('vwap'),
                        record.get('trade_count')
                    ))
                
                await tx.executemany(query, args_list)
                
                count = len(args_list)
                self._logger.info(f"Bulk inserted {count} OHLCV records")
                return count
                
        except Exception as e:
            self._logger.error(f"Failed to bulk insert OHLCV records: {e}")
            raise DatabaseError(
                f"Failed to bulk insert OHLCV records: {e}",
                context={'record_count': len(ohlcv_records)}
            ) from e
    
    async def get_historical_data(
        self,
        symbol: str,
        start_time: datetime,
        end_time: datetime,
        interval_type: str = "1min",
        source: Optional[str] = None
    ) -> List[asyncpg.Record]:
        """
        Get historical OHLCV data for time range.
        
        Args:
            symbol: Trading symbol
            start_time: Start timestamp
            end_time: End timestamp  
            interval_type: Time interval
            source: Optional data source filter
            
        Returns:
            List of OHLCV records ordered by time
        """
        try:
            query_parts = [
                """
                SELECT time, symbol, open_price, high_price, low_price, close_price,
                       volume, vwap, trade_count, interval_type, source
                FROM market_data
                WHERE symbol = $1 AND time >= $2 AND time <= $3 AND interval_type = $4
                """
            ]
            query_values = [symbol.upper(), start_time, end_time, interval_type]
            
            if source:
                query_parts.append("AND source = $5")
                query_values.append(source)
                
            query_parts.append("ORDER BY time ASC")
            query = " ".join(query_parts)
            
            results = await self.db.fetch(query, *query_values)
            
            self._logger.debug(
                f"Retrieved {len(results)} historical records for {symbol} "
                f"from {start_time} to {end_time}"
            )
            return results
            
        except Exception as e:
            self._logger.error(
                f"Failed to get historical data for {symbol}: {e}"
            )
            raise DatabaseError(
                f"Failed to get historical data: {e}",
                context={
                    'symbol': symbol,
                    'start_time': start_time.isoformat(),
                    'end_time': end_time.isoformat()
                }
            ) from e
    
    async def get_latest_prices(self, symbols: List[str]) -> Dict[str, Dict]:
        """
        Get latest prices for multiple symbols.
        
        Args:
            symbols: List of trading symbols
            
        Returns:
            Dictionary mapping symbol to latest price data
        """
        try:
            if not symbols:
                return {}
            
            # Use window functions to get latest record per symbol
            placeholders = ', '.join(f'${i+1}' for i in range(len(symbols)))
            query = f"""
                SELECT DISTINCT ON (symbol) 
                       symbol, time, close_price, volume, high_price, low_price
                FROM market_data
                WHERE symbol = ANY($1)
                ORDER BY symbol, time DESC
            """
            
            results = await self.db.fetch(query, [s.upper() for s in symbols])
            
            price_data = {}
            for record in results:
                price_data[record['symbol']] = {
                    'price': float(record['close_price']),
                    'timestamp': record['time'],
                    'volume': int(record['volume']),
                    'high': float(record['high_price']),
                    'low': float(record['low_price']),
                }
            
            self._logger.debug(f"Retrieved latest prices for {len(price_data)} symbols")
            return price_data
            
        except Exception as e:
            self._logger.error(f"Failed to get latest prices: {e}")
            raise DatabaseError(
                f"Failed to get latest prices: {e}",
                context={'symbols': symbols}
            ) from e
    
    async def get_price_at_time(
        self,
        symbol: str,
        timestamp: datetime,
        tolerance_minutes: int = 5
    ) -> Optional[float]:
        """
        Get price closest to specific timestamp.
        
        Args:
            symbol: Trading symbol
            timestamp: Target timestamp
            tolerance_minutes: Maximum time difference in minutes
            
        Returns:
            Close price or None if not found within tolerance
        """
        try:
            tolerance = timedelta(minutes=tolerance_minutes)
            
            query = """
                SELECT close_price, time
                FROM market_data
                WHERE symbol = $1 
                  AND time >= $2 
                  AND time <= $3
                ORDER BY ABS(EXTRACT(EPOCH FROM (time - $4)))
                LIMIT 1
            """
            
            result = await self.db.fetchrow(
                query,
                symbol.upper(),
                timestamp - tolerance,
                timestamp + tolerance,
                timestamp
            )
            
            if result:
                self._logger.debug(
                    f"Found price {result['close_price']} for {symbol} "
                    f"at {result['time']} (target: {timestamp})"
                )
                return float(result['close_price'])
            
            self._logger.debug(
                f"No price found for {symbol} near {timestamp} "
                f"within {tolerance_minutes} minutes"
            )
            return None
            
        except Exception as e:
            self._logger.error(
                f"Failed to get price at time for {symbol}: {e}"
            )
            raise DatabaseError(
                f"Failed to get price at time: {e}",
                context={'symbol': symbol, 'timestamp': timestamp.isoformat()}
            ) from e
    
    async def insert_realtime_quote(
        self,
        symbol: str,
        timestamp: datetime,
        bid_price: Optional[float] = None,
        ask_price: Optional[float] = None,
        bid_size: Optional[int] = None,
        ask_size: Optional[int] = None,
        last_price: Optional[float] = None,
        last_size: Optional[int] = None,
        volume: Optional[int] = None,
        source: str = "unknown"
    ) -> str:
        """
        Insert real-time quote data.
        
        Args:
            symbol: Trading symbol
            timestamp: Quote timestamp
            bid_price: Bid price
            ask_price: Ask price
            bid_size: Bid size
            ask_size: Ask size
            last_price: Last trade price
            last_size: Last trade size
            volume: Cumulative volume
            source: Data source identifier
            
        Returns:
            Inserted record ID
        """
        try:
            query = """
                INSERT INTO realtime_quotes (
                    time, symbol, bid_price, ask_price, bid_size, ask_size,
                    last_price, last_size, volume, source
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            """
            
            result = await self.db.fetchval(
                query,
                timestamp, symbol.upper(), bid_price, ask_price, bid_size,
                ask_size, last_price, last_size, volume, source
            )
            
            self._logger.debug(f"Inserted realtime quote for {symbol}")
            return result
            
        except Exception as e:
            self._logger.error(f"Failed to insert realtime quote for {symbol}: {e}")
            raise DatabaseError(
                f"Failed to insert realtime quote: {e}",
                context={'symbol': symbol, 'timestamp': timestamp.isoformat()}
            ) from e
    
    async def get_symbols_with_data(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[str]:
        """
        Get list of symbols that have market data in time range.
        
        Args:
            start_time: Optional start time filter
            end_time: Optional end time filter
            
        Returns:
            List of symbols with data
        """
        try:
            query_parts = ["SELECT DISTINCT symbol FROM market_data"]
            query_values = []
            
            if start_time or end_time:
                conditions = []
                if start_time:
                    conditions.append(f"time >= ${len(query_values) + 1}")
                    query_values.append(start_time)
                if end_time:
                    conditions.append(f"time <= ${len(query_values) + 1}")
                    query_values.append(end_time)
                
                query_parts.append(f"WHERE {' AND '.join(conditions)}")
            
            query_parts.append("ORDER BY symbol")
            query = " ".join(query_parts)
            
            results = await self.db.fetch(query, *query_values)
            symbols = [record['symbol'] for record in results]
            
            self._logger.debug(f"Found {len(symbols)} symbols with market data")
            return symbols
            
        except Exception as e:
            self._logger.error(f"Failed to get symbols with data: {e}")
            raise DatabaseError(
                f"Failed to get symbols with data: {e}",
                context={
                    'start_time': start_time.isoformat() if start_time else None,
                    'end_time': end_time.isoformat() if end_time else None
                }
            ) from e
    
    async def get_data_range_info(self, symbol: str) -> Optional[Dict]:
        """
        Get data range information for symbol.
        
        Args:
            symbol: Trading symbol
            
        Returns:
            Dictionary with earliest/latest times and record count
        """
        try:
            query = """
                SELECT 
                    MIN(time) as earliest_time,
                    MAX(time) as latest_time,
                    COUNT(*) as record_count,
                    COUNT(DISTINCT interval_type) as interval_types
                FROM market_data
                WHERE symbol = $1
            """
            
            result = await self.db.fetchrow(query, symbol.upper())
            
            if result and result['record_count'] > 0:
                return {
                    'symbol': symbol.upper(),
                    'earliest_time': result['earliest_time'],
                    'latest_time': result['latest_time'],
                    'record_count': result['record_count'],
                    'interval_types': result['interval_types']
                }
            
            return None
            
        except Exception as e:
            self._logger.error(f"Failed to get data range info for {symbol}: {e}")
            raise DatabaseError(
                f"Failed to get data range info: {e}",
                context={'symbol': symbol}
            ) from e
    
    def _validate_ohlc_prices(
        self,
        open_price: float,
        high_price: float,
        low_price: float,
        close_price: float
    ) -> None:
        """
        Validate OHLC price relationships.
        
        Args:
            open_price: Opening price
            high_price: High price
            low_price: Low price
            close_price: Closing price
            
        Raises:
            DataQualityError: If price relationships are invalid
        """
        if high_price < low_price:
            raise DataQualityError(
                "High price cannot be less than low price",
                context={'high': high_price, 'low': low_price}
            )
        
        if high_price < open_price:
            raise DataQualityError(
                "High price cannot be less than open price",
                context={'high': high_price, 'open': open_price}
            )
        
        if high_price < close_price:
            raise DataQualityError(
                "High price cannot be less than close price", 
                context={'high': high_price, 'close': close_price}
            )
        
        if low_price > open_price:
            raise DataQualityError(
                "Low price cannot be greater than open price",
                context={'low': low_price, 'open': open_price}
            )
        
        if low_price > close_price:
            raise DataQualityError(
                "Low price cannot be greater than close price",
                context={'low': low_price, 'close': close_price}
            )
        
        # Check for unrealistic price movements (> 50% in single bar)
        price_range = high_price - low_price
        avg_price = (high_price + low_price) / 2
        if price_range / avg_price > 0.5:  # 50% range
            logger.warning(
                f"Large price range detected: {price_range / avg_price:.2%} "
                f"(high: {high_price}, low: {low_price})"
            )