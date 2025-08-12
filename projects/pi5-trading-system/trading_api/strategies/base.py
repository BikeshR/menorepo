"""
Base strategy implementation for Pi5 Trading System.

Provides concrete implementation of BaseStrategy interface with common
functionality, technical indicators, and utilities for strategy development.

Features:
- Historical data management and buffering
- Technical indicator calculations with caching
- Signal generation with confidence scoring
- Position and risk management integration
- Performance tracking and metrics
- State persistence and recovery
"""

import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from collections import deque

from core.interfaces import BaseStrategy, Signal, TradingSignal
from core.exceptions import (
    StrategyInitializationError,
    StrategyExecutionError,
    InsufficientHistoryError,
)
from events.event_types import MarketDataEvent, OrderFilledEvent


logger = logging.getLogger(__name__)


class BaseStrategyImplementation(BaseStrategy):
    """
    Concrete base strategy implementation with common functionality.
    
    Provides data management, technical indicators, and utilities that
    all strategies can use. Handles the complexity of data buffering,
    indicator calculations, and performance tracking.
    """
    
    def __init__(
        self,
        name: str,
        parameters: Dict[str, Any] = None,
        max_history_size: int = 1000,
        min_history_required: int = 50,
    ):
        """
        Initialize base strategy.
        
        Args:
            name: Strategy name
            parameters: Strategy parameters dictionary
            max_history_size: Maximum historical data points to keep
            min_history_required: Minimum history needed before trading
        """
        super().__init__(name, parameters)
        
        self.max_history_size = max_history_size
        self.min_history_required = min_history_required
        
        # Data storage
        self._market_data: Dict[str, deque] = {}  # symbol -> deque of market data
        self._indicators: Dict[str, Dict[str, deque]] = {}  # symbol -> indicator -> values
        self._last_signals: Dict[str, Signal] = {}  # symbol -> last signal
        
        # Strategy state
        self._initialized = False
        self._error_count = 0
        self._last_error: Optional[Exception] = None
        self._total_signals_generated = 0
        
        # Performance tracking
        self._trade_history: List[Dict[str, Any]] = []
        self._daily_returns: deque = deque(maxlen=252)  # 1 year of daily returns
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def initialize(self) -> None:
        """Initialize strategy with validation."""
        try:
            self._logger.info(f"Initializing strategy: {self.name}")
            
            # Validate parameters
            await self._validate_parameters()
            
            # Initialize indicators
            await self._initialize_indicators()
            
            # Load any saved state
            await self._load_state()
            
            # Custom initialization
            await self._custom_initialize()
            
            self._initialized = True
            self._logger.info(f"Strategy {self.name} initialized successfully")
            
        except Exception as e:
            self._logger.error(f"Failed to initialize strategy {self.name}: {e}")
            raise StrategyInitializationError(
                f"Strategy initialization failed: {e}",
                context={'strategy_name': self.name}
            ) from e
    
    async def on_market_data(self, market_data: MarketDataEvent) -> List[Signal]:
        """
        Process market data and generate trading signals.
        
        Args:
            market_data: Market data event
            
        Returns:
            List of generated trading signals
        """
        try:
            if not self._initialized:
                await self.initialize()
            
            symbol = market_data.symbol
            
            # Update data buffer
            self._add_market_data(symbol, market_data)
            
            # Skip if insufficient history
            if not self._has_sufficient_history(symbol):
                return []
            
            # Update indicators
            await self._update_indicators(symbol)
            
            # Generate signals
            signals = await self._generate_signals(symbol, market_data)
            
            # Track signals
            for signal in signals:
                self._last_signals[symbol] = signal
                self._total_signals_generated += 1
            
            self.last_update = datetime.utcnow()
            return signals
            
        except Exception as e:
            self._error_count += 1
            self._last_error = e
            self._logger.error(f"Error processing market data in {self.name}: {e}")
            raise StrategyExecutionError(
                f"Market data processing failed: {e}",
                context={'strategy_name': self.name, 'symbol': market_data.symbol}
            ) from e
    
    async def on_order_filled(self, order_fill: OrderFilledEvent) -> None:
        """
        Handle order fill notifications.
        
        Args:
            order_fill: Order fill event
        """
        try:
            symbol = order_fill.symbol
            quantity = order_fill.quantity
            price = order_fill.price
            
            # Update position tracking
            self.update_position(symbol, quantity)
            
            # Record trade
            trade_record = {
                'timestamp': order_fill.timestamp,
                'symbol': symbol,
                'quantity': quantity,
                'price': price,
                'commission': order_fill.commission,
                'order_id': order_fill.order_id,
                'fill_id': order_fill.fill_id,
            }
            self._trade_history.append(trade_record)
            
            # Custom order fill handling
            await self._on_order_filled_custom(order_fill)
            
            self._logger.info(
                f"Order filled for {symbol}: {quantity} @ {price} "
                f"(Strategy: {self.name})"
            )
            
        except Exception as e:
            self._error_count += 1
            self._last_error = e
            self._logger.error(f"Error handling order fill in {self.name}: {e}")
    
    def get_required_history(self) -> int:
        """Return minimum historical periods needed."""
        return self.min_history_required
    
    def get_market_data(self, symbol: str, periods: int = None) -> pd.DataFrame:
        """
        Get historical market data as DataFrame.
        
        Args:
            symbol: Trading symbol
            periods: Number of periods to return (None for all)
            
        Returns:
            DataFrame with OHLCV data
        """
        if symbol not in self._market_data:
            return pd.DataFrame()
        
        data_points = list(self._market_data[symbol])
        if periods:
            data_points = data_points[-periods:]
        
        if not data_points:
            return pd.DataFrame()
        
        # Convert to DataFrame
        records = []
        for md in data_points:
            records.append({
                'timestamp': md.timestamp,
                'open': md.open_price,
                'high': md.high_price,
                'low': md.low_price,
                'close': md.close_price,
                'volume': md.volume,
            })
        
        df = pd.DataFrame(records)
        df.set_index('timestamp', inplace=True)
        return df
    
    def get_indicator_value(
        self,
        symbol: str,
        indicator_name: str,
        periods: int = 1
    ) -> Optional[float]:
        """
        Get latest indicator value.
        
        Args:
            symbol: Trading symbol
            indicator_name: Indicator name
            periods: Number of periods back (1 = latest)
            
        Returns:
            Indicator value or None if not available
        """
        if (symbol not in self._indicators or 
            indicator_name not in self._indicators[symbol]):
            return None
        
        values = self._indicators[symbol][indicator_name]
        if len(values) < periods:
            return None
        
        return values[-periods]
    
    def get_indicator_values(
        self,
        symbol: str,
        indicator_name: str,
        periods: int = None
    ) -> List[float]:
        """
        Get historical indicator values.
        
        Args:
            symbol: Trading symbol
            indicator_name: Indicator name
            periods: Number of periods to return (None for all)
            
        Returns:
            List of indicator values
        """
        if (symbol not in self._indicators or 
            indicator_name not in self._indicators[symbol]):
            return []
        
        values = list(self._indicators[symbol][indicator_name])
        if periods:
            values = values[-periods:]
        
        return values
    
    def calculate_sma(self, symbol: str, period: int, price_type: str = 'close') -> float:
        """Calculate Simple Moving Average."""
        df = self.get_market_data(symbol, periods=period)
        if len(df) < period:
            return None
        
        return df[price_type].tail(period).mean()
    
    def calculate_ema(
        self,
        symbol: str,
        period: int,
        price_type: str = 'close',
        alpha: float = None
    ) -> float:
        """Calculate Exponential Moving Average."""
        if alpha is None:
            alpha = 2.0 / (period + 1)
        
        # Get or initialize EMA state
        indicator_key = f"ema_{period}_{price_type}_state"
        if (symbol not in self._indicators or 
            indicator_key not in self._indicators[symbol]):
            return None
        
        current_price = self._get_latest_price(symbol, price_type)
        if current_price is None:
            return None
        
        ema_state = self._indicators[symbol][indicator_key]
        if not ema_state:
            # Initialize with SMA
            sma = self.calculate_sma(symbol, period, price_type)
            if sma is None:
                return None
            ema_state.append(sma)
            return sma
        
        # Calculate EMA
        previous_ema = ema_state[-1]
        new_ema = (current_price * alpha) + (previous_ema * (1 - alpha))
        ema_state.append(new_ema)
        
        return new_ema
    
    def calculate_rsi(self, symbol: str, period: int = 14) -> float:
        """Calculate Relative Strength Index."""
        df = self.get_market_data(symbol, periods=period + 1)
        if len(df) < period + 1:
            return None
        
        close_prices = df['close'].values
        deltas = np.diff(close_prices)
        
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gain = np.mean(gains[-period:])
        avg_loss = np.mean(losses[-period:])
        
        if avg_loss == 0:
            return 100
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi
    
    def calculate_bollinger_bands(
        self,
        symbol: str,
        period: int = 20,
        std_dev: float = 2.0
    ) -> Tuple[float, float, float]:
        """
        Calculate Bollinger Bands.
        
        Returns:
            Tuple of (upper_band, middle_band, lower_band)
        """
        df = self.get_market_data(symbol, periods=period)
        if len(df) < period:
            return None, None, None
        
        close_prices = df['close'].tail(period)
        middle_band = close_prices.mean()
        std = close_prices.std()
        
        upper_band = middle_band + (std * std_dev)
        lower_band = middle_band - (std * std_dev)
        
        return upper_band, middle_band, lower_band
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get strategy performance metrics."""
        if not self._trade_history:
            return {}
        
        # Calculate basic metrics
        total_trades = len(self._trade_history)
        total_pnl = sum(
            (trade['quantity'] * trade['price']) - trade['commission']
            for trade in self._trade_history
        )
        
        # Calculate win rate
        profitable_trades = 0
        for trade in self._trade_history:
            if trade['quantity'] * trade['price'] > trade['commission']:
                profitable_trades += 1
        
        win_rate = profitable_trades / total_trades if total_trades > 0 else 0
        
        # Calculate Sharpe ratio if we have daily returns
        sharpe_ratio = None
        if len(self._daily_returns) > 30:  # Need at least 30 days
            returns_array = np.array(self._daily_returns)
            mean_return = np.mean(returns_array)
            std_return = np.std(returns_array)
            if std_return > 0:
                sharpe_ratio = (mean_return * 252) / (std_return * np.sqrt(252))
        
        return {
            'total_trades': total_trades,
            'total_pnl': total_pnl,
            'win_rate': win_rate,
            'sharpe_ratio': sharpe_ratio,
            'signals_generated': self._total_signals_generated,
            'error_count': self._error_count,
            'last_error': str(self._last_error) if self._last_error else None,
            'is_active': self.is_active,
            'positions': dict(self.positions),
        }
    
    # Abstract methods to be implemented by specific strategies
    
    async def _validate_parameters(self) -> None:
        """Validate strategy parameters. Override in subclasses."""
        pass
    
    async def _initialize_indicators(self) -> None:
        """Initialize indicators. Override in subclasses."""
        pass
    
    async def _custom_initialize(self) -> None:
        """Custom initialization logic. Override in subclasses."""
        pass
    
    async def _generate_signals(
        self,
        symbol: str,
        market_data: MarketDataEvent
    ) -> List[Signal]:
        """Generate trading signals. Must be implemented by subclasses."""
        raise NotImplementedError("Subclasses must implement _generate_signals")
    
    async def _on_order_filled_custom(self, order_fill: OrderFilledEvent) -> None:
        """Custom order fill handling. Override in subclasses."""
        pass
    
    async def _load_state(self) -> None:
        """Load saved strategy state. Override in subclasses."""
        pass
    
    async def _update_indicators(self, symbol: str) -> None:
        """Update all indicators for symbol. Override in subclasses."""
        pass
    
    # Private helper methods
    
    def _add_market_data(self, symbol: str, market_data: MarketDataEvent) -> None:
        """Add market data to buffer."""
        if symbol not in self._market_data:
            self._market_data[symbol] = deque(maxlen=self.max_history_size)
            self._indicators[symbol] = {}
        
        self._market_data[symbol].append(market_data)
    
    def _has_sufficient_history(self, symbol: str) -> bool:
        """Check if we have enough history for trading."""
        if symbol not in self._market_data:
            return False
        
        return len(self._market_data[symbol]) >= self.min_history_required
    
    def _get_latest_price(self, symbol: str, price_type: str = 'close') -> Optional[float]:
        """Get latest price of specified type."""
        if symbol not in self._market_data or not self._market_data[symbol]:
            return None
        
        latest_data = self._market_data[symbol][-1]
        
        if price_type == 'open':
            return latest_data.open_price
        elif price_type == 'high':
            return latest_data.high_price
        elif price_type == 'low':
            return latest_data.low_price
        elif price_type == 'close':
            return latest_data.close_price
        else:
            return None
    
    def _ensure_indicator_exists(self, symbol: str, indicator_name: str) -> None:
        """Ensure indicator buffer exists for symbol."""
        if symbol not in self._indicators:
            self._indicators[symbol] = {}
        
        if indicator_name not in self._indicators[symbol]:
            self._indicators[symbol][indicator_name] = deque(maxlen=self.max_history_size)
    
    def _create_signal(
        self,
        symbol: str,
        signal_type: TradingSignal,
        confidence: float,
        price: float,
        metadata: Dict[str, Any] = None
    ) -> Signal:
        """Create a trading signal."""
        return Signal(
            symbol=symbol,
            signal_type=signal_type,
            confidence=confidence,
            price=price,
            timestamp=datetime.utcnow(),
            strategy_name=self.name,
            metadata=metadata or {}
        )