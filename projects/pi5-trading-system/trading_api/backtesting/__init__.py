"""
Backtesting module for Pi5 Trading System.

Provides comprehensive backtesting capabilities for strategy validation,
optimization, and performance analysis.

Components:
- EnhancedBacktester: Advanced backtester with realistic costs and microstructure
- BacktestConfig: Configuration for backtest runs
- PerformanceMetrics: Comprehensive performance analysis
- Trade: Individual trade representation
- Monte Carlo analysis and parameter optimization
"""

# Import enhanced backtester (safe imports)
from .enhanced_backtester import (
    EnhancedBacktester,
    BacktestConfig,
    TransactionCosts,
    MarketMicrostructure,
    PerformanceMetrics,
    Trade,
    Position,
    SlippageModel,
    FillModel,
)

# Try to import original engine (may have import issues)
try:
    from .engine import (
        BacktestingEngine,
        BacktestConfig as OriginalBacktestConfig,
        BacktestResults,
        Trade as OriginalTrade,
        BacktestMode,
        ExecutionModel,
    )
    ORIGINAL_ENGINE_AVAILABLE = True
except ImportError:
    ORIGINAL_ENGINE_AVAILABLE = False

__all__ = [
    # Enhanced backtester (always available)
    "EnhancedBacktester",
    "BacktestConfig",
    "TransactionCosts",
    "MarketMicrostructure",
    "PerformanceMetrics",
    "Trade",
    "Position",
    "SlippageModel",
    "FillModel",
]

# Add original engine exports if available
if ORIGINAL_ENGINE_AVAILABLE:
    __all__.extend([
        "BacktestingEngine",
        "OriginalBacktestConfig",
        "BacktestResults",
        "OriginalTrade",
        "BacktestMode",
        "ExecutionModel",
    ])