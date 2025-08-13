"""
Multi-Timeframe Strategy Base for Pi5 Trading System.

Advanced strategy framework supporting multiple timeframe analysis for
enhanced trading decision making and trend confirmation.

Features:
- Multi-timeframe data management and synchronization
- Timeframe hierarchy and dependency management
- Cross-timeframe signal confirmation and filtering
- Adaptive timeframe selection based on market conditions
- Higher timeframe trend bias and lower timeframe entries
- Timeframe-specific indicator calculations
- Signal strength aggregation across timeframes
- Risk management per timeframe level
"""

import asyncio
import logging
from abc import abstractmethod
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Set
from enum import Enum
from dataclasses import dataclass
import pandas as pd
import numpy as np

from core.interfaces import BaseStrategy, Signal, TradingSignal, MarketDataEvent
from core.market_data.indicators import TechnicalIndicators
from core.exceptions import StrategyError


logger = logging.getLogger(__name__)


class TimeframeType(Enum):
    """Standard timeframe types."""
    TICK = "tick"
    SECOND_1 = "1s"
    SECOND_5 = "5s"
    SECOND_15 = "15s"
    SECOND_30 = "30s"
    MINUTE_1 = "1m"
    MINUTE_2 = "2m"
    MINUTE_3 = "3m"
    MINUTE_5 = "5m"
    MINUTE_15 = "15m"
    MINUTE_30 = "30m"
    HOUR_1 = "1h"
    HOUR_2 = "2h"
    HOUR_4 = "4h"
    HOUR_6 = "6h"
    HOUR_12 = "12h"
    DAY_1 = "1d"
    WEEK_1 = "1w"
    MONTH_1 = "1M"


@dataclass
class TimeframeConfig:
    """Configuration for a specific timeframe."""
    timeframe: TimeframeType
    priority: int = 1  # Higher = more important
    min_history_periods: int = 100
    enabled: bool = True
    weight: float = 1.0  # Weight in signal aggregation
    primary: bool = False  # Primary timeframe for entries
    confirmation_required: bool = False  # Requires confirmation from other timeframes
    trend_timeframe: bool = False  # Used for trend bias
    
    def get_seconds(self) -> int:
        """Get timeframe duration in seconds."""
        mapping = {
            TimeframeType.TICK: 0,
            TimeframeType.SECOND_1: 1,
            TimeframeType.SECOND_5: 5,
            TimeframeType.SECOND_15: 15,
            TimeframeType.SECOND_30: 30,
            TimeframeType.MINUTE_1: 60,
            TimeframeType.MINUTE_2: 120,
            TimeframeType.MINUTE_3: 180,
            TimeframeType.MINUTE_5: 300,
            TimeframeType.MINUTE_15: 900,
            TimeframeType.MINUTE_30: 1800,
            TimeframeType.HOUR_1: 3600,
            TimeframeType.HOUR_2: 7200,
            TimeframeType.HOUR_4: 14400,
            TimeframeType.HOUR_6: 21600,
            TimeframeType.HOUR_12: 43200,
            TimeframeType.DAY_1: 86400,
            TimeframeType.WEEK_1: 604800,
            TimeframeType.MONTH_1: 2592000,
        }
        return mapping.get(self.timeframe, 0)


@dataclass
class TimeframeSignal:
    """Signal from a specific timeframe."""
    timeframe: TimeframeType
    signal: Signal
    strength: float  # 0.0 to 1.0
    indicators: Dict[str, float]
    metadata: Dict[str, Any]
    timestamp: datetime
    
    @property
    def weighted_strength(self) -> float:
        """Calculate weighted signal strength."""
        return self.signal.confidence * self.strength


@dataclass
class MultiTimeframeAnalysis:
    """Combined analysis across multiple timeframes."""
    primary_signal: Optional[Signal]
    timeframe_signals: Dict[TimeframeType, TimeframeSignal]
    trend_bias: TradingSignal
    confidence_score: float
    conflicting_signals: bool
    dominant_timeframe: TimeframeType
    analysis_timestamp: datetime
    
    def get_signal_consensus(self) -> Tuple[TradingSignal, float]:
        """Calculate signal consensus across timeframes."""
        if not self.timeframe_signals:
            return TradingSignal.HOLD, 0.0
        
        signal_weights = {
            TradingSignal.BUY: 0.0,
            TradingSignal.SELL: 0.0,
            TradingSignal.HOLD: 0.0,
        }
        
        total_weight = 0.0
        
        for tf_signal in self.timeframe_signals.values():
            weight = tf_signal.weighted_strength
            signal_weights[tf_signal.signal.signal_type] += weight
            total_weight += weight
        
        if total_weight == 0:
            return TradingSignal.HOLD, 0.0
        
        # Normalize weights
        for signal_type in signal_weights:
            signal_weights[signal_type] /= total_weight
        
        # Find dominant signal
        dominant_signal = max(signal_weights, key=signal_weights.get)
        consensus_strength = signal_weights[dominant_signal]
        
        return dominant_signal, consensus_strength


class MultiTimeframeStrategy(BaseStrategy):
    """
    Multi-timeframe strategy base class.
    
    Provides framework for analyzing multiple timeframes and generating
    signals based on cross-timeframe confirmation and trend analysis.
    """
    
    def __init__(
        self,
        name: str,
        timeframe_configs: List[TimeframeConfig],
        parameters: Dict[str, Any] = None,
        min_confirmation_timeframes: int = 2,
        trend_confirmation_required: bool = True,
        signal_timeout_minutes: int = 30,
    ):
        """
        Initialize multi-timeframe strategy.
        
        Args:
            name: Strategy name
            timeframe_configs: List of timeframe configurations
            parameters: Strategy parameters
            min_confirmation_timeframes: Minimum timeframes for signal confirmation
            trend_confirmation_required: Require trend confirmation
            signal_timeout_minutes: Signal timeout in minutes
        """
        super().__init__(name, parameters)
        
        self.timeframe_configs = {tf.timeframe: tf for tf in timeframe_configs}
        self.min_confirmation_timeframes = min_confirmation_timeframes
        self.trend_confirmation_required = trend_confirmation_required
        self.signal_timeout_minutes = signal_timeout_minutes
        
        # Data storage for each timeframe
        self._timeframe_data: Dict[TimeframeType, pd.DataFrame] = {}
        self._timeframe_indicators: Dict[TimeframeType, Dict[str, pd.Series]] = {}
        self._timeframe_signals: Dict[TimeframeType, List[TimeframeSignal]] = {}
        
        # Analysis state
        self._last_analysis: Optional[MultiTimeframeAnalysis] = None
        self._trend_bias = TradingSignal.HOLD
        self._trend_strength = 0.0
        self._market_regime = "normal"  # normal, trending, ranging, volatile
        
        # Technical indicators calculator
        self.indicators = TechnicalIndicators()
        
        # Primary timeframe for signal generation
        self.primary_timeframe = self._find_primary_timeframe()
        
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
    
    async def initialize(self) -> None:
        """Initialize multi-timeframe strategy."""
        self._logger.info(f"Initializing multi-timeframe strategy: {self.name}")
        
        # Initialize data structures for each timeframe
        for timeframe in self.timeframe_configs:
            self._timeframe_data[timeframe] = pd.DataFrame()
            self._timeframe_indicators[timeframe] = {}
            self._timeframe_signals[timeframe] = []
        
        # Initialize strategy-specific components
        await self._initialize_strategy()
        
        self._logger.info(
            f"Strategy initialized with {len(self.timeframe_configs)} timeframes, "
            f"primary: {self.primary_timeframe.value if self.primary_timeframe else 'None'}"
        )
    
    async def on_market_data(self, market_data: MarketDataEvent) -> List[Signal]:
        """Process market data across multiple timeframes."""
        try:
            signals = []
            
            # Update data for each timeframe
            await self._update_timeframe_data(market_data)
            
            # Calculate indicators for each timeframe
            await self._calculate_timeframe_indicators()
            
            # Analyze each timeframe
            timeframe_analyses = await self._analyze_all_timeframes()
            
            # Perform multi-timeframe analysis
            mt_analysis = await self._perform_multi_timeframe_analysis(timeframe_analyses)
            
            # Generate signals based on analysis
            if mt_analysis:
                strategy_signals = await self._generate_signals_from_analysis(mt_analysis)
                signals.extend(strategy_signals)
                
                # Store analysis for reference
                self._last_analysis = mt_analysis
            
            # Clean up old signals
            await self._cleanup_old_signals()
            
            return signals
            
        except Exception as e:
            self._logger.error(f"Error processing market data: {e}")
            return []
    
    def get_required_history(self) -> int:
        """Return maximum history needed across all timeframes."""
        return max(
            config.min_history_periods for config in self.timeframe_configs.values()
        )
    
    def get_multi_timeframe_status(self) -> Dict[str, Any]:
        """Get comprehensive multi-timeframe status."""
        status = {
            'strategy_name': self.name,
            'timeframes': {},
            'trend_bias': self._trend_bias.value,
            'trend_strength': self._trend_strength,
            'market_regime': self._market_regime,
            'last_analysis': None,
        }
        
        # Add timeframe status
        for timeframe, config in self.timeframe_configs.items():
            data_len = len(self._timeframe_data.get(timeframe, []))
            signals_count = len(self._timeframe_signals.get(timeframe, []))
            
            status['timeframes'][timeframe.value] = {
                'enabled': config.enabled,
                'priority': config.priority,
                'weight': config.weight,
                'data_points': data_len,
                'signals_count': signals_count,
                'has_sufficient_data': data_len >= config.min_history_periods,
            }
        
        # Add last analysis summary
        if self._last_analysis:
            status['last_analysis'] = {
                'timestamp': self._last_analysis.analysis_timestamp.isoformat(),
                'primary_signal': self._last_analysis.primary_signal.signal_type.value if self._last_analysis.primary_signal else None,
                'confidence': self._last_analysis.confidence_score,
                'conflicting_signals': self._last_analysis.conflicting_signals,
                'dominant_timeframe': self._last_analysis.dominant_timeframe.value,
                'timeframe_count': len(self._last_analysis.timeframe_signals),
            }
        
        return status
    
    # Abstract methods for strategy implementation
    
    @abstractmethod
    async def _initialize_strategy(self) -> None:
        """Initialize strategy-specific components."""
        pass
    
    @abstractmethod
    async def _analyze_timeframe(
        self, 
        timeframe: TimeframeType, 
        data: pd.DataFrame, 
        indicators: Dict[str, pd.Series]
    ) -> Optional[TimeframeSignal]:
        """Analyze a specific timeframe and generate signal."""
        pass
    
    @abstractmethod
    async def _calculate_strategy_indicators(
        self, 
        timeframe: TimeframeType, 
        data: pd.DataFrame
    ) -> Dict[str, pd.Series]:
        """Calculate strategy-specific indicators for a timeframe."""
        pass
    
    # Multi-timeframe analysis methods
    
    async def _update_timeframe_data(self, market_data: MarketDataEvent) -> None:
        """Update data for all configured timeframes."""
        for timeframe, config in self.timeframe_configs.items():
            if not config.enabled:
                continue
            
            # Convert market data to appropriate timeframe
            timeframe_data = await self._resample_to_timeframe(market_data, timeframe)
            
            if timeframe_data is not None:
                # Update stored data
                if timeframe not in self._timeframe_data:
                    self._timeframe_data[timeframe] = pd.DataFrame()
                
                # Append new data and maintain size limits
                self._timeframe_data[timeframe] = pd.concat([
                    self._timeframe_data[timeframe], 
                    timeframe_data
                ]).tail(config.min_history_periods * 2)  # Keep extra for calculations
    
    async def _resample_to_timeframe(
        self, 
        market_data: MarketDataEvent, 
        timeframe: TimeframeType
    ) -> Optional[pd.DataFrame]:
        """Resample market data to specific timeframe."""
        try:
            # Create DataFrame from market data
            data_row = {
                'timestamp': market_data.timestamp,
                'open': market_data.price,
                'high': market_data.price,
                'low': market_data.price,
                'close': market_data.price,
                'volume': getattr(market_data, 'volume', 0),
                'symbol': market_data.symbol,
            }
            
            df = pd.DataFrame([data_row])
            df.set_index('timestamp', inplace=True)
            
            # For tick/1s data, return as-is
            if timeframe in [TimeframeType.TICK, TimeframeType.SECOND_1]:
                return df
            
            # For higher timeframes, we would normally resample existing data
            # This is a simplified version - in practice, you'd maintain tick data
            # and resample it to higher timeframes
            
            return df
            
        except Exception as e:
            self._logger.error(f"Error resampling to {timeframe.value}: {e}")
            return None
    
    async def _calculate_timeframe_indicators(self) -> None:
        """Calculate indicators for all timeframes."""
        for timeframe, config in self.timeframe_configs.items():
            if not config.enabled:
                continue
            
            data = self._timeframe_data.get(timeframe)
            if data is None or len(data) < config.min_history_periods:
                continue
            
            try:
                # Calculate standard technical indicators
                indicators = await self._calculate_standard_indicators(timeframe, data)
                
                # Calculate strategy-specific indicators
                strategy_indicators = await self._calculate_strategy_indicators(timeframe, data)
                
                # Combine indicators
                all_indicators = {**indicators, **strategy_indicators}
                self._timeframe_indicators[timeframe] = all_indicators
                
            except Exception as e:
                self._logger.error(f"Error calculating indicators for {timeframe.value}: {e}")
    
    async def _calculate_standard_indicators(
        self, 
        timeframe: TimeframeType, 
        data: pd.DataFrame
    ) -> Dict[str, pd.Series]:
        """Calculate standard technical indicators."""
        try:
            indicators = {}
            
            if len(data) < 20:  # Need minimum data for indicators
                return indicators
            
            # Moving averages
            indicators['sma_20'] = self.indicators.sma(data['close'], 20)
            indicators['sma_50'] = self.indicators.sma(data['close'], 50)
            indicators['ema_12'] = self.indicators.ema(data['close'], 12)
            indicators['ema_26'] = self.indicators.ema(data['close'], 26)
            
            # RSI
            indicators['rsi'] = self.indicators.rsi(data['close'], 14)
            
            # MACD
            macd_line, signal_line, histogram = self.indicators.macd(data['close'])
            indicators['macd'] = macd_line
            indicators['macd_signal'] = signal_line
            indicators['macd_histogram'] = histogram
            
            # Bollinger Bands
            upper, middle, lower = self.indicators.bollinger_bands(data['close'], 20, 2)
            indicators['bb_upper'] = upper
            indicators['bb_middle'] = middle
            indicators['bb_lower'] = lower
            
            # ATR for volatility
            indicators['atr'] = self.indicators.atr(data['high'], data['low'], data['close'], 14)
            
            return indicators
            
        except Exception as e:
            self._logger.error(f"Error calculating standard indicators: {e}")
            return {}
    
    async def _analyze_all_timeframes(self) -> Dict[TimeframeType, TimeframeSignal]:
        """Analyze all configured timeframes."""
        analyses = {}
        
        for timeframe, config in self.timeframe_configs.items():
            if not config.enabled:
                continue
            
            data = self._timeframe_data.get(timeframe)
            indicators = self._timeframe_indicators.get(timeframe, {})
            
            if data is None or len(data) < config.min_history_periods:
                continue
            
            try:
                analysis = await self._analyze_timeframe(timeframe, data, indicators)
                if analysis:
                    analyses[timeframe] = analysis
                    
                    # Store signal for this timeframe
                    self._timeframe_signals[timeframe].append(analysis)
                    
            except Exception as e:
                self._logger.error(f"Error analyzing timeframe {timeframe.value}: {e}")
        
        return analyses
    
    async def _perform_multi_timeframe_analysis(
        self, 
        timeframe_analyses: Dict[TimeframeType, TimeframeSignal]
    ) -> Optional[MultiTimeframeAnalysis]:
        """Perform comprehensive multi-timeframe analysis."""
        try:
            if not timeframe_analyses:
                return None
            
            # Update trend bias from higher timeframes
            await self._update_trend_bias(timeframe_analyses)
            
            # Detect market regime
            await self._detect_market_regime(timeframe_analyses)
            
            # Check for signal consensus
            consensus_signal, consensus_strength = self._calculate_signal_consensus(timeframe_analyses)
            
            # Check for conflicting signals
            conflicting = self._detect_conflicting_signals(timeframe_analyses)
            
            # Find dominant timeframe
            dominant_tf = self._find_dominant_timeframe(timeframe_analyses)
            
            # Generate primary signal if conditions are met
            primary_signal = None
            if (consensus_strength >= 0.6 and  # Strong consensus
                len(timeframe_analyses) >= self.min_confirmation_timeframes and
                (not self.trend_confirmation_required or self._trend_confirms_signal(consensus_signal))):
                
                primary_signal = Signal(
                    symbol=list(timeframe_analyses.values())[0].signal.symbol,
                    signal_type=consensus_signal,
                    confidence=consensus_strength,
                    price=list(timeframe_analyses.values())[0].signal.price,
                    timestamp=datetime.utcnow(),
                    strategy_name=self.name,
                    metadata={
                        'multi_timeframe_analysis': True,
                        'timeframe_count': len(timeframe_analyses),
                        'trend_bias': self._trend_bias.value,
                        'market_regime': self._market_regime,
                        'conflicting_signals': conflicting,
                    }
                )
            
            return MultiTimeframeAnalysis(
                primary_signal=primary_signal,
                timeframe_signals=timeframe_analyses,
                trend_bias=self._trend_bias,
                confidence_score=consensus_strength,
                conflicting_signals=conflicting,
                dominant_timeframe=dominant_tf,
                analysis_timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            self._logger.error(f"Error in multi-timeframe analysis: {e}")
            return None
    
    async def _update_trend_bias(self, analyses: Dict[TimeframeType, TimeframeSignal]) -> None:
        """Update trend bias from higher timeframe analysis."""
        # Find highest priority timeframe with trend designation
        trend_timeframes = [
            (tf, signal) for tf, signal in analyses.items()
            if self.timeframe_configs[tf].trend_timeframe
        ]
        
        if not trend_timeframes:
            return
        
        # Sort by timeframe duration (higher timeframes have more weight)
        trend_timeframes.sort(
            key=lambda x: self.timeframe_configs[x[0]].get_seconds(), 
            reverse=True
        )
        
        # Use highest timeframe for trend bias
        highest_tf, signal = trend_timeframes[0]
        self._trend_bias = signal.signal.signal_type
        self._trend_strength = signal.strength
    
    async def _detect_market_regime(self, analyses: Dict[TimeframeType, TimeframeSignal]) -> None:
        """Detect current market regime."""
        try:
            # Analyze volatility and trend consistency across timeframes
            volatilities = []
            trend_consistencies = []
            
            for timeframe, signal in analyses.items():
                # Get ATR from indicators for volatility measurement
                indicators = self._timeframe_indicators.get(timeframe, {})
                atr = indicators.get('atr')
                
                if atr is not None and len(atr) > 0:
                    current_atr = atr.iloc[-1]
                    price = signal.signal.price
                    volatility_pct = (current_atr / price) * 100 if price > 0 else 0
                    volatilities.append(volatility_pct)
                
                # Measure trend consistency
                trend_consistencies.append(signal.strength)
            
            if volatilities:
                avg_volatility = np.mean(volatilities)
                avg_trend_strength = np.mean(trend_consistencies)
                
                # Classify regime
                if avg_volatility > 3.0:  # High volatility
                    self._market_regime = "volatile"
                elif avg_trend_strength > 0.7:  # Strong trend
                    self._market_regime = "trending"
                elif avg_trend_strength < 0.3:  # Weak trend
                    self._market_regime = "ranging"
                else:
                    self._market_regime = "normal"
            
        except Exception as e:
            self._logger.error(f"Error detecting market regime: {e}")
    
    def _calculate_signal_consensus(
        self, 
        analyses: Dict[TimeframeType, TimeframeSignal]
    ) -> Tuple[TradingSignal, float]:
        """Calculate signal consensus across timeframes."""
        if not analyses:
            return TradingSignal.HOLD, 0.0
        
        signal_weights = {
            TradingSignal.BUY: 0.0,
            TradingSignal.SELL: 0.0,
            TradingSignal.HOLD: 0.0,
        }
        
        total_weight = 0.0
        
        for timeframe, tf_signal in analyses.items():
            config = self.timeframe_configs[timeframe]
            weight = tf_signal.weighted_strength * config.weight
            
            signal_weights[tf_signal.signal.signal_type] += weight
            total_weight += weight
        
        if total_weight == 0:
            return TradingSignal.HOLD, 0.0
        
        # Normalize weights
        for signal_type in signal_weights:
            signal_weights[signal_type] /= total_weight
        
        # Find dominant signal
        dominant_signal = max(signal_weights, key=signal_weights.get)
        consensus_strength = signal_weights[dominant_signal]
        
        return dominant_signal, consensus_strength
    
    def _detect_conflicting_signals(self, analyses: Dict[TimeframeType, TimeframeSignal]) -> bool:
        """Detect if there are conflicting signals across timeframes."""
        signal_types = [signal.signal.signal_type for signal in analyses.values()]
        unique_signals = set(signal_types)
        
        # Consider conflicting if we have both BUY and SELL signals
        return TradingSignal.BUY in unique_signals and TradingSignal.SELL in unique_signals
    
    def _find_dominant_timeframe(self, analyses: Dict[TimeframeType, TimeframeSignal]) -> TimeframeType:
        """Find the timeframe with the strongest signal."""
        if not analyses:
            return list(self.timeframe_configs.keys())[0] if self.timeframe_configs else TimeframeType.MINUTE_1
        
        strongest_tf = max(
            analyses.keys(),
            key=lambda tf: analyses[tf].weighted_strength * self.timeframe_configs[tf].priority
        )
        
        return strongest_tf
    
    def _trend_confirms_signal(self, signal: TradingSignal) -> bool:
        """Check if trend bias confirms the signal."""
        if not self.trend_confirmation_required:
            return True
        
        if self._trend_bias == TradingSignal.HOLD:
            return True  # Neutral trend allows any signal
        
        # Signal must align with trend bias
        return signal == self._trend_bias or signal == TradingSignal.HOLD
    
    async def _generate_signals_from_analysis(
        self, 
        analysis: MultiTimeframeAnalysis
    ) -> List[Signal]:
        """Generate final trading signals from multi-timeframe analysis."""
        signals = []
        
        if analysis.primary_signal:
            signals.append(analysis.primary_signal)
        
        return signals
    
    async def _cleanup_old_signals(self) -> None:
        """Clean up old signals from all timeframes."""
        cutoff_time = datetime.utcnow() - timedelta(minutes=self.signal_timeout_minutes)
        
        for timeframe in self._timeframe_signals:
            self._timeframe_signals[timeframe] = [
                signal for signal in self._timeframe_signals[timeframe]
                if signal.timestamp > cutoff_time
            ]
    
    def _find_primary_timeframe(self) -> Optional[TimeframeType]:
        """Find the primary timeframe for signal generation."""
        primary_timeframes = [
            tf for tf, config in self.timeframe_configs.items()
            if config.primary
        ]
        
        if primary_timeframes:
            return primary_timeframes[0]
        
        # If no primary timeframe specified, use highest priority
        if self.timeframe_configs:
            return max(
                self.timeframe_configs.keys(),
                key=lambda tf: self.timeframe_configs[tf].priority
            )
        
        return None