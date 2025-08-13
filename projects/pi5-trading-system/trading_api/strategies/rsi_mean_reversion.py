"""
RSI-based Mean Reversion Strategy for Pi5 Trading System.

This strategy implements a mean reversion approach using the Relative Strength Index (RSI)
to identify overbought and oversold conditions. It assumes that extreme RSI readings
will be followed by price reversals back to the mean.

Strategy Logic:
- BUY when RSI < oversold_threshold (default: 30) and price is falling
- SELL when RSI > overbought_threshold (default: 70) and price is rising
- EXIT positions when RSI crosses back through neutral zone (30-70)

Features:
- Configurable RSI period and thresholds
- Risk management with stop-loss and take-profit
- Position sizing based on volatility (ATR)
- Trend filter to avoid trading against strong trends
- Multi-timeframe confirmation for higher quality signals
"""

import logging
import pandas as pd
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from strategies.enhanced_base import EnhancedBaseStrategy
from core.interfaces import Signal, TradingSignal
from core.exceptions import StrategyExecutionError
from events.event_types import MarketDataEvent, OrderFilledEvent


logger = logging.getLogger(__name__)


class RSIMeanReversionStrategy(EnhancedBaseStrategy):
    """
    RSI-based Mean Reversion Strategy.
    
    Uses RSI to identify overbought/oversold conditions and trades
    in the opposite direction expecting mean reversion.
    """
    
    DEFAULT_PARAMETERS = {
        # RSI Configuration
        'rsi_period': 14,
        'oversold_threshold': 30.0,
        'overbought_threshold': 70.0,
        'rsi_exit_lower': 40.0,  # RSI level to exit long positions
        'rsi_exit_upper': 60.0,  # RSI level to exit short positions
        
        # Risk Management
        'stop_loss_pct': 2.0,      # Stop loss percentage
        'take_profit_pct': 4.0,    # Take profit percentage
        'max_position_size': 0.1,  # Maximum position size (10% of portfolio)
        'risk_per_trade': 0.02,    # Risk 2% per trade
        
        # Volatility-based Position Sizing
        'atr_period': 14,
        'atr_multiplier': 2.0,     # ATR multiplier for position sizing
        
        # Trend Filter
        'use_trend_filter': True,
        'trend_sma_period': 50,    # SMA period for trend identification
        'trend_strength_threshold': 0.02,  # Minimum trend strength (2%)
        
        # Signal Quality
        'min_rsi_duration': 3,     # Minimum periods RSI must stay in zone
        'confirmation_required': True,  # Require price confirmation
        'max_daily_trades': 5,     # Maximum trades per day per symbol
        
        # Multi-timeframe
        'use_higher_timeframe': False,
        'higher_tf_period': '5min',  # Higher timeframe for trend confirmation
    }
    
    def __init__(
        self,
        name: str = "RSI_MeanReversion",
        market_data_manager=None,
        parameters: Dict[str, Any] = None,
        watched_symbols: List[str] = None
    ):
        """
        Initialize RSI Mean Reversion Strategy.
        
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
            max_history_size=200,  # Need more history for indicators
            min_history_required=60,  # Minimum for reliable indicators
            enable_live_data=True,
            data_validation=True
        )
        
        self.watched_symbols = watched_symbols or []
        
        # Strategy state
        self._rsi_zones: Dict[str, str] = {}  # symbol -> current RSI zone
        self._zone_duration: Dict[str, int] = {}  # symbol -> periods in current zone
        self._daily_trade_count: Dict[str, int] = {}  # symbol -> trades today
        self._last_trade_date: Dict[str, datetime] = {}  # symbol -> last trade date
        self._position_entry_prices: Dict[str, float] = {}  # symbol -> entry price
        self._stop_loss_prices: Dict[str, float] = {}  # symbol -> stop loss price
        self._take_profit_prices: Dict[str, float] = {}  # symbol -> take profit price
        
        logger.info(f"RSI Mean Reversion strategy initialized for {len(self.watched_symbols)} symbols")
    
    async def _validate_parameters(self) -> None:
        """Validate strategy parameters."""
        params = self.parameters
        
        # Validate RSI parameters
        if not 2 <= params['rsi_period'] <= 50:
            raise ValueError("RSI period must be between 2 and 50")
        
        if not 0 < params['oversold_threshold'] < 50:
            raise ValueError("Oversold threshold must be between 0 and 50")
        
        if not 50 < params['overbought_threshold'] < 100:
            raise ValueError("Overbought threshold must be between 50 and 100")
        
        if params['oversold_threshold'] >= params['overbought_threshold']:
            raise ValueError("Oversold threshold must be less than overbought threshold")
        
        # Validate risk parameters
        if not 0 < params['stop_loss_pct'] <= 10:
            raise ValueError("Stop loss must be between 0 and 10%")
        
        if not 0 < params['take_profit_pct'] <= 20:
            raise ValueError("Take profit must be between 0 and 20%")
        
        if not 0 < params['max_position_size'] <= 1:
            raise ValueError("Max position size must be between 0 and 1")
        
        logger.info("RSI Mean Reversion parameters validated successfully")
    
    def _get_indicators_config(self) -> Dict[str, Dict[str, Any]]:
        """Configure indicators for this strategy."""
        return {
            'rsi': {'period': self.parameters['rsi_period']},
            'atr': {'period': self.parameters['atr_period']},
            'sma': {'periods': [self.parameters['trend_sma_period']]},
            'ema': {'periods': [20]},  # For additional trend analysis
        }
    
    async def _generate_signals(
        self,
        symbol: str,
        market_data: MarketDataEvent
    ) -> List[Signal]:
        """
        Generate RSI mean reversion signals.
        
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
                periods=100,  # Need sufficient history for indicators
                interval='1min'
            )
            
            if latest_data.empty or len(latest_data) < self.parameters['rsi_period']:
                return signals
            
            # Get current indicator values
            current_rsi = self.get_rsi(symbol)
            current_atr = self.get_atr(symbol)
            current_sma = self.get_sma(symbol, self.parameters['trend_sma_period'])
            current_price = market_data.close_price
            
            if current_rsi is None or current_atr is None:
                return signals
            
            # Update RSI zone tracking
            self._update_rsi_zone(symbol, current_rsi)
            
            # Check daily trade limits
            if not self._can_trade_today(symbol):
                return signals
            
            # Apply trend filter if enabled
            if self.parameters['use_trend_filter'] and current_sma is not None:
                trend_strength = abs(current_price - current_sma) / current_sma
                if trend_strength > self.parameters['trend_strength_threshold']:
                    logger.debug(f"Strong trend detected for {symbol}, filtering signals")
                    return signals
            
            # Get current position
            current_position = self.get_position(symbol)
            
            # Generate entry signals
            if current_position == 0:  # No position
                entry_signal = self._check_entry_conditions(
                    symbol, current_rsi, current_price, latest_data
                )
                if entry_signal:
                    signals.append(entry_signal)
            
            # Generate exit signals
            else:  # Have position
                exit_signal = self._check_exit_conditions(
                    symbol, current_rsi, current_price, current_position
                )
                if exit_signal:
                    signals.append(exit_signal)
            
            return signals
            
        except Exception as e:
            logger.error(f"Error generating RSI signals for {symbol}: {e}")
            raise StrategyExecutionError(f"Signal generation failed: {e}") from e
    
    def _check_entry_conditions(
        self,
        symbol: str,
        current_rsi: float,
        current_price: float,
        data: pd.DataFrame
    ) -> Optional[Signal]:
        """Check for entry signal conditions."""
        
        # Get zone duration requirement
        min_duration = self.parameters['min_rsi_duration']
        zone_duration = self._zone_duration.get(symbol, 0)
        
        # Long entry: RSI oversold
        if (current_rsi < self.parameters['oversold_threshold'] and
            zone_duration >= min_duration):
            
            # Additional confirmation if required
            if self.parameters['confirmation_required']:
                if not self._confirm_long_entry(symbol, data):
                    return None
            
            # Calculate position size
            position_size = self._calculate_position_size(symbol, current_price, data)
            
            if position_size > 0:
                # Set stop loss and take profit
                stop_loss = current_price * (1 - self.parameters['stop_loss_pct'] / 100)
                take_profit = current_price * (1 + self.parameters['take_profit_pct'] / 100)
                
                self._position_entry_prices[symbol] = current_price
                self._stop_loss_prices[symbol] = stop_loss
                self._take_profit_prices[symbol] = take_profit
                
                return self._create_signal(
                    symbol=symbol,
                    signal_type=TradingSignal.BUY,
                    confidence=self._calculate_signal_confidence(current_rsi, True),
                    price=current_price,
                    metadata={
                        'rsi': current_rsi,
                        'position_size': position_size,
                        'stop_loss': stop_loss,
                        'take_profit': take_profit,
                        'entry_reason': 'rsi_oversold',
                        'zone_duration': zone_duration
                    }
                )
        
        # Short entry: RSI overbought
        elif (current_rsi > self.parameters['overbought_threshold'] and
              zone_duration >= min_duration):
            
            # Additional confirmation if required
            if self.parameters['confirmation_required']:
                if not self._confirm_short_entry(symbol, data):
                    return None
            
            # Calculate position size
            position_size = self._calculate_position_size(symbol, current_price, data)
            
            if position_size > 0:
                # Set stop loss and take profit
                stop_loss = current_price * (1 + self.parameters['stop_loss_pct'] / 100)
                take_profit = current_price * (1 - self.parameters['take_profit_pct'] / 100)
                
                self._position_entry_prices[symbol] = current_price
                self._stop_loss_prices[symbol] = stop_loss
                self._take_profit_prices[symbol] = take_profit
                
                return self._create_signal(
                    symbol=symbol,
                    signal_type=TradingSignal.SELL,
                    confidence=self._calculate_signal_confidence(current_rsi, False),
                    price=current_price,
                    metadata={
                        'rsi': current_rsi,
                        'position_size': position_size,
                        'stop_loss': stop_loss,
                        'take_profit': take_profit,
                        'entry_reason': 'rsi_overbought',
                        'zone_duration': zone_duration
                    }
                )
        
        return None
    
    def _check_exit_conditions(
        self,
        symbol: str,
        current_rsi: float,
        current_price: float,
        current_position: float
    ) -> Optional[Signal]:
        """Check for exit signal conditions."""
        
        # Stop loss check
        if symbol in self._stop_loss_prices:
            stop_loss = self._stop_loss_prices[symbol]
            if ((current_position > 0 and current_price <= stop_loss) or
                (current_position < 0 and current_price >= stop_loss)):
                
                return self._create_signal(
                    symbol=symbol,
                    signal_type=TradingSignal.SELL if current_position > 0 else TradingSignal.BUY,
                    confidence=1.0,  # High confidence for stop loss
                    price=current_price,
                    metadata={
                        'rsi': current_rsi,
                        'exit_reason': 'stop_loss',
                        'entry_price': self._position_entry_prices.get(symbol),
                        'pnl_pct': ((current_price / self._position_entry_prices.get(symbol, current_price)) - 1) * 100
                    }
                )
        
        # Take profit check
        if symbol in self._take_profit_prices:
            take_profit = self._take_profit_prices[symbol]
            if ((current_position > 0 and current_price >= take_profit) or
                (current_position < 0 and current_price <= take_profit)):
                
                return self._create_signal(
                    symbol=symbol,
                    signal_type=TradingSignal.SELL if current_position > 0 else TradingSignal.BUY,
                    confidence=1.0,  # High confidence for take profit
                    price=current_price,
                    metadata={
                        'rsi': current_rsi,
                        'exit_reason': 'take_profit',
                        'entry_price': self._position_entry_prices.get(symbol),
                        'pnl_pct': ((current_price / self._position_entry_prices.get(symbol, current_price)) - 1) * 100
                    }
                )
        
        # RSI-based exit conditions
        if current_position > 0:  # Long position
            # Exit when RSI crosses above exit threshold
            if current_rsi >= self.parameters['rsi_exit_lower']:
                return self._create_signal(
                    symbol=symbol,
                    signal_type=TradingSignal.SELL,
                    confidence=self._calculate_exit_confidence(current_rsi, True),
                    price=current_price,
                    metadata={
                        'rsi': current_rsi,
                        'exit_reason': 'rsi_exit_long',
                        'entry_price': self._position_entry_prices.get(symbol),
                        'pnl_pct': ((current_price / self._position_entry_prices.get(symbol, current_price)) - 1) * 100
                    }
                )
        
        elif current_position < 0:  # Short position
            # Exit when RSI crosses below exit threshold
            if current_rsi <= self.parameters['rsi_exit_upper']:
                return self._create_signal(
                    symbol=symbol,
                    signal_type=TradingSignal.BUY,
                    confidence=self._calculate_exit_confidence(current_rsi, False),
                    price=current_price,
                    metadata={
                        'rsi': current_rsi,
                        'exit_reason': 'rsi_exit_short',
                        'entry_price': self._position_entry_prices.get(symbol),
                        'pnl_pct': ((self._position_entry_prices.get(symbol, current_price) / current_price) - 1) * 100
                    }
                )
        
        return None
    
    def _update_rsi_zone(self, symbol: str, current_rsi: float) -> None:
        """Update RSI zone tracking for symbol."""
        current_zone = None
        
        if current_rsi < self.parameters['oversold_threshold']:
            current_zone = 'oversold'
        elif current_rsi > self.parameters['overbought_threshold']:
            current_zone = 'overbought'
        else:
            current_zone = 'neutral'
        
        previous_zone = self._rsi_zones.get(symbol)
        
        if previous_zone == current_zone:
            # Same zone, increment duration
            self._zone_duration[symbol] = self._zone_duration.get(symbol, 0) + 1
        else:
            # Zone changed, reset duration
            self._zone_duration[symbol] = 1
            self._rsi_zones[symbol] = current_zone
    
    def _can_trade_today(self, symbol: str) -> bool:
        """Check if we can trade today based on daily limits."""
        today = datetime.now().date()
        last_trade_date = self._last_trade_date.get(symbol)
        
        # Reset counter if it's a new day
        if last_trade_date is None or last_trade_date.date() != today:
            self._daily_trade_count[symbol] = 0
            return True
        
        # Check daily limit
        daily_count = self._daily_trade_count.get(symbol, 0)
        return daily_count < self.parameters['max_daily_trades']
    
    def _confirm_long_entry(self, symbol: str, data: pd.DataFrame) -> bool:
        """Additional confirmation for long entry."""
        if len(data) < 3:
            return False
        
        # Check if price is declining (supporting mean reversion)
        recent_prices = data['close'].tail(3).values
        if recent_prices[-1] < recent_prices[-2] < recent_prices[-3]:
            return True
        
        # Check if price is below recent EMA
        ema_20 = self.get_ema(symbol, 20)
        if ema_20 and data['close'].iloc[-1] < ema_20:
            return True
        
        return False
    
    def _confirm_short_entry(self, symbol: str, data: pd.DataFrame) -> bool:
        """Additional confirmation for short entry."""
        if len(data) < 3:
            return False
        
        # Check if price is rising (supporting mean reversion)
        recent_prices = data['close'].tail(3).values
        if recent_prices[-1] > recent_prices[-2] > recent_prices[-3]:
            return True
        
        # Check if price is above recent EMA
        ema_20 = self.get_ema(symbol, 20)
        if ema_20 and data['close'].iloc[-1] > ema_20:
            return True
        
        return False
    
    def _calculate_position_size(
        self,
        symbol: str,
        current_price: float,
        data: pd.DataFrame
    ) -> float:
        """Calculate position size based on volatility and risk management."""
        try:
            # Get ATR for volatility-based sizing
            current_atr = self.get_atr(symbol)
            if current_atr is None:
                return 0.0
            
            # Calculate volatility-based position size
            risk_amount = self.parameters['risk_per_trade']  # 2% risk per trade
            atr_multiplier = self.parameters['atr_multiplier']
            
            # Risk per share = ATR * multiplier
            risk_per_share = current_atr * atr_multiplier
            
            # Position size = risk amount / risk per share
            position_size = risk_amount / (risk_per_share / current_price)
            
            # Apply maximum position size limit
            max_position = self.parameters['max_position_size']
            position_size = min(position_size, max_position)
            
            return max(0.0, position_size)
            
        except Exception as e:
            logger.error(f"Error calculating position size for {symbol}: {e}")
            return 0.0
    
    def _calculate_signal_confidence(self, current_rsi: float, is_long: bool) -> float:
        """Calculate signal confidence based on RSI extremeness."""
        if is_long:
            # More extreme oversold = higher confidence
            extremeness = (self.parameters['oversold_threshold'] - current_rsi) / self.parameters['oversold_threshold']
        else:
            # More extreme overbought = higher confidence
            extremeness = (current_rsi - self.parameters['overbought_threshold']) / (100 - self.parameters['overbought_threshold'])
        
        # Confidence between 0.5 and 1.0
        confidence = 0.5 + (extremeness * 0.5)
        return max(0.5, min(1.0, confidence))
    
    def _calculate_exit_confidence(self, current_rsi: float, is_long_exit: bool) -> float:
        """Calculate exit signal confidence."""
        if is_long_exit:
            # Higher RSI = higher exit confidence for long
            confidence = (current_rsi - self.parameters['rsi_exit_lower']) / (70 - self.parameters['rsi_exit_lower'])
        else:
            # Lower RSI = higher exit confidence for short
            confidence = (self.parameters['rsi_exit_upper'] - current_rsi) / (self.parameters['rsi_exit_upper'] - 30)
        
        return max(0.3, min(1.0, confidence))
    
    async def _on_order_filled_custom(self, order_fill: OrderFilledEvent) -> None:
        """Handle order fill events."""
        symbol = order_fill.symbol
        
        # Update daily trade count
        today = datetime.now()
        self._daily_trade_count[symbol] = self._daily_trade_count.get(symbol, 0) + 1
        self._last_trade_date[symbol] = today
        
        # Clear position tracking if closing position
        current_position = self.get_position(symbol)
        if current_position == 0:
            # Position closed, clear tracking data
            self._position_entry_prices.pop(symbol, None)
            self._stop_loss_prices.pop(symbol, None)
            self._take_profit_prices.pop(symbol, None)
        
        logger.info(
            f"Order filled for {symbol}: {order_fill.quantity} @ {order_fill.price} "
            f"(Daily trades: {self._daily_trade_count.get(symbol, 0)})"
        )
    
    def get_strategy_statistics(self) -> Dict[str, Any]:
        """Get strategy-specific statistics."""
        base_stats = self.get_performance_metrics()
        
        rsi_stats = {
            'strategy_type': 'RSI Mean Reversion',
            'watched_symbols': len(self.watched_symbols),
            'rsi_zones': dict(self._rsi_zones),
            'zone_durations': dict(self._zone_duration),
            'daily_trade_counts': dict(self._daily_trade_count),
            'active_positions': len([s for s in self.watched_symbols if self.get_position(s) != 0]),
            'parameters': {
                'rsi_period': self.parameters['rsi_period'],
                'oversold_threshold': self.parameters['oversold_threshold'],
                'overbought_threshold': self.parameters['overbought_threshold'],
                'stop_loss_pct': self.parameters['stop_loss_pct'],
                'take_profit_pct': self.parameters['take_profit_pct']
            }
        }
        
        # Merge with base statistics
        base_stats.update(rsi_stats)
        return base_stats