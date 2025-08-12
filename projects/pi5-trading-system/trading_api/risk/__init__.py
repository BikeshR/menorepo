"""
Risk management module for Pi5 Trading System.

Provides comprehensive risk management functionality including position sizing,
portfolio risk monitoring, limit enforcement, and risk metrics calculation.

Components:
- manager.py: Main risk manager with validation and position sizing
- metrics.py: Risk metrics calculation (VaR, drawdown, correlation, etc.)
- limits.py: Risk limit definitions and enforcement
- position_sizer.py: Advanced position sizing algorithms
"""

from risk.manager import RiskManagerImplementation

__all__ = [
    "RiskManagerImplementation",
]