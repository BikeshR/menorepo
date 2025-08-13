"""
Multi-Timeframe Trend Following Strategy for Pi5 Trading System.

Advanced trend following strategy that analyzes multiple timeframes to identify
high-probability trend continuation signals with proper risk management.

Strategy Logic:
- Higher timeframes (4h, 1d) determine trend bias
- Medium timeframes (1h, 15m) provide signal confirmation
- Lower timeframes (5m, 1m) for precise entry timing
- Multiple technical indicators across timeframes
- Trend strength and momentum analysis
- Risk-adjusted position sizing
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
import numpy as np

from .multi_timeframe_base import (
    MultiTimeframeStrategy, 
    TimeframeConfig, 
    TimeframeType, 
    TimeframeSignal
)
from core.interfaces import Signal, TradingSignal
from core.exceptions import StrategyError


logger = logging.getLogger(__name__)


class MultiTimeframeTrendFollowing(MultiTimeframeStrategy):
    """
    Multi-timeframe trend following strategy.
    
    Uses multiple timeframes to identify strong trends and generate
    high-probability entry signals with proper risk management.
    """
    
    def __init__(
        self,
        name: str = "MultiTimeframeTrendFollowing",
        symbols: List[str] = None,
        parameters: Dict[str, Any] = None,
    ):
        """
        Initialize multi-timeframe trend following strategy.
        
        Args:
            name: Strategy name
            symbols: List of symbols to trade
            parameters: Strategy parameters
        """
        # Default parameters
        default_params = {
            # Trend identification
            'trend_ma_period': 50,
            'momentum_period': 14,
            'atr_period': 14,
            'rsi_period': 14,
            
            # Signal thresholds
            'trend_strength_threshold': 0.6,
            'momentum_threshold': 0.7,
            'rsi_overbought': 70,
            'rsi_oversold': 30,
            
            # Multi-timeframe settings
            'require_all_timeframes': False,
            'min_timeframe_agreement': 0.75,
            'trend_timeframe_weight': 2.0,
            
            # Risk management
            'max_risk_per_trade': 0.02,
            'atr_stop_multiplier': 2.0,
            'min_reward_risk_ratio': 2.0,
        }
        
        if parameters:
            default_params.update(parameters)
        
        # Configure timeframes
        timeframe_configs = [
            # Trend timeframes (higher priority for trend bias)
            TimeframeConfig(
                timeframe=TimeframeType.DAY_1,
                priority=5,
                weight=2.0,
                trend_timeframe=True,
                min_history_periods=100
            ),
            TimeframeConfig(
                timeframe=TimeframeType.HOUR_4,
                priority=4,
                weight=1.8,
                trend_timeframe=True,
                min_history_periods=100
            ),
            
            # Signal timeframes (medium term)
            TimeframeConfig(
                timeframe=TimeframeType.HOUR_1,
                priority=3,
                weight=1.5,
                confirmation_required=True,
                min_history_periods=150
            ),
            TimeframeConfig(
                timeframe=TimeframeType.MINUTE_15,
                priority=2,
                weight=1.2,
                confirmation_required=True,
                primary=True,  # Primary timeframe for entries
                min_history_periods=200
            ),
            
            # Entry timeframes (lower term for precise timing)
            TimeframeConfig(
                timeframe=TimeframeType.MINUTE_5,
                priority=1,
                weight=1.0,
                min_history_periods=300
            ),
        ]
        
        super().__init__(
            name=name,
            timeframe_configs=timeframe_configs,
            parameters=default_params,
            min_confirmation_timeframes=3,
            trend_confirmation_required=True,
            signal_timeout_minutes=60
        )
        
        self.symbols = symbols or ["AAPL", "MSFT", "SPY"]
        
        # Strategy state
        self._trend_strength_cache: Dict[TimeframeType, float] = {}
        self._momentum_cache: Dict[TimeframeType, float] = {}
        self._volatility_cache: Dict[TimeframeType, float] = {}
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def _initialize_strategy(self) -> None:
        """Initialize trend following strategy components."""
        self._logger.info("Initializing multi-timeframe trend following strategy")
        
        # Initialize caches
        for timeframe in self.timeframe_configs:
            self._trend_strength_cache[timeframe] = 0.0
            self._momentum_cache[timeframe] = 0.0
            self._volatility_cache[timeframe] = 0.0
        
        self._logger.info(f"Strategy initialized for symbols: {self.symbols}")
    
    async def _analyze_timeframe(
        self, 
        timeframe: TimeframeType, 
        data: pd.DataFrame, 
        indicators: Dict[str, pd.Series]
    ) -> Optional[TimeframeSignal]:
        """Analyze trend following signals for a specific timeframe."""
        try:
            if len(data) < 50:  # Need sufficient data
                return None
            
            # Calculate trend analysis
            trend_analysis = await self._analyze_trend(timeframe, data, indicators)
            if not trend_analysis:
                return None
            
            signal_type, strength, metadata = trend_analysis
            
            # Create signal
            signal = Signal(
                symbol=data['symbol'].iloc[-1] if 'symbol' in data else "UNKNOWN",
                signal_type=signal_type,
                confidence=strength,
                price=data['close'].iloc[-1],
                timestamp=datetime.utcnow(),
                strategy_name=f"{self.name}_{timeframe.value}",
                metadata=metadata
            )
            
            # Create timeframe signal
            tf_signal = TimeframeSignal(
                timeframe=timeframe,
                signal=signal,
                strength=strength,
                indicators={
                    key: value.iloc[-1] if hasattr(value, 'iloc') and len(value) > 0 else 0.0
                    for key, value in indicators.items()
                },
                metadata=metadata,
                timestamp=datetime.utcnow()
            )
            
            # Cache values
            self._trend_strength_cache[timeframe] = metadata.get('trend_strength', 0.0)
            self._momentum_cache[timeframe] = metadata.get('momentum_score', 0.0)
            self._volatility_cache[timeframe] = metadata.get('volatility_score', 0.0)
            
            return tf_signal
            
        except Exception as e:
            self._logger.error(f"Error analyzing timeframe {timeframe.value}: {e}")
            return None
    
    async def _calculate_strategy_indicators(
        self, 
        timeframe: TimeframeType, 
        data: pd.DataFrame
    ) -> Dict[str, pd.Series]:
        """Calculate trend following specific indicators."""
        try:
            indicators = {}
            
            if len(data) < 20:
                return indicators
            
            # Additional EMAs for trend analysis
            indicators['ema_8'] = self.indicators.ema(data['close'], 8)
            indicators['ema_21'] = self.indicators.ema(data['close'], 21)
            indicators['ema_55'] = self.indicators.ema(data['close'], 55)
            
            # Trend strength indicator (ADX)
            if len(data) >= self.parameters['trend_ma_period']:
                indicators['adx'] = self._calculate_adx(data)
            
            # Momentum oscillator
            indicators['momentum'] = self._calculate_momentum(data)
            
            # Volatility ratio
            indicators['volatility_ratio'] = self._calculate_volatility_ratio(data)
            
            # Trend direction score
            indicators['trend_score'] = self._calculate_trend_score(data, indicators)
            
            return indicators
            
        except Exception as e:
            self._logger.error(f"Error calculating strategy indicators: {e}")
            return {}
    
    async def _analyze_trend(
        self,
        timeframe: TimeframeType,
        data: pd.DataFrame,
        indicators: Dict[str, pd.Series]
    ) -> Optional[Tuple[TradingSignal, float, Dict[str, Any]]]:
        """Perform comprehensive trend analysis for a timeframe."""
        try:
            # Get latest values
            current_price = data['close'].iloc[-1]
            
            # Trend direction analysis
            trend_direction = self._analyze_trend_direction(indicators)
            trend_strength = self._analyze_trend_strength(indicators)
            momentum_score = self._analyze_momentum(indicators)
            volatility_score = self._analyze_volatility(indicators)
            
            # Calculate overall signal strength
            signal_strength = self._calculate_signal_strength(
                trend_direction, trend_strength, momentum_score, volatility_score, timeframe
            )
            
            # Determine signal type
            signal_type = self._determine_signal_type(
                trend_direction, trend_strength, momentum_score, timeframe
            )
            
            # Compile metadata
            metadata = {
                'timeframe': timeframe.value,
                'trend_direction': trend_direction,
                'trend_strength': trend_strength,
                'momentum_score': momentum_score,
                'volatility_score': volatility_score,
                'signal_strength': signal_strength,
                'price': current_price,
                'analysis_time': datetime.utcnow().isoformat(),
            }
            
            # Add indicator values
            for key, value in indicators.items():
                if hasattr(value, 'iloc') and len(value) > 0:
                    metadata[f'indicator_{key}'] = float(value.iloc[-1])
            
            return signal_type, signal_strength, metadata
            
        except Exception as e:
            self._logger.error(f"Error in trend analysis: {e}")
            return None
    
    def _analyze_trend_direction(self, indicators: Dict[str, pd.Series]) -> float:
        """Analyze trend direction (-1 to 1, where 1 is strong uptrend)."""
        try:
            direction_score = 0.0
            score_count = 0
            
            # EMA alignment
            if all(key in indicators for key in ['ema_8', 'ema_21', 'ema_55']):
                ema_8 = indicators['ema_8'].iloc[-1]
                ema_21 = indicators['ema_21'].iloc[-1]
                ema_55 = indicators['ema_55'].iloc[-1]
                
                if ema_8 > ema_21 > ema_55:
                    direction_score += 1.0
                elif ema_8 < ema_21 < ema_55:
                    direction_score -= 1.0
                else:
                    # Mixed signals
                    if ema_8 > ema_21:
                        direction_score += 0.5
                    else:
                        direction_score -= 0.5
                
                score_count += 1
            
            # Moving average slope
            if 'sma_20' in indicators and len(indicators['sma_20']) >= 5:
                ma_slope = (indicators['sma_20'].iloc[-1] - indicators['sma_20'].iloc[-5]) / 5
                current_price = indicators['sma_20'].iloc[-1]
                slope_pct = (ma_slope / current_price) * 100 if current_price > 0 else 0
                
                # Normalize slope to -1 to 1 range
                direction_score += np.tanh(slope_pct * 2)
                score_count += 1
            
            # Price vs MA position
            if 'sma_50' in indicators:
                price_vs_ma = (indicators['sma_50'].iloc[-1] - indicators['sma_50'].iloc[-2]) / indicators['sma_50'].iloc[-2]
                direction_score += np.tanh(price_vs_ma * 50)
                score_count += 1
            
            return direction_score / score_count if score_count > 0 else 0.0
            
        except Exception as e:
            self._logger.error(f"Error analyzing trend direction: {e}")
            return 0.0
    
    def _analyze_trend_strength(self, indicators: Dict[str, pd.Series]) -> float:
        """Analyze trend strength (0 to 1)."""
        try:
            strength_score = 0.0
            score_count = 0
            
            # ADX for trend strength
            if 'adx' in indicators and len(indicators['adx']) > 0:
                adx_value = indicators['adx'].iloc[-1]
                # ADX > 25 indicates strong trend
                strength_score += min(1.0, adx_value / 50.0)
                score_count += 1
            
            # Volatility-adjusted trend strength
            if 'atr' in indicators and 'sma_20' in indicators:
                atr = indicators['atr'].iloc[-1]
                price = indicators['sma_20'].iloc[-1]
                volatility_pct = (atr / price) * 100 if price > 0 else 0
                
                # Lower volatility during trend indicates strength
                vol_strength = max(0.0, 1.0 - (volatility_pct / 5.0))
                strength_score += vol_strength
                score_count += 1
            
            # Price momentum consistency
            if 'momentum' in indicators and len(indicators['momentum']) >= 5:
                momentum_values = indicators['momentum'].tail(5)
                momentum_consistency = 1.0 - (momentum_values.std() / abs(momentum_values.mean())) if momentum_values.mean() != 0 else 0.0
                strength_score += max(0.0, min(1.0, momentum_consistency))
                score_count += 1
            
            return strength_score / score_count if score_count > 0 else 0.0
            
        except Exception as e:
            self._logger.error(f"Error analyzing trend strength: {e}")
            return 0.0
    
    def _analyze_momentum(self, indicators: Dict[str, pd.Series]) -> float:
        """Analyze momentum (-1 to 1)."""
        try:
            momentum_score = 0.0
            score_count = 0
            
            # RSI momentum
            if 'rsi' in indicators and len(indicators['rsi']) > 0:
                rsi = indicators['rsi'].iloc[-1]
                # Normalize RSI to -1 to 1 range
                rsi_momentum = (rsi - 50) / 50
                momentum_score += rsi_momentum
                score_count += 1
            
            # MACD momentum
            if 'macd' in indicators and 'macd_signal' in indicators:
                macd = indicators['macd'].iloc[-1]
                macd_signal = indicators['macd_signal'].iloc[-1]
                macd_momentum = 1.0 if macd > macd_signal else -1.0
                momentum_score += macd_momentum
                score_count += 1
            
            # Price momentum
            if 'momentum' in indicators and len(indicators['momentum']) > 0:
                price_momentum = indicators['momentum'].iloc[-1]
                # Normalize to -1 to 1 range
                momentum_score += np.tanh(price_momentum / 100)
                score_count += 1
            
            return momentum_score / score_count if score_count > 0 else 0.0
            
        except Exception as e:
            self._logger.error(f"Error analyzing momentum: {e}")
            return 0.0
    
    def _analyze_volatility(self, indicators: Dict[str, pd.Series]) -> float:
        """Analyze volatility (0 to 1, where 1 is high volatility)."""
        try:
            if 'volatility_ratio' in indicators and len(indicators['volatility_ratio']) > 0:
                return min(1.0, indicators['volatility_ratio'].iloc[-1])
            
            # Fallback to ATR-based volatility
            if 'atr' in indicators and 'sma_20' in indicators:
                atr = indicators['atr'].iloc[-1]
                price = indicators['sma_20'].iloc[-1]
                volatility_pct = (atr / price) * 100 if price > 0 else 0
                return min(1.0, volatility_pct / 5.0)  # Normalize to 5% as high volatility
            
            return 0.5  # Default medium volatility
            
        except Exception as e:
            self._logger.error(f"Error analyzing volatility: {e}")
            return 0.5
    
    def _calculate_signal_strength(
        self,
        trend_direction: float,
        trend_strength: float,
        momentum_score: float,
        volatility_score: float,
        timeframe: TimeframeType
    ) -> float:
        """Calculate overall signal strength."""
        try:
            # Base strength from trend and momentum alignment
            alignment_strength = abs(trend_direction) * trend_strength
            
            # Momentum confirmation
            momentum_confirmation = 1.0 if (trend_direction * momentum_score) > 0 else 0.5
            
            # Volatility adjustment (prefer medium volatility)
            volatility_adjustment = 1.0 - abs(volatility_score - 0.5)
            
            # Timeframe weight
            config = self.timeframe_configs[timeframe]
            timeframe_weight = config.weight
            
            # Calculate composite strength
            signal_strength = (
                alignment_strength * 0.4 +
                momentum_confirmation * 0.3 +
                volatility_adjustment * 0.2 +
                (timeframe_weight / 2.0) * 0.1
            )
            
            return min(1.0, max(0.0, signal_strength))
            
        except Exception as e:
            self._logger.error(f"Error calculating signal strength: {e}")
            return 0.0
    
    def _determine_signal_type(
        self,
        trend_direction: float,
        trend_strength: float,
        momentum_score: float,
        timeframe: TimeframeType
    ) -> TradingSignal:
        """Determine the signal type based on analysis."""
        try:
            # Check thresholds
            trend_threshold = self.parameters['trend_strength_threshold']
            momentum_threshold = self.parameters['momentum_threshold']
            
            # Strong trend required
            if trend_strength < trend_threshold:
                return TradingSignal.HOLD
            
            # Check trend direction and momentum alignment
            if trend_direction > 0.2 and momentum_score > 0.1:
                # Uptrend with positive momentum
                if trend_strength > trend_threshold and abs(momentum_score) > 0.3:
                    return TradingSignal.BUY
            elif trend_direction < -0.2 and momentum_score < -0.1:
                # Downtrend with negative momentum
                if trend_strength > trend_threshold and abs(momentum_score) > 0.3:
                    return TradingSignal.SELL
            
            return TradingSignal.HOLD
            
        except Exception as e:
            self._logger.error(f"Error determining signal type: {e}")
            return TradingSignal.HOLD
    
    # Technical indicator calculations
    
    def _calculate_adx(self, data: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate Average Directional Index (ADX)."""
        try:
            high = data['high']
            low = data['low']
            close = data['close']
            
            # Calculate True Range
            tr1 = high - low
            tr2 = abs(high - close.shift(1))
            tr3 = abs(low - close.shift(1))
            tr = pd.DataFrame({'tr1': tr1, 'tr2': tr2, 'tr3': tr3}).max(axis=1)
            
            # Calculate Directional Movement
            dm_plus = high - high.shift(1)
            dm_minus = low.shift(1) - low
            
            dm_plus[dm_plus < 0] = 0
            dm_minus[dm_minus < 0] = 0
            dm_plus[(dm_plus - dm_minus) <= 0] = 0
            dm_minus[(dm_minus - dm_plus) <= 0] = 0
            
            # Smooth the values
            tr_smooth = tr.rolling(window=period).mean()
            dm_plus_smooth = dm_plus.rolling(window=period).mean()
            dm_minus_smooth = dm_minus.rolling(window=period).mean()
            
            # Calculate DI
            di_plus = 100 * (dm_plus_smooth / tr_smooth)
            di_minus = 100 * (dm_minus_smooth / tr_smooth)
            
            # Calculate DX
            dx = 100 * abs(di_plus - di_minus) / (di_plus + di_minus)
            
            # Calculate ADX
            adx = dx.rolling(window=period).mean()
            
            return adx
            
        except Exception as e:
            self._logger.error(f"Error calculating ADX: {e}")
            return pd.Series(index=data.index, dtype=float)
    
    def _calculate_momentum(self, data: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate price momentum."""
        try:
            close = data['close']
            momentum = ((close - close.shift(period)) / close.shift(period)) * 100
            return momentum
            
        except Exception as e:
            self._logger.error(f"Error calculating momentum: {e}")
            return pd.Series(index=data.index, dtype=float)
    
    def _calculate_volatility_ratio(self, data: pd.DataFrame, period: int = 20) -> pd.Series:
        """Calculate volatility ratio."""
        try:
            close = data['close']
            returns = close.pct_change()
            volatility = returns.rolling(window=period).std()
            
            # Normalize volatility
            avg_volatility = volatility.rolling(window=period * 2).mean()
            volatility_ratio = volatility / avg_volatility
            
            return volatility_ratio.fillna(1.0)
            
        except Exception as e:
            self._logger.error(f"Error calculating volatility ratio: {e}")
            return pd.Series(index=data.index, dtype=float).fillna(1.0)
    
    def _calculate_trend_score(self, data: pd.DataFrame, indicators: Dict[str, pd.Series]) -> pd.Series:
        """Calculate comprehensive trend score."""
        try:
            close = data['close']
            trend_scores = []
            
            # EMA trend score
            if all(key in indicators for key in ['ema_8', 'ema_21']):
                ema_8 = indicators['ema_8']
                ema_21 = indicators['ema_21']
                ema_trend = (ema_8 - ema_21) / ema_21
                trend_scores.append(ema_trend)
            
            # Price vs MA trend score
            if 'sma_50' in indicators:
                sma_50 = indicators['sma_50']
                price_trend = (close - sma_50) / sma_50
                trend_scores.append(price_trend)
            
            # Combine trend scores
            if trend_scores:
                combined_trend = pd.concat(trend_scores, axis=1).mean(axis=1)
                return combined_trend
            else:
                return pd.Series(index=data.index, dtype=float)
                
        except Exception as e:
            self._logger.error(f"Error calculating trend score: {e}")
            return pd.Series(index=data.index, dtype=float)
    
    def get_strategy_status(self) -> Dict[str, Any]:
        """Get comprehensive strategy status."""
        base_status = self.get_multi_timeframe_status()
        
        # Add strategy-specific status
        strategy_status = {
            'trend_cache': {
                tf.value: {
                    'trend_strength': self._trend_strength_cache.get(tf, 0.0),
                    'momentum': self._momentum_cache.get(tf, 0.0),
                    'volatility': self._volatility_cache.get(tf, 0.0),
                }
                for tf in self.timeframe_configs
            },
            'symbols': self.symbols,
            'parameters': self.parameters,
        }
        
        return {**base_status, **strategy_status}