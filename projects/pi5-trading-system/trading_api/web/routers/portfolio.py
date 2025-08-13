"""
Portfolio Management API Endpoints.

REST API endpoints for portfolio monitoring, position tracking,
performance analytics, and risk management.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..models import (
    BaseResponse,
    PortfolioSummary,
    PositionInfo,
    PortfolioPerformance,
    RiskMetrics,
    UserRole
)
from ..auth import User
from portfolio.manager import PortfolioManager
from core.exceptions import PortfolioError


logger = logging.getLogger(__name__)

router = APIRouter()


def require_permission(required_role: UserRole):
    """Dependency to check user permissions.""" 
    def _check_permission(current_user: User = Depends(lambda: None)):
        if not current_user or not current_user.has_permission(required_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return _check_permission


@router.get("/summary", response_model=PortfolioSummary, summary="Get Portfolio Summary")
async def get_portfolio_summary(
    portfolio_manager: PortfolioManager = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """
    Get comprehensive portfolio summary.
    
    Returns current portfolio value, cash balance, positions,
    profit/loss, and key performance metrics.
    """
    try:
        # Mock portfolio summary data
        summary = PortfolioSummary(
            total_equity=Decimal('127450.75'),
            cash_balance=Decimal('23450.75'),
            invested_amount=Decimal('104000.00'),
            total_return=Decimal('23450.75'),
            total_return_percent=18.4,
            day_change=Decimal('1245.30'),
            day_change_percent=0.98,
            unrealized_pnl=Decimal('19850.25'),
            realized_pnl=Decimal('3600.50'),
            positions_count=8,
            last_updated=datetime.utcnow()
        )
        
        return summary
        
    except Exception as e:
        logger.error(f"Error retrieving portfolio summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve portfolio summary"
        )


@router.get("/positions", response_model=List[PositionInfo], summary="Get All Positions")
async def get_positions(
    portfolio_manager: PortfolioManager = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """
    Get all current portfolio positions.
    
    Returns detailed information about all open positions including
    quantities, market values, profit/loss, and cost basis.
    """
    try:
        # Mock positions data
        positions = [
            PositionInfo(
                symbol="AAPL",
                quantity=Decimal('100'),
                average_price=Decimal('150.25'),
                current_price=Decimal('155.80'),
                market_value=Decimal('15580.00'),
                unrealized_pnl=Decimal('555.00'),
                unrealized_pnl_percent=3.69,
                cost_basis=Decimal('15025.00'),
                side="long",
                first_acquired=datetime.utcnow() - timedelta(days=15),
                last_updated=datetime.utcnow()
            ),
            PositionInfo(
                symbol="MSFT",
                quantity=Decimal('75'),
                average_price=Decimal('280.45'),
                current_price=Decimal('285.20'),
                market_value=Decimal('21390.00'),
                unrealized_pnl=Decimal('356.25'),
                unrealized_pnl_percent=1.69,
                cost_basis=Decimal('21033.75'),
                side="long",
                first_acquired=datetime.utcnow() - timedelta(days=8),
                last_updated=datetime.utcnow()
            ),
            PositionInfo(
                symbol="GOOGL",
                quantity=Decimal('25'),
                average_price=Decimal('2450.80'),
                current_price=Decimal('2485.50'),
                market_value=Decimal('62137.50'),
                unrealized_pnl=Decimal('867.50'),
                unrealized_pnl_percent=1.41,
                cost_basis=Decimal('61270.00'),
                side="long",
                first_acquired=datetime.utcnow() - timedelta(days=22),
                last_updated=datetime.utcnow()
            )
        ]
        
        return positions
        
    except Exception as e:
        logger.error(f"Error retrieving positions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve positions"
        )


@router.get("/positions/{symbol}", response_model=PositionInfo, summary="Get Position Details")
async def get_position(
    symbol: str,
    portfolio_manager: PortfolioManager = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """
    Get detailed information about a specific position.
    
    Returns comprehensive position data including acquisition history,
    performance metrics, and real-time valuation.
    """
    try:
        # Mock position data
        if symbol.upper() == "AAPL":
            position = PositionInfo(
                symbol="AAPL",
                quantity=Decimal('100'),
                average_price=Decimal('150.25'),
                current_price=Decimal('155.80'),
                market_value=Decimal('15580.00'),
                unrealized_pnl=Decimal('555.00'),
                unrealized_pnl_percent=3.69,
                cost_basis=Decimal('15025.00'),
                side="long",
                first_acquired=datetime.utcnow() - timedelta(days=15),
                last_updated=datetime.utcnow()
            )
            return position
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No position found for symbol: {symbol}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving position for {symbol}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve position"
        )


@router.get("/performance", response_model=PortfolioPerformance, summary="Get Portfolio Performance")
async def get_portfolio_performance(
    start_date: Optional[datetime] = Query(None, description="Performance start date"),
    end_date: Optional[datetime] = Query(None, description="Performance end date"),
    benchmark: Optional[str] = Query("SPY", description="Benchmark symbol"),
    portfolio_manager: PortfolioManager = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """
    Get comprehensive portfolio performance analytics.
    
    Returns detailed performance metrics including returns, risk measures,
    trade statistics, and benchmark comparison.
    """
    try:
        # Set default date range
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Mock performance data
        performance = PortfolioPerformance(
            period_start=start_date,
            period_end=end_date,
            initial_value=Decimal('100000.00'),
            final_value=Decimal('127450.75'),
            total_return=0.27451,
            annualized_return=0.185,
            sharpe_ratio=1.42,
            sortino_ratio=1.85,
            max_drawdown=0.078,
            volatility=0.156,
            calmar_ratio=2.37,
            win_rate=0.64,
            profit_factor=1.78,
            total_trades=156,
            benchmark_return=0.12 if benchmark else None,
            alpha=0.065 if benchmark else None,
            beta=0.89 if benchmark else None
        )
        
        return performance
        
    except Exception as e:
        logger.error(f"Error retrieving portfolio performance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve portfolio performance"
        )


@router.get("/risk", response_model=RiskMetrics, summary="Get Risk Metrics")
async def get_risk_metrics(
    confidence_level: Optional[float] = Query(0.95, ge=0.9, le=0.99, description="VaR confidence level"),
    portfolio_manager: PortfolioManager = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """
    Get comprehensive risk metrics and analysis.
    
    Returns Value at Risk (VaR), Expected Shortfall, drawdown metrics,
    volatility measures, and portfolio concentration analysis.
    """
    try:
        # Mock risk metrics
        risk_metrics = RiskMetrics(
            var_95=0.0234,
            var_99=0.0367,
            expected_shortfall=0.0445,
            maximum_drawdown=0.078,
            current_drawdown=0.012,
            volatility=0.156,
            downside_volatility=0.089,
            correlation_to_benchmark=0.76,
            beta=0.89,
            portfolio_concentration=0.34,
            largest_position_weight=0.24
        )
        
        return risk_metrics
        
    except Exception as e:
        logger.error(f"Error retrieving risk metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve risk metrics"
        )


@router.get("/history", response_model=List[Dict[str, Any]], summary="Get Portfolio History")
async def get_portfolio_history(
    start_date: Optional[datetime] = Query(None, description="History start date"),
    end_date: Optional[datetime] = Query(None, description="History end date"),
    interval: Optional[str] = Query("1d", description="Data interval (1h, 1d, 1w)"),
    portfolio_manager: PortfolioManager = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """
    Get portfolio value history over time.
    
    Returns historical portfolio values, returns, and key metrics
    at specified intervals for charting and analysis.
    """
    try:
        # Set default date range
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Mock historical data
        history = []
        current_date = start_date
        base_value = 100000.0
        
        while current_date <= end_date:
            # Simulate portfolio growth with some volatility
            days_since_start = (current_date - start_date).days
            growth = 1 + (0.18 / 365 * days_since_start)  # 18% annual growth
            volatility = 0.02 * (2 * hash(str(current_date)) / 2**63)  # Mock volatility
            
            portfolio_value = base_value * growth * (1 + volatility)
            
            history_point = {
                "timestamp": current_date.isoformat(),
                "portfolio_value": round(portfolio_value, 2),
                "cash_balance": round(portfolio_value * 0.15, 2),
                "invested_value": round(portfolio_value * 0.85, 2),
                "day_return": round(volatility * 100, 3),
                "total_return": round((portfolio_value - base_value) / base_value * 100, 3)
            }
            history.append(history_point)
            
            # Increment date based on interval
            if interval == "1h":
                current_date += timedelta(hours=1)
            elif interval == "1w":
                current_date += timedelta(weeks=1)
            else:  # 1d default
                current_date += timedelta(days=1)
        
        return history
        
    except Exception as e:
        logger.error(f"Error retrieving portfolio history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve portfolio history"
        )


@router.get("/allocation", response_model=Dict[str, Any], summary="Get Portfolio Allocation")
async def get_portfolio_allocation(
    portfolio_manager: PortfolioManager = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """
    Get portfolio allocation breakdown.
    
    Returns allocation by asset class, sector, and individual positions
    with percentage weights and dollar amounts.
    """
    try:
        # Mock allocation data
        allocation = {
            "by_asset_class": {
                "stocks": {"value": 104000.00, "percentage": 81.6},
                "cash": {"value": 23450.75, "percentage": 18.4}
            },
            "by_sector": {
                "technology": {"value": 78200.00, "percentage": 61.4},
                "healthcare": {"value": 15600.00, "percentage": 12.2},
                "consumer_discretionary": {"value": 10200.00, "percentage": 8.0},
                "cash": {"value": 23450.75, "percentage": 18.4}
            },
            "by_position": {
                "AAPL": {"value": 15580.00, "percentage": 12.2},
                "MSFT": {"value": 21390.00, "percentage": 16.8},
                "GOOGL": {"value": 62137.50, "percentage": 48.7},
                "other_positions": {"value": 4892.50, "percentage": 3.9},
                "cash": {"value": 23450.75, "percentage": 18.4}
            },
            "concentration_metrics": {
                "largest_position_weight": 48.7,
                "top_5_positions_weight": 97.6,
                "herfindahl_index": 0.34,
                "diversification_score": 0.66
            }
        }
        
        return allocation
        
    except Exception as e:
        logger.error(f"Error retrieving portfolio allocation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve portfolio allocation"
        )


@router.post("/rebalance", response_model=BaseResponse, summary="Rebalance Portfolio")
async def rebalance_portfolio(
    target_allocation: Dict[str, float],
    portfolio_manager: PortfolioManager = Depends(lambda: None),
    current_user: User = Depends(require_permission(UserRole.TRADER))
):
    """
    Initiate portfolio rebalancing.
    
    Rebalances the portfolio to match target allocation weights.
    Requires trader permissions.
    """
    try:
        # Validate target allocation
        total_weight = sum(target_allocation.values())
        if abs(total_weight - 1.0) > 0.01:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target allocation weights must sum to 1.0, got {total_weight}"
            )
        
        # Mock rebalancing process
        logger.info(f"Portfolio rebalancing initiated by user {current_user.username}")
        
        # In practice, this would:
        # 1. Calculate current allocation
        # 2. Determine required trades
        # 3. Submit rebalancing orders
        # 4. Monitor execution
        
        return BaseResponse(
            success=True,
            message="Portfolio rebalancing initiated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating portfolio rebalance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate portfolio rebalancing"
        )


@router.get("/stats", response_model=Dict[str, Any], summary="Get Portfolio Statistics")
async def get_portfolio_statistics(
    portfolio_manager: PortfolioManager = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """
    Get comprehensive portfolio statistics and metrics.
    
    Returns trading activity, performance statistics,
    risk metrics, and comparative analysis.
    """
    try:
        # Mock portfolio statistics
        stats = {
            "performance": {
                "inception_date": "2024-01-01",
                "days_active": 227,
                "total_return": 27.45,
                "annualized_return": 18.5,
                "best_day": 3.2,
                "worst_day": -2.8,
                "positive_days": 145,
                "negative_days": 82
            },
            "trading_activity": {
                "total_trades": 156,
                "winning_trades": 100,
                "losing_trades": 56,
                "win_rate": 64.1,
                "avg_trade_return": 0.18,
                "best_trade": 8.4,
                "worst_trade": -3.2,
                "avg_holding_period": 5.2
            },
            "risk_metrics": {
                "sharpe_ratio": 1.42,
                "sortino_ratio": 1.85,
                "calmar_ratio": 2.37,
                "max_drawdown": 7.8,
                "volatility": 15.6,
                "var_95": 2.34,
                "beta": 0.89
            },
            "allocation": {
                "number_of_positions": 8,
                "largest_position": 48.7,
                "cash_percentage": 18.4,
                "concentration_risk": "medium",
                "diversification_score": 0.66
            }
        }
        
        return stats
        
    except Exception as e:
        logger.error(f"Error retrieving portfolio statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve portfolio statistics"
        )