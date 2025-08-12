"""
Portfolio management module for Pi5 Trading System.

Provides comprehensive portfolio tracking, position management, performance
calculation, and analytics. Integrates with order management and market data
to maintain real-time portfolio state.

Components:
- manager.py: Portfolio manager with real-time tracking
- performance.py: Performance metrics and analytics
- positions.py: Position tracking and management
- reports.py: Portfolio reporting and visualization
"""

from portfolio.manager import PortfolioManager

__all__ = [
    "PortfolioManager",
]