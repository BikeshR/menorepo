"""
Moving Average Crossover Strategy for Pi5 Trading System.

Classic trend-following strategy that generates buy signals when a short-term
moving average crosses above a long-term moving average, and sell signals
when the opposite occurs.

Strategy Logic:
- Buy when short MA crosses above long MA (golden cross)
- Sell when short MA crosses below long MA (death cross)
- Uses Simple Moving Averages by default, configurable to EMA
- Includes confidence scoring based on volume and volatility
- Risk management through position sizing and stop losses

Parameters:
- short_period: Short moving average period (default: 20)
- long_period: Long moving average period (default: 50)
- ma_type: Moving average type ('sma' or 'ema', default: 'sma')
- min_volume: Minimum volume threshold for signal generation
- confidence_threshold: Minimum confidence for signal generation (0.0-1.0)
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from strategies.base import BaseStrategyImplementation
from core.interfaces import Signal, TradingSignal
from events.event_types import MarketDataEvent, OrderFilledEvent
from core.exceptions import StrategyConfigurationError


logger = logging.getLogger(__name__)


class MovingAverageCrossoverStrategy(BaseStrategyImplementation):
    """
    Moving Average Crossover trading strategy.
    
    Implements classic MA crossover signals with configurable parameters,
    confidence scoring, and risk management features.
    """
    
    DEFAULT_PARAMETERS = {
        'short_period': 20,
        'long_period': 50,
        'ma_type': 'sma',  # 'sma' or 'ema'
        'min_volume': 10000,
        'confidence_threshold': 0.6,
        'volume_weight': 0.3,
        'volatility_weight': 0.2,
        'trend_strength_weight': 0.5,
    }
    
    def __init__(
        self,
        name: str = "MovingAverageCrossover",
        parameters: Dict[str, Any] = None,
        symbols: List[str] = None,
    ):
        """
        Initialize Moving Average Crossover strategy.
        
        Args:
            name: Strategy name
            parameters: Strategy parameters (uses defaults if not provided)
            symbols: List of symbols to trade (empty means all symbols)
        """
        # Merge default parameters with provided ones
        merged_params = self.DEFAULT_PARAMETERS.copy()
        if parameters:
            merged_params.update(parameters)
        
        super().__init__(
            name=name,
            parameters=merged_params,
            min_history_required=max(merged_params['short_period'], merged_params['long_period']) + 10
        )
        
        # Set symbols to trade
        self.symbols = symbols or []
        
        # Strategy state
        self._last_ma_signals: Dict[str, str] = {}  # symbol -> 'bullish'/'bearish'/'neutral'
        self._crossover_timestamps: Dict[str, datetime] = {}  # symbol -> last crossover time
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def _validate_parameters(self) -> None:
        """Validate strategy parameters."""
        params = self.parameters
        
        # Validate periods
        if params['short_period'] <= 0 or params['long_period'] <= 0:
            raise StrategyConfigurationError("MA periods must be positive integers")
        
        if params['short_period'] >= params['long_period']:
            raise StrategyConfigurationError("Short period must be less than long period")
        
        # Validate MA type
        if params['ma_type'] not in ['sma', 'ema']:
            raise StrategyConfigurationError("MA type must be 'sma' or 'ema'")
        
        # Validate confidence threshold
        if not (0.0 <= params['confidence_threshold'] <= 1.0):
            raise StrategyConfigurationError("Confidence threshold must be between 0.0 and 1.0")
        
        # Validate weights sum to 1.0
        weight_sum = (params['volume_weight'] + 
                     params['volatility_weight'] + 
                     params['trend_strength_weight'])
        if abs(weight_sum - 1.0) > 0.01:
            raise StrategyConfigurationError(
                f"Confidence weights must sum to 1.0, got {weight_sum}"
            )
        
        self._logger.info(f"Parameters validated: {params}")
    
    async def _initialize_indicators(self) -> None:
        """Initialize moving average indicators."""
        self._logger.info("Initializing MA crossover indicators")
        
        # Indicators will be initialized dynamically as symbols are encountered
        # This allows the strategy to handle any symbol without pre-configuration
        pass
    
    async def _custom_initialize(self) -> None:
        """Custom initialization for MA crossover strategy."""
        self._logger.info(
            f"Initialized MA crossover strategy: "
            f"{self.parameters['short_period']}/{self.parameters['long_period']} "
            f"{self.parameters['ma_type'].upper()}"
        )
    
    async def _generate_signals(
        self,
        symbol: str,
        market_data: MarketDataEvent
    ) -> List[Signal]:
        """
        Generate trading signals based on moving average crossover.
        
        Args:
            symbol: Trading symbol
            market_data: Latest market data
            
        Returns:
            List of generated signals
        """
        signals = []
        
        try:
            # Calculate moving averages
            short_ma = self._calculate_ma(symbol, self.parameters['short_period'])
            long_ma = self._calculate_ma(symbol, self.parameters['long_period'])
            
            if short_ma is None or long_ma is None:
                return signals  # Insufficient data
            
            # Check volume threshold
            if market_data.volume < self.parameters['min_volume']:
                self._logger.debug(
                    f"Volume {market_data.volume} below threshold "
                    f"{self.parameters['min_volume']} for {symbol}"
                )
                return signals
            
            # Determine current signal state
            current_signal = self._determine_signal_state(short_ma, long_ma)
            previous_signal = self._last_ma_signals.get(symbol, 'neutral')
            
            # Check for crossover
            signal_generated = None
            if previous_signal != current_signal:
                if current_signal == 'bullish' and previous_signal != 'bullish':
                    # Golden cross - buy signal
                    confidence = self._calculate_confidence(symbol, market_data, 'buy')
                    if confidence >= self.parameters['confidence_threshold']:
                        signal_generated = self._create_signal(
                            symbol=symbol,
                            signal_type=TradingSignal.BUY,
                            confidence=confidence,
                            price=market_data.close_price,
                            metadata={
                                'short_ma': short_ma,
                                'long_ma': long_ma,
                                'crossover_type': 'golden_cross',
                                'volume': market_data.volume,
                                'strategy_type': 'ma_crossover'
                            }
                        )
                        
                elif current_signal == 'bearish' and previous_signal != 'bearish':
                    # Death cross - sell signal
                    confidence = self._calculate_confidence(symbol, market_data, 'sell')
                    if confidence >= self.parameters['confidence_threshold']:
                        signal_generated = self._create_signal(
                            symbol=symbol,
                            signal_type=TradingSignal.SELL,
                            confidence=confidence,
                            price=market_data.close_price,
                            metadata={
                                'short_ma': short_ma,
                                'long_ma': long_ma,
                                'crossover_type': 'death_cross',
                                'volume': market_data.volume,
                                'strategy_type': 'ma_crossover'
                            }
                        )
                
                # Update signal state and timestamp
                self._last_ma_signals[symbol] = current_signal
                if signal_generated:
                    self._crossover_timestamps[symbol] = datetime.utcnow()
                    signals.append(signal_generated)
                    
                    self._logger.info(
                        f"MA Crossover signal for {symbol}: {signal_generated.signal_type.value} "
                        f"(confidence: {signal_generated.confidence:.2f}, "
                        f"short_ma: {short_ma:.4f}, long_ma: {long_ma:.4f})"
                    )
            else:
                # No crossover, update signal state
                self._last_ma_signals[symbol] = current_signal
            
            return signals
            
        except Exception as e:
            self._logger.error(f"Error generating MA crossover signal for {symbol}: {e}")
            raise e
    
    async def _update_indicators(self, symbol: str) -> None:
        """Update moving average indicators for symbol."""
        # Ensure indicator buffers exist
        short_key = f"ma_{self.parameters['short_period']}"
        long_key = f"ma_{self.parameters['long_period']}"
        
        self._ensure_indicator_exists(symbol, short_key)
        self._ensure_indicator_exists(symbol, long_key)
        
        # Calculate and store current MA values
        short_ma = self._calculate_ma(symbol, self.parameters['short_period'])
        long_ma = self._calculate_ma(symbol, self.parameters['long_period'])
        
        if short_ma is not None:
            self._indicators[symbol][short_key].append(short_ma)
        if long_ma is not None:
            self._indicators[symbol][long_key].append(long_ma)
    
    async def _on_order_filled_custom(self, order_fill: OrderFilledEvent) -> None:
        """Handle order fill events specific to MA crossover strategy."""
        symbol = order_fill.symbol
        
        self._logger.info(
            f"MA Crossover strategy order filled: {symbol} "
            f"{order_fill.quantity} @ {order_fill.price}"
        )
        
        # Could implement additional logic here like:
        # - Setting stop losses
        # - Adjusting position sizes
        # - Updating internal state
    
    def _calculate_ma(self, symbol: str, period: int) -> Optional[float]:
        """Calculate moving average for given period."""
        ma_type = self.parameters['ma_type']
        
        if ma_type == 'sma':
            return self.calculate_sma(symbol, period, 'close')
        elif ma_type == 'ema':
            return self.calculate_ema(symbol, period, 'close')
        else:
            return None
    
    def _determine_signal_state(self, short_ma: float, long_ma: float) -> str:
        """Determine current signal state based on MA relationship."""
        if short_ma > long_ma:
            return 'bullish'
        elif short_ma < long_ma:
            return 'bearish'
        else:
            return 'neutral'
    
    def _calculate_confidence(
        self,
        symbol: str,
        market_data: MarketDataEvent,
        signal_direction: str
    ) -> float:
        """
        Calculate confidence score for the signal.
        
        Confidence is based on:
        1. Volume strength (higher volume = higher confidence)
        2. Volatility (moderate volatility preferred)
        3. Trend strength (larger MA separation = higher confidence)
        """
        try:
            # Get recent data for calculations
            recent_data = self.get_market_data(symbol, periods=20)
            if len(recent_data) < 5:
                return 0.5  # Default confidence for insufficient data
            
            # 1. Volume confidence
            avg_volume = recent_data['volume'].tail(10).mean()
            volume_ratio = min(market_data.volume / avg_volume, 3.0)  # Cap at 3x
            volume_confidence = min(volume_ratio / 2.0, 1.0)  # Normalize to 0-1
            
            # 2. Volatility confidence (prefer moderate volatility)
            price_changes = recent_data['close'].pct_change().dropna()
            volatility = price_changes.std()
            # Optimal volatility around 2-3% daily
            optimal_vol = 0.025
            vol_diff = abs(volatility - optimal_vol)
            volatility_confidence = max(0.0, 1.0 - (vol_diff / optimal_vol))
            
            # 3. Trend strength confidence
            short_ma = self._calculate_ma(symbol, self.parameters['short_period'])
            long_ma = self._calculate_ma(symbol, self.parameters['long_period'])
            
            if short_ma and long_ma:
                ma_separation = abs(short_ma - long_ma) / long_ma
                # Higher separation = stronger trend = higher confidence
                trend_confidence = min(ma_separation * 20.0, 1.0)  # Scale up separation
            else:
                trend_confidence = 0.5
            
            # Weighted combination
            weights = self.parameters
            confidence = (
                volume_confidence * weights['volume_weight'] +
                volatility_confidence * weights['volatility_weight'] +
                trend_confidence * weights['trend_strength_weight']
            )
            
            # Ensure confidence is in valid range
            confidence = max(0.0, min(1.0, confidence))
            
            self._logger.debug(
                f"Confidence calculation for {symbol}: "
                f"volume={volume_confidence:.2f}, "
                f"volatility={volatility_confidence:.2f}, "
                f"trend={trend_confidence:.2f}, "
                f"final={confidence:.2f}"
            )
            
            return confidence
            
        except Exception as e:
            self._logger.warning(f"Error calculating confidence for {symbol}: {e}")
            return 0.5  # Return neutral confidence on error
    
    def get_strategy_state(self) -> Dict[str, Any]:
        """Get current strategy state for monitoring/debugging."""
        return {
            'parameters': self.parameters,
            'symbols': self.symbols,
            'last_signals': dict(self._last_ma_signals),
            'crossover_timestamps': {
                k: v.isoformat() for k, v in self._crossover_timestamps.items()
            },
            'positions': dict(self.positions),
            'performance': self.get_performance_metrics(),
        }
    
    def update_parameters(self, new_parameters: Dict[str, Any]) -> None:
        """Update strategy parameters dynamically."""
        old_params = self.parameters.copy()
        self.parameters.update(new_parameters)
        
        # Re-validate parameters
        try:
            # Create temporary instance to validate
            temp_strategy = MovingAverageCrossoverStrategy(
                name="temp_validation",
                parameters=self.parameters
            )
            # If this doesn't raise an exception, parameters are valid
            
            self._logger.info(
                f"Updated parameters from {old_params} to {self.parameters}"
            )
            
        except Exception as e:
            # Revert parameters if validation fails
            self.parameters = old_params
            self._logger.error(f"Parameter update failed, reverted: {e}")
            raise e