"""
Momentum/Trend Following Strategy for Pi5 Trading System.

This strategy identifies and follows trending markets using multiple momentum indicators.
It enters positions in the direction of the trend and holds them until trend reversal
signals are detected.

Strategy Logic:
- Trend Identification: Uses EMA crossovers and MACD for trend direction
- Momentum Confirmation: ADX for trend strength, RSI for momentum
- Entry: When trend + momentum align in same direction
- Exit: When trend reversal signals appear or momentum deteriorates

Features:
- Multi-indicator trend confirmation (EMA, MACD, ADX)
- Adaptive position sizing based on trend strength
- Trailing stop loss with ATR-based adjustments
- Momentum filtering to avoid weak trends
- Breakout detection for early trend entry
- Divergence detection for early exit signals
"""

import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from strategies.enhanced_base import EnhancedBaseStrategy
from core.interfaces import Signal, TradingSignal
from core.exceptions import StrategyExecutionError
from events.event_types import MarketDataEvent, OrderFilledEvent


logger = logging.getLogger(__name__)


class MomentumTrendFollowingStrategy(EnhancedBaseStrategy):
    """
    Momentum/Trend Following Strategy.
    
    Uses multiple indicators to identify and follow trending markets,
    entering positions in the direction of the trend with momentum confirmation.
    """
    
    DEFAULT_PARAMETERS = {
        # Trend Identification
        'fast_ema_period': 12,
        'slow_ema_period': 26,
        'trend_ema_period': 50,      # Long-term trend filter
        'macd_fast': 12,
        'macd_slow': 26,
        'macd_signal': 9,
        
        # Momentum and Strength
        'adx_period': 14,
        'adx_threshold': 25.0,       # Minimum ADX for strong trend
        'rsi_period': 14,
        'rsi_momentum_lower': 45,    # RSI range for bullish momentum
        'rsi_momentum_upper': 55,    # RSI range for bearish momentum
        
        # Entry Conditions
        'min_trend_strength': 0.01,  # Minimum trend strength (1%)
        'breakout_threshold': 2.0,   # Breakout strength (ATR multiples)
        'momentum_confirmation': True,  # Require momentum confirmation
        'volume_confirmation': True,    # Require volume confirmation
        'min_volume_ratio': 1.2,      # Volume vs 20-day average
        
        # Risk Management
        'initial_stop_atr': 2.0,     # Initial stop loss (ATR multiples)
        'trailing_stop_atr': 1.5,    # Trailing stop (ATR multiples)
        'max_position_size': 0.15,   # Maximum position size (15%)
        'risk_per_trade': 0.025,     # Risk 2.5% per trade
        'take_profit_ratio': 3.0,    # Take profit vs stop loss ratio
        
        # Position Management
        'use_pyramid': True,         # Allow pyramiding positions
        'max_pyramid_levels': 3,     # Maximum pyramid levels
        'pyramid_scale': 0.5,        # Scale factor for additional positions
        'trend_strength_scaling': True,  # Scale position by trend strength
        
        # Exit Conditions
        'use_divergence_exit': True,   # Exit on momentum divergence
        'divergence_periods': 10,      # Periods to check for divergence
        'trend_reversal_threshold': 0.005,  # Trend reversal threshold (0.5%)
        'max_holding_periods': 200,   # Maximum holding periods
        
        # Signal Quality
        'min_signal_strength': 0.6,   # Minimum signal strength
        'confirmation_periods': 2,    # Periods for signal confirmation
        'false_breakout_filter': True, # Filter false breakouts
    }
    
    def __init__(
        self,
        name: str = "Momentum_TrendFollowing",
        market_data_manager=None,
        parameters: Dict[str, Any] = None,
        watched_symbols: List[str] = None
    ):
        """
        Initialize Momentum Trend Following Strategy.
        
        Args:
            name: Strategy name
            market_data_manager: MarketDataManager instance
            parameters: Strategy parameters
            watched_symbols: List of symbols to trade
        """
        # Merge default parameters with provided ones
        merged_params = self.DEFAULT_PARAMETERS.copy()
        if parameters:
            merged_params.update(parameters)
        
        super().__init__(
            name=name,
            market_data_manager=market_data_manager,
            parameters=merged_params,
            max_history_size=300,  # Need more history for trend analysis
            min_history_required=80,  # Minimum for reliable trend detection
            enable_live_data=True,
            data_validation=True
        )
        
        self.watched_symbols = watched_symbols or []
        
        # Strategy state
        self._trend_direction: Dict[str, int] = {}  # symbol -> 1 (up), -1 (down), 0 (sideways)
        self._trend_strength: Dict[str, float] = {}  # symbol -> trend strength
        self._position_levels: Dict[str, int] = {}  # symbol -> number of pyramid levels
        self._entry_prices: Dict[str, List[float]] = {}  # symbol -> list of entry prices
        self._trailing_stops: Dict[str, float] = {}  # symbol -> trailing stop price
        self._position_start_time: Dict[str, datetime] = {}  # symbol -> position start time
        self._last_breakout_price: Dict[str, float] = {}  # symbol -> last breakout price
        self._momentum_highs: Dict[str, List[Tuple[datetime, float]]] = {}  # For divergence
        self._momentum_lows: Dict[str, List[Tuple[datetime, float]]] = {}   # For divergence
        
        logger.info(f"Momentum Trend Following strategy initialized for {len(self.watched_symbols)} symbols")
    
    async def _validate_parameters(self) -> None:
        """Validate strategy parameters."""
        params = self.parameters
        
        # Validate EMA periods
        if params['fast_ema_period'] >= params['slow_ema_period']:
            raise ValueError("Fast EMA period must be less than slow EMA period")
        
        if params['slow_ema_period'] >= params['trend_ema_period']:
            raise ValueError("Slow EMA period must be less than trend EMA period")
        
        # Validate MACD parameters
        if params['macd_fast'] >= params['macd_slow']:
            raise ValueError("MACD fast period must be less than slow period")
        
        # Validate risk parameters
        if not 0 < params['initial_stop_atr'] <= 5:
            raise ValueError("Initial stop ATR must be between 0 and 5")
        
        if not 0 < params['trailing_stop_atr'] <= 5:
            raise ValueError("Trailing stop ATR must be between 0 and 5")
        
        # Validate position parameters
        if not 0 < params['max_position_size'] <= 1:
            raise ValueError("Max position size must be between 0 and 1")
        
        if params['max_pyramid_levels'] < 1:
            raise ValueError("Max pyramid levels must be at least 1")
        
        logger.info("Momentum Trend Following parameters validated successfully")
    
    def _get_indicators_config(self) -> Dict[str, Dict[str, Any]]:
        """Configure indicators for this strategy."""
        return {
            'ema': {
                'periods': [
                    self.parameters['fast_ema_period'],
                    self.parameters['slow_ema_period'],
                    self.parameters['trend_ema_period']
                ]
            },
            'macd': {
                'fast_period': self.parameters['macd_fast'],
                'slow_period': self.parameters['macd_slow'],
                'signal_period': self.parameters['macd_signal']
            },
            'adx': {'period': self.parameters['adx_period']},
            'rsi': {'period': self.parameters['rsi_period']},
            'atr': {'period': 14},
            'sma': {'periods': [20]},  # For volume analysis
        }
    
    async def _generate_signals(
        self,
        symbol: str,
        market_data: MarketDataEvent
    ) -> List[Signal]:
        """
        Generate momentum trend following signals.
        
        Args:
            symbol: Trading symbol
            market_data: Latest market data
            
        Returns:
            List of trading signals
        """
        try:
            signals = []
            
            # Get latest data with indicators
            latest_data = await self.get_latest_market_data(
                symbol=symbol,
                periods=150,  # Need sufficient history for trend analysis
                interval='1min'
            )
            
            if latest_data.empty or len(latest_data) < self.parameters['trend_ema_period']:
                return signals
            
            # Get current indicator values
            current_price = market_data.close_price
            fast_ema = self.get_ema(symbol, self.parameters['fast_ema_period'])
            slow_ema = self.get_ema(symbol, self.parameters['slow_ema_period'])
            trend_ema = self.get_ema(symbol, self.parameters['trend_ema_period'])
            macd, signal, histogram = self.get_macd(symbol)
            current_adx = self._get_adx_value(latest_data)
            current_rsi = self.get_rsi(symbol)
            current_atr = self.get_atr(symbol)
            
            if None in [fast_ema, slow_ema, trend_ema, current_atr]:
                return signals
            
            # Update trend analysis
            self._analyze_trend(symbol, current_price, fast_ema, slow_ema, trend_ema, 
                              macd, signal, current_adx, latest_data)
            
            # Get current position
            current_position = self.get_position(symbol)
            
            # Generate entry signals
            if current_position == 0:  # No position
                entry_signal = self._check_entry_conditions(
                    symbol, current_price, latest_data, market_data
                )
                if entry_signal:
                    signals.append(entry_signal)
            
            # Generate pyramid signals
            elif self.parameters['use_pyramid']:
                pyramid_signal = self._check_pyramid_conditions(
                    symbol, current_price, latest_data, current_position
                )
                if pyramid_signal:
                    signals.append(pyramid_signal)
            
            # Generate exit signals
            if current_position != 0:
                exit_signal = self._check_exit_conditions(
                    symbol, current_price, latest_data, current_position
                )
                if exit_signal:
                    signals.append(exit_signal)
            
            # Update trailing stops
            self._update_trailing_stops(symbol, current_price, current_atr, current_position)
            
            return signals
            
        except Exception as e:
            logger.error(f"Error generating momentum signals for {symbol}: {e}")
            raise StrategyExecutionError(f"Signal generation failed: {e}") from e
    
    def _analyze_trend(
        self,
        symbol: str,
        current_price: float,
        fast_ema: float,
        slow_ema: float,
        trend_ema: float,
        macd: Optional[float],
        signal: Optional[float],
        adx: Optional[float],
        data: pd.DataFrame
    ) -> None:
        """Analyze current trend direction and strength."""
        
        # Determine trend direction
        trend_direction = 0
        
        # EMA-based trend
        if fast_ema > slow_ema and current_price > trend_ema:
            trend_direction = 1  # Uptrend
        elif fast_ema < slow_ema and current_price < trend_ema:
            trend_direction = -1  # Downtrend
        
        # MACD confirmation
        if macd is not None and signal is not None:
            if trend_direction == 1 and macd < signal:
                trend_direction = 0  # Conflicting signals
            elif trend_direction == -1 and macd > signal:
                trend_direction = 0  # Conflicting signals
        
        self._trend_direction[symbol] = trend_direction
        
        # Calculate trend strength
        trend_strength = 0.0
        
        if trend_direction != 0:
            # Price distance from trend EMA
            price_strength = abs(current_price - trend_ema) / trend_ema
            
            # EMA spread strength
            ema_spread = abs(fast_ema - slow_ema) / slow_ema
            
            # ADX strength
            adx_strength = (adx / 100) if adx else 0
            
            # Combine strengths
            trend_strength = (price_strength + ema_spread + adx_strength) / 3
        
        self._trend_strength[symbol] = trend_strength
    
    def _check_entry_conditions(
        self,
        symbol: str,
        current_price: float,
        data: pd.DataFrame,
        market_data: MarketDataEvent
    ) -> Optional[Signal]:
        """Check for entry signal conditions."""
        
        trend_direction = self._trend_direction.get(symbol, 0)
        trend_strength = self._trend_strength.get(symbol, 0)
        
        # Must have clear trend direction
        if trend_direction == 0:
            return None
        
        # Check minimum trend strength
        if trend_strength < self.parameters['min_trend_strength']:
            return None
        
        # Check ADX for trend strength
        current_adx = self._get_adx_value(data)
        if current_adx and current_adx < self.parameters['adx_threshold']:
            return None
        
        # Momentum confirmation
        if self.parameters['momentum_confirmation']:
            if not self._check_momentum_alignment(symbol, trend_direction):
                return None
        
        # Volume confirmation
        if self.parameters['volume_confirmation']:
            if not self._check_volume_confirmation(data):
                return None
        
        # Breakout detection
        breakout_strength = self._detect_breakout(symbol, current_price, data)
        if breakout_strength < self.parameters['breakout_threshold']:
            return None
        
        # Calculate position size
        position_size = self._calculate_trend_position_size(
            symbol, current_price, trend_strength, data
        )
        
        if position_size <= 0:
            return None
        
        # Determine signal type
        signal_type = TradingSignal.BUY if trend_direction == 1 else TradingSignal.SELL
        
        # Calculate stop loss and take profit
        atr = self.get_atr(symbol)
        stop_distance = atr * self.parameters['initial_stop_atr']
        
        if trend_direction == 1:
            stop_loss = current_price - stop_distance
            take_profit = current_price + (stop_distance * self.parameters['take_profit_ratio'])
        else:
            stop_loss = current_price + stop_distance
            take_profit = current_price - (stop_distance * self.parameters['take_profit_ratio'])
        
        # Initialize position tracking
        self._position_levels[symbol] = 1
        self._entry_prices[symbol] = [current_price]
        self._trailing_stops[symbol] = stop_loss
        self._position_start_time[symbol] = datetime.utcnow()
        self._last_breakout_price[symbol] = current_price
        
        # Calculate signal confidence
        confidence = self._calculate_entry_confidence(
            trend_direction, trend_strength, breakout_strength, current_adx
        )
        
        return self._create_signal(
            symbol=symbol,
            signal_type=signal_type,
            confidence=confidence,
            price=current_price,
            metadata={
                'trend_direction': trend_direction,
                'trend_strength': trend_strength,
                'breakout_strength': breakout_strength,
                'adx': current_adx,
                'position_size': position_size,
                'stop_loss': stop_loss,
                'take_profit': take_profit,
                'entry_reason': 'trend_momentum_breakout',
                'pyramid_level': 1
            }
        )
    
    def _check_pyramid_conditions(
        self,
        symbol: str,
        current_price: float,
        data: pd.DataFrame,
        current_position: float
    ) -> Optional[Signal]:
        """Check for pyramid (additional position) conditions."""
        
        current_levels = self._position_levels.get(symbol, 0)
        
        # Check pyramid limits
        if current_levels >= self.parameters['max_pyramid_levels']:
            return None
        
        trend_direction = self._trend_direction.get(symbol, 0)
        trend_strength = self._trend_strength.get(symbol, 0)
        
        # Must be in strong trend
        if trend_direction == 0 or trend_strength < self.parameters['min_trend_strength'] * 1.5:
            return None
        
        # Check if price moved favorably from last entry
        last_entry_price = self._entry_prices.get(symbol, [])[-1] if symbol in self._entry_prices else current_price
        
        price_move_threshold = self.get_atr(symbol) * 1.0  # Require 1 ATR move
        
        if trend_direction == 1:  # Long position
            if current_price < last_entry_price + price_move_threshold:
                return None
        else:  # Short position
            if current_price > last_entry_price - price_move_threshold:
                return None
        
        # Calculate scaled position size
        base_size = self._calculate_trend_position_size(
            symbol, current_price, trend_strength, data
        )
        pyramid_size = base_size * (self.parameters['pyramid_scale'] ** current_levels)
        
        if pyramid_size <= 0:
            return None
        
        # Determine signal type
        signal_type = TradingSignal.BUY if trend_direction == 1 else TradingSignal.SELL
        
        # Update position tracking
        self._position_levels[symbol] = current_levels + 1
        if symbol not in self._entry_prices:
            self._entry_prices[symbol] = []
        self._entry_prices[symbol].append(current_price)
        
        confidence = min(0.8, trend_strength * 2)  # Lower confidence for pyramids
        
        return self._create_signal(
            symbol=symbol,
            signal_type=signal_type,
            confidence=confidence,
            price=current_price,
            metadata={
                'trend_direction': trend_direction,
                'trend_strength': trend_strength,
                'position_size': pyramid_size,
                'entry_reason': 'pyramid_addition',
                'pyramid_level': current_levels + 1,
                'last_entry_price': last_entry_price
            }
        )
    
    def _check_exit_conditions(
        self,
        symbol: str,
        current_price: float,
        data: pd.DataFrame,
        current_position: float
    ) -> Optional[Signal]:
        """Check for exit signal conditions."""
        
        # Trailing stop check
        trailing_stop = self._trailing_stops.get(symbol)
        if trailing_stop:
            if ((current_position > 0 and current_price <= trailing_stop) or
                (current_position < 0 and current_price >= trailing_stop)):
                
                return self._create_exit_signal(
                    symbol, current_price, current_position, 'trailing_stop'
                )
        
        # Trend reversal check
        trend_direction = self._trend_direction.get(symbol, 0)
        position_direction = 1 if current_position > 0 else -1
        
        if trend_direction != position_direction and trend_direction != 0:
            return self._create_exit_signal(
                symbol, current_price, current_position, 'trend_reversal'
            )
        
        # Momentum divergence check
        if self.parameters['use_divergence_exit']:
            if self._detect_momentum_divergence(symbol, data, current_position > 0):
                return self._create_exit_signal(
                    symbol, current_price, current_position, 'momentum_divergence'
                )
        
        # Maximum holding period check
        start_time = self._position_start_time.get(symbol)
        if start_time:
            holding_periods = (datetime.utcnow() - start_time).total_seconds() / 60  # Convert to minutes
            if holding_periods > self.parameters['max_holding_periods']:
                return self._create_exit_signal(
                    symbol, current_price, current_position, 'max_holding_period'
                )
        
        # Weak trend strength
        trend_strength = self._trend_strength.get(symbol, 0)
        if trend_strength < self.parameters['trend_reversal_threshold']:
            return self._create_exit_signal(
                symbol, current_price, current_position, 'weak_trend'
            )
        
        return None
    
    def _create_exit_signal(
        self,
        symbol: str,
        current_price: float,
        current_position: float,
        exit_reason: str
    ) -> Signal:
        """Create exit signal and clean up position tracking."""
        
        signal_type = TradingSignal.SELL if current_position > 0 else TradingSignal.BUY
        
        # Calculate P&L
        entry_prices = self._entry_prices.get(symbol, [current_price])
        avg_entry = sum(entry_prices) / len(entry_prices)
        
        if current_position > 0:
            pnl_pct = ((current_price / avg_entry) - 1) * 100
        else:
            pnl_pct = ((avg_entry / current_price) - 1) * 100
        
        # Clean up position tracking
        self._position_levels.pop(symbol, None)
        self._entry_prices.pop(symbol, None)
        self._trailing_stops.pop(symbol, None)
        self._position_start_time.pop(symbol, None)
        
        return self._create_signal(
            symbol=symbol,
            signal_type=signal_type,
            confidence=0.9,  # High confidence for exits
            price=current_price,
            metadata={
                'exit_reason': exit_reason,
                'avg_entry_price': avg_entry,
                'pnl_pct': pnl_pct,
                'position_size': abs(current_position)
            }
        )
    
    def _check_momentum_alignment(self, symbol: str, trend_direction: int) -> bool:
        """Check if momentum indicators align with trend direction."""
        
        current_rsi = self.get_rsi(symbol)
        if current_rsi is None:
            return False
        
        macd, signal, histogram = self.get_macd(symbol)
        
        if trend_direction == 1:  # Bullish trend
            # RSI should be in bullish momentum range
            rsi_aligned = current_rsi >= self.parameters['rsi_momentum_lower']
            
            # MACD should be above signal line
            macd_aligned = True
            if macd is not None and signal is not None:
                macd_aligned = macd > signal
            
            return rsi_aligned and macd_aligned
        
        else:  # Bearish trend
            # RSI should be in bearish momentum range
            rsi_aligned = current_rsi <= self.parameters['rsi_momentum_upper']
            
            # MACD should be below signal line
            macd_aligned = True
            if macd is not None and signal is not None:
                macd_aligned = macd < signal
            
            return rsi_aligned and macd_aligned
    
    def _check_volume_confirmation(self, data: pd.DataFrame) -> bool:
        """Check for volume confirmation of the move."""
        
        if 'volume' not in data.columns or len(data) < 20:
            return True  # Skip if no volume data
        
        current_volume = data['volume'].iloc[-1]
        avg_volume = data['volume'].tail(20).mean()
        
        volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1.0
        
        return volume_ratio >= self.parameters['min_volume_ratio']
    
    def _detect_breakout(self, symbol: str, current_price: float, data: pd.DataFrame) -> float:
        """Detect breakout strength in ATR multiples."""
        
        if len(data) < 20:
            return 0.0
        
        # Calculate recent high/low
        lookback_period = 20
        recent_high = data['high'].tail(lookback_period).max()
        recent_low = data['low'].tail(lookback_period).min()
        
        atr = self.get_atr(symbol)
        if atr is None or atr == 0:
            return 0.0
        
        # Check for breakout above recent high
        if current_price > recent_high:
            breakout_distance = current_price - recent_high
            return breakout_distance / atr
        
        # Check for breakdown below recent low
        elif current_price < recent_low:
            breakout_distance = recent_low - current_price
            return breakout_distance / atr
        
        return 0.0
    
    def _calculate_trend_position_size(
        self,
        symbol: str,
        current_price: float,
        trend_strength: float,
        data: pd.DataFrame
    ) -> float:
        """Calculate position size based on trend strength and risk management."""
        
        try:
            # Base position size from risk management
            atr = self.get_atr(symbol)
            if atr is None:
                return 0.0
            
            # Risk per trade
            risk_amount = self.parameters['risk_per_trade']
            stop_distance = atr * self.parameters['initial_stop_atr']
            
            # Calculate base position size
            base_position_size = risk_amount / (stop_distance / current_price)
            
            # Scale by trend strength if enabled
            if self.parameters['trend_strength_scaling']:
                strength_multiplier = 1.0 + (trend_strength * 2)  # Scale by trend strength
                base_position_size *= strength_multiplier
            
            # Apply maximum position size limit
            max_position = self.parameters['max_position_size']
            position_size = min(base_position_size, max_position)
            
            return max(0.0, position_size)
            
        except Exception as e:
            logger.error(f"Error calculating position size for {symbol}: {e}")
            return 0.0
    
    def _update_trailing_stops(
        self,
        symbol: str,
        current_price: float,
        atr: Optional[float],
        current_position: float
    ) -> None:
        """Update trailing stop loss levels."""
        
        if current_position == 0 or atr is None:
            return
        
        trailing_distance = atr * self.parameters['trailing_stop_atr']
        current_stop = self._trailing_stops.get(symbol)
        
        if current_position > 0:  # Long position
            new_stop = current_price - trailing_distance
            if current_stop is None or new_stop > current_stop:
                self._trailing_stops[symbol] = new_stop
        
        else:  # Short position
            new_stop = current_price + trailing_distance
            if current_stop is None or new_stop < current_stop:
                self._trailing_stops[symbol] = new_stop
    
    def _detect_momentum_divergence(
        self,
        symbol: str,
        data: pd.DataFrame,
        is_long_position: bool
    ) -> bool:
        """Detect momentum divergence for early exit signals."""
        
        if len(data) < self.parameters['divergence_periods']:
            return False
        
        # Get recent price and RSI data
        recent_data = data.tail(self.parameters['divergence_periods'])
        
        if 'rsi' not in recent_data.columns:
            return False
        
        prices = recent_data['close'].values
        rsi_values = recent_data['rsi'].values
        
        # Check for divergence
        price_trend = np.polyfit(range(len(prices)), prices, 1)[0]
        rsi_trend = np.polyfit(range(len(rsi_values)), rsi_values, 1)[0]
        
        if is_long_position:
            # Bearish divergence: price up, momentum down
            return price_trend > 0 and rsi_trend < 0
        else:
            # Bullish divergence: price down, momentum up  
            return price_trend < 0 and rsi_trend > 0
    
    def _calculate_entry_confidence(
        self,
        trend_direction: int,
        trend_strength: float,
        breakout_strength: float,
        adx: Optional[float]
    ) -> float:
        """Calculate entry signal confidence."""
        
        confidence = 0.5  # Base confidence
        
        # Add confidence based on trend strength
        confidence += min(0.3, trend_strength * 5)
        
        # Add confidence based on breakout strength
        confidence += min(0.2, breakout_strength / 10)
        
        # Add confidence based on ADX
        if adx:
            adx_confidence = min(0.2, (adx - 25) / 75) if adx > 25 else 0
            confidence += adx_confidence
        
        return max(0.3, min(1.0, confidence))
    
    def _get_adx_value(self, data: pd.DataFrame) -> Optional[float]:
        """Get current ADX value from data."""
        if 'adx' in data.columns and not data['adx'].empty:
            return data['adx'].iloc[-1]
        return None
    
    async def _on_order_filled_custom(self, order_fill: OrderFilledEvent) -> None:
        """Handle order fill events."""
        symbol = order_fill.symbol
        
        logger.info(
            f"Momentum strategy order filled for {symbol}: "
            f"{order_fill.quantity} @ {order_fill.price} "
            f"(Levels: {self._position_levels.get(symbol, 0)})"
        )
    
    def get_strategy_statistics(self) -> Dict[str, Any]:
        """Get strategy-specific statistics."""
        base_stats = self.get_performance_metrics()
        
        momentum_stats = {
            'strategy_type': 'Momentum/Trend Following',
            'watched_symbols': len(self.watched_symbols),
            'trend_directions': dict(self._trend_direction),
            'trend_strengths': dict(self._trend_strength),
            'position_levels': dict(self._position_levels),
            'active_positions': len([s for s in self.watched_symbols if self.get_position(s) != 0]),
            'parameters': {
                'fast_ema_period': self.parameters['fast_ema_period'],
                'slow_ema_period': self.parameters['slow_ema_period'],
                'adx_threshold': self.parameters['adx_threshold'],
                'initial_stop_atr': self.parameters['initial_stop_atr'],
                'max_pyramid_levels': self.parameters['max_pyramid_levels']
            }
        }
        
        # Merge with base statistics
        base_stats.update(momentum_stats)
        return base_stats