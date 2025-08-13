"""
Backtesting module for Pi5 Trading System.

Provides comprehensive backtesting capabilities for strategy validation,
optimization, and performance analysis.

Components:
- BacktestingEngine: Main backtesting engine with multi-strategy support
- BacktestConfig: Configuration for backtest runs
- BacktestResults: Comprehensive results analysis
- Trade: Individual trade representation
- Monte Carlo analysis and parameter optimization
"""

from .engine import (
    BacktestingEngine,
    BacktestConfig,
    BacktestResults,
    Trade,
    BacktestMode,
    ExecutionModel,
)

__all__ = [
    "BacktestingEngine",
    "BacktestConfig", 
    "BacktestResults",
    "Trade",
    "BacktestMode",
    "ExecutionModel",
]