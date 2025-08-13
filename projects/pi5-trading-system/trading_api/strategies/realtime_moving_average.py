"""
Real-time Optimized Moving Average Strategy for Pi5 Trading System.

Enhanced version of the Moving Average Crossover strategy optimized for real-time
execution with incremental calculations, caching, and performance optimizations.

Real-time Optimizations:
- Incremental MA calculations (O(1) updates instead of O(n))
- Smart caching of indicator values  
- Event-driven signal generation with change detection
- Memory-efficient circular buffers
- Batched database operations
- Optimized signal confidence calculations
"""

import logging
import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from collections import deque
import numpy as np

from strategies.base import BaseStrategyImplementation
from core.interfaces import Signal, TradingSignal
from events.event_types import MarketDataEvent, OrderFilledEvent
from core.exceptions import StrategyConfigurationError


logger = logging.getLogger(__name__)


class IncrementalMovingAverage:
    """
    Incremental moving average calculator for O(1) updates.
    
    Maintains running sum and count for efficient real-time updates.
    """
    
    def __init__(self, period: int):
        self.period = period
        self.values = deque(maxlen=period)
        self.sum = 0.0
        self.count = 0
        
    def add_value(self, value: float) -> float:
        """Add new value and return current MA."""
        if self.count == self.period:
            # Remove oldest value from sum
            old_value = self.values[0]
            self.sum -= old_value
        else:
            self.count += 1
            
        # Add new value
        self.values.append(value)
        self.sum += value
        
        return self.sum / self.count if self.count > 0 else 0.0
    
    def get_value(self) -> Optional[float]:
        """Get current MA value."""
        return self.sum / self.count if self.count > 0 else None
    
    def is_ready(self) -> bool:
        """Check if MA has enough data points."""
        return self.count >= self.period


class RealTimeMovingAverageStrategy(BaseStrategyImplementation):
    """
    Real-time optimized Moving Average Crossover strategy.
    
    Implements incremental MA calculations, smart caching, and 
    event-driven signal generation for maximum performance.
    """
    
    DEFAULT_PARAMETERS = {
        'short_period': 10,
        'long_period': 30,
        'min_volume': 1000,
        'confidence_threshold': 0.6,
        'signal_cooldown_seconds': 300,  # 5 minutes between same-type signals
        'price_change_threshold': 0.001,  # Minimum price change to trigger recalc
        'volume_weight': 0.2,
        'volatility_weight': 0.2,
        'trend_strength_weight': 0.6,
    }
    
    def __init__(
        self,
        name: str = "RealTimeMovingAverage",
        parameters: Dict[str, Any] = None,
        symbols: List[str] = None,
    ):
        """
        Initialize real-time Moving Average strategy.
        
        Args:
            name: Strategy name
            parameters: Strategy parameters
            symbols: List of symbols to trade
        """
        # Merge parameters
        merged_params = self.DEFAULT_PARAMETERS.copy()
        if parameters:
            merged_params.update(parameters)
        
        # Calculate minimum history needed
        min_history = max(merged_params['short_period'], merged_params['long_period']) + 5
        
        super().__init__(
            name=name,
            parameters=merged_params,
            max_history_size=min_history * 2,  # Keep 2x for volatility calculations
            min_history_required=min_history
        )
        
        self.symbols = symbols or []
        
        # Real-time optimized data structures
        self._incremental_mas: Dict[str, Dict[str, IncrementalMovingAverage]] = {}  # symbol -> {short/long: MA}
        self._last_prices: Dict[str, float] = {}  # symbol -> last close price
        self._last_signal_time: Dict[str, datetime] = {}  # symbol -> last signal timestamp  
        self._last_crossover_state: Dict[str, str] = {}  # symbol -> 'bullish'/'bearish'/'neutral'
        
        # Caching for expensive calculations
        self._volatility_cache: Dict[str, Tuple[float, datetime]] = {}  # symbol -> (volatility, timestamp)
        self._volume_profile_cache: Dict[str, Tuple[float, datetime]] = {}  # symbol -> (avg_volume, timestamp)
        
        # Performance tracking
        self._signal_generation_times: deque = deque(maxlen=100)
        self._cache_hit_rate = {'hits': 0, 'misses': 0}
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def _validate_parameters(self) -> None:
        """Validate strategy parameters."""
        params = self.parameters
        
        if params['short_period'] <= 0 or params['long_period'] <= 0:
            raise StrategyConfigurationError("MA periods must be positive")
        
        if params['short_period'] >= params['long_period']:
            raise StrategyConfigurationError("Short period must be less than long period")
        
        if not (0 <= params['confidence_threshold'] <= 1):
            raise StrategyConfigurationError("Confidence threshold must be between 0 and 1")
    
    async def _initialize_indicators(self) -> None:
        """Initialize incremental MA calculators for each symbol."""
        for symbol in self.symbols:
            self._incremental_mas[symbol] = {
                'short': IncrementalMovingAverage(self.parameters['short_period']),
                'long': IncrementalMovingAverage(self.parameters['long_period'])
            }
            self._last_crossover_state[symbol] = 'neutral'
        
        self._logger.info(f"Initialized incremental MAs for {len(self.symbols)} symbols")
    
    async def _generate_signals(
        self, 
        symbol: str, 
        market_data: MarketDataEvent
    ) -> List[Signal]:
        """Generate signals with real-time optimizations."""
        start_time = datetime.utcnow()
        
        signals = []
        
        try:
            # Check if price change is significant enough to process
            if symbol in self._last_prices:
                price_change = abs(market_data.close_price - self._last_prices[symbol]) / self._last_prices[symbol]
                if price_change < self.parameters['price_change_threshold']:
                    return []  # Skip insignificant price changes
            
            self._last_prices[symbol] = market_data.close_price
            
            # Update incremental MAs
            if symbol not in self._incremental_mas:
                await self._initialize_indicators()
            
            mas = self._incremental_mas[symbol]
            short_ma = mas['short'].add_value(market_data.close_price)
            long_ma = mas['long'].add_value(market_data.close_price)
            
            # Only generate signals if both MAs are ready
            if not (mas['short'].is_ready() and mas['long'].is_ready()):
                return []
            
            # Detect crossover state change
            current_state = 'bullish' if short_ma > long_ma else 'bearish'
            previous_state = self._last_crossover_state.get(symbol, 'neutral')
            
            # Only generate signal on state change
            if current_state != previous_state and previous_state != 'neutral':
                
                # Check signal cooldown
                if self._is_in_cooldown(symbol):
                    return []
                
                # Determine signal type
                if current_state == 'bullish' and previous_state == 'bearish':
                    signal_type = TradingSignal.BUY
                elif current_state == 'bearish' and previous_state == 'bullish':
                    signal_type = TradingSignal.SELL
                else:
                    return []
                
                # Calculate signal confidence
                confidence = await self._calculate_signal_confidence(symbol, market_data, short_ma, long_ma)
                
                if confidence >= self.parameters['confidence_threshold']:
                    signal = Signal(
                        symbol=symbol,
                        signal_type=signal_type,
                        confidence=confidence,
                        price=market_data.close_price,
                        timestamp=market_data.timestamp,
                        strategy_name=self.name,
                        metadata={
                            'short_ma': round(short_ma, 4),
                            'long_ma': round(long_ma, 4),
                            'crossover_type': 'golden_cross' if signal_type == TradingSignal.BUY else 'death_cross',
                            'volume': market_data.volume,
                            'ma_spread': round(abs(short_ma - long_ma) / long_ma * 100, 2)
                        }
                    )
                    
                    signals.append(signal)
                    self._last_signal_time[symbol] = market_data.timestamp
                    
                    self._logger.info(
                        f"Real-time MA signal: {signal_type.value} {symbol} @ {market_data.close_price:.2f} "
                        f"(confidence: {confidence:.2f}, short_ma: {short_ma:.2f}, long_ma: {long_ma:.2f})"
                    )
            
            # Update crossover state
            self._last_crossover_state[symbol] = current_state
            
        except Exception as e:
            self._logger.error(f"Error generating real-time signal for {symbol}: {e}")
        
        finally:
            # Track performance
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            self._signal_generation_times.append(processing_time)
        
        return signals
    
    async def _calculate_signal_confidence(
        self, 
        symbol: str, 
        market_data: MarketDataEvent,
        short_ma: float, 
        long_ma: float
    ) -> float:
        """Calculate signal confidence with caching optimizations."""
        
        # Base confidence from MA spread
        ma_spread = abs(short_ma - long_ma) / long_ma
        trend_strength = min(ma_spread * 100, 1.0)  # Normalize to 0-1
        
        # Volume confirmation (with caching)
        volume_score = await self._get_volume_score(symbol, market_data.volume)
        
        # Volatility factor (with caching) 
        volatility_score = await self._get_volatility_score(symbol, market_data.close_price)
        
        # Weighted confidence calculation
        confidence = (
            trend_strength * self.parameters['trend_strength_weight'] +
            volume_score * self.parameters['volume_weight'] +
            volatility_score * self.parameters['volatility_weight']
        )
        
        return min(confidence, 1.0)
    
    async def _get_volume_score(self, symbol: str, current_volume: int) -> float:
        """Get volume score with caching."""
        now = datetime.utcnow()
        
        # Check cache
        if symbol in self._volume_profile_cache:
            cached_avg, timestamp = self._volume_profile_cache[symbol]
            if (now - timestamp).total_seconds() < 300:  # 5-minute cache
                self._cache_hit_rate['hits'] += 1
                return min(current_volume / (cached_avg * 1.5), 1.0) if cached_avg > 0 else 0.5
        
        self._cache_hit_rate['misses'] += 1
        
        # Calculate average volume from recent data
        if symbol in self._market_data and len(self._market_data[symbol]) >= 20:
            recent_volumes = [md.volume for md in list(self._market_data[symbol])[-20:]]
            avg_volume = np.mean(recent_volumes)
            self._volume_profile_cache[symbol] = (avg_volume, now)
            return min(current_volume / (avg_volume * 1.5), 1.0) if avg_volume > 0 else 0.5
        
        return 0.5  # Neutral score if insufficient data
    
    async def _get_volatility_score(self, symbol: str, current_price: float) -> float:
        """Get volatility score with caching."""
        now = datetime.utcnow()
        
        # Check cache
        if symbol in self._volatility_cache:
            cached_vol, timestamp = self._volatility_cache[symbol]
            if (now - timestamp).total_seconds() < 300:  # 5-minute cache
                self._cache_hit_rate['hits'] += 1
                return 1.0 - min(cached_vol, 0.8)  # Higher volatility = lower confidence
        
        self._cache_hit_rate['misses'] += 1
        
        # Calculate volatility from recent price changes
        if symbol in self._market_data and len(self._market_data[symbol]) >= 20:
            recent_prices = [md.close_price for md in list(self._market_data[symbol])[-20:]]
            returns = np.diff(recent_prices) / recent_prices[:-1]
            volatility = np.std(returns) if len(returns) > 1 else 0.02
            self._volatility_cache[symbol] = (volatility, now)
            return 1.0 - min(volatility, 0.8)  # Invert: lower vol = higher confidence
        
        return 0.6  # Neutral score if insufficient data
    
    def _is_in_cooldown(self, symbol: str) -> bool:
        """Check if signal is in cooldown period."""
        if symbol not in self._last_signal_time:
            return False
        
        cooldown_seconds = self.parameters['signal_cooldown_seconds']
        time_since_last = (datetime.utcnow() - self._last_signal_time[symbol]).total_seconds()
        return time_since_last < cooldown_seconds
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get enhanced performance metrics including real-time stats."""
        base_metrics = super().get_performance_metrics()
        
        # Add real-time performance metrics
        if self._signal_generation_times:
            avg_processing_time = np.mean(self._signal_generation_times)
            max_processing_time = max(self._signal_generation_times)
        else:
            avg_processing_time = max_processing_time = 0
        
        cache_hit_rate = (
            self._cache_hit_rate['hits'] / 
            (self._cache_hit_rate['hits'] + self._cache_hit_rate['misses'])
            if (self._cache_hit_rate['hits'] + self._cache_hit_rate['misses']) > 0 else 0
        )
        
        real_time_metrics = {
            'avg_processing_time_ms': round(avg_processing_time, 2),
            'max_processing_time_ms': round(max_processing_time, 2),
            'cache_hit_rate': round(cache_hit_rate, 3),
            'active_symbols': len(self._incremental_mas),
            'symbols_ready': sum(
                1 for mas in self._incremental_mas.values() 
                if mas['short'].is_ready() and mas['long'].is_ready()
            )
        }
        
        base_metrics.update(real_time_metrics)
        return base_metrics
    
    def get_real_time_status(self) -> Dict[str, Any]:
        """Get current real-time status for monitoring."""
        return {
            'strategy_name': self.name,
            'symbols_tracked': len(self.symbols),
            'mas_initialized': len(self._incremental_mas),
            'last_processing_times': list(self._signal_generation_times)[-5:],  # Last 5
            'cache_stats': dict(self._cache_hit_rate),
            'cooldown_status': {
                symbol: self._is_in_cooldown(symbol) 
                for symbol in self.symbols
            }
        }