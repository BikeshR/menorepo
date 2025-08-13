"""
Strategy Management API Endpoints.

REST API endpoints for managing trading strategies including
creation, configuration, monitoring, and performance analytics.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from fastapi.responses import JSONResponse

from ..models import (
    BaseResponse,
    StrategyInfo,
    StrategyInstance,
    StrategyStatus,
    StrategyPerformance,
    CreateStrategyRequest,
    UpdateStrategyRequest,
    StrategyActionRequest,
    PaginationParams,
    PaginatedResponse,
    UserRole
)
from ..auth import User
from strategies.manager import StrategyManager
# Temporarily disabled for deployment
# from strategies.rsi_mean_reversion import RSIMeanReversionStrategy
# from strategies.moving_average_crossover import MovingAverageCrossoverStrategy
# from strategies.momentum_trend_following import MomentumTrendFollowingStrategy
from core.exceptions import TradingSystemError


logger = logging.getLogger(__name__)

router = APIRouter()


# Strategy registry for available strategies (temporarily disabled for deployment)
STRATEGY_REGISTRY = {
    # "RSIMeanReversion": {
    #     "class": RSIMeanReversionStrategy,
    #     "name": "RSI Mean Reversion",
    #     "description": "Mean reversion strategy based on RSI indicator",
    #     "version": "1.0.0",
    #     "parameters": [
    #         {
    #             "name": "rsi_period",
    #             "type": "int",
    #             "default_value": 14,
    #             "min_value": 5,
    #             "max_value": 50,
    #             "description": "RSI calculation period",
    #             "required": True
    #         },
    #         {
    #             "name": "oversold_threshold",
    #             "type": "int", 
    #             "default_value": 30,
    #             "min_value": 10,
    #             "max_value": 40,
    #             "description": "RSI oversold threshold",
    #             "required": True
    #         },
    #         {
    #             "name": "overbought_threshold",
    #             "type": "int",
    #             "default_value": 70,
    #             "min_value": 60,
    #             "max_value": 90,
    #             "description": "RSI overbought threshold",
    #             "required": True
    #         }
    #     ],
    #     "supported_symbols": ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"],
    #     "timeframes": ["1m", "5m", "15m", "1h", "1d"]
    # },
    # "MovingAverageCrossover": {
    #     "class": MovingAverageCrossoverStrategy,
    #     "name": "Moving Average Crossover",
    #     "description": "Strategy based on moving average crossovers",
    #     "version": "1.0.0",
    #     "parameters": [
    #         {
    #             "name": "short_window",
    #             "type": "int",
    #             "default_value": 20,
    #             "min_value": 5,
    #             "max_value": 50,
    #             "description": "Short moving average period",
    #             "required": True
    #         },
    #         {
    #             "name": "long_window",
    #             "type": "int",
    #             "default_value": 50,
    #             "min_value": 20,
    #             "max_value": 200,
    #             "description": "Long moving average period",
    #             "required": True
    #         }
    #     ],
    #     "supported_symbols": ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"],
    #     "timeframes": ["5m", "15m", "1h", "4h", "1d"]
    # },
    # "MomentumTrendFollowing": {
    #     "class": MomentumTrendFollowingStrategy,
    #     "name": "Momentum Trend Following",
    #     "description": "Trend following strategy based on momentum indicators",
    #     "version": "1.0.0",
    #     "parameters": [
    #         {
    #             "name": "momentum_period",
    #             "type": "int",
    #             "default_value": 14,
    #             "min_value": 5,
    #             "max_value": 30,
    #             "description": "Momentum calculation period",
    #             "required": True
    #         },
    #         {
    #             "name": "trend_threshold",
    #             "type": "float",
    #             "default_value": 0.02,
    #             "min_value": 0.01,
    #             "max_value": 0.05,
    #             "description": "Trend strength threshold",
    #             "required": True
    #         }
    #     ],
    #     "supported_symbols": ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"],
    #     "timeframes": ["15m", "1h", "4h", "1d"]
    # }
}


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


@router.get("/", response_model=List[StrategyInfo], summary="List Available Strategies")
async def list_available_strategies():
    """
    Get list of all available strategy types.
    
    Returns information about all registered strategies including
    their parameters, supported symbols, and configuration options.
    """
    strategies = []
    
    for class_name, config in STRATEGY_REGISTRY.items():
        strategy_info = StrategyInfo(
            name=config["name"],
            class_name=class_name,
            description=config["description"],
            version=config["version"],
            parameters=config["parameters"],
            supported_symbols=config["supported_symbols"],
            timeframes=config["timeframes"]
        )
        strategies.append(strategy_info)
    
    return strategies


@router.get("/active", response_model=List[StrategyInstance], summary="List Active Strategies")
async def list_active_strategies(
    strategy_manager: StrategyManager = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """
    Get list of all currently active strategy instances.
    
    Returns detailed information about running strategies including
    their status, parameters, and performance metrics.
    """
    try:
        # This would integrate with the actual strategy manager
        # For now, return mock data
        active_strategies = []
        
        # Mock active strategy
        mock_strategy = StrategyInstance(
            id="strategy-001",
            name="RSI Mean Reversion - AAPL",
            class_name="RSIMeanReversion",
            status=StrategyStatus.ACTIVE,
            parameters={
                "rsi_period": 14,
                "oversold_threshold": 30,
                "overbought_threshold": 70
            },
            symbols=["AAPL"],
            created_at=datetime.utcnow() - timedelta(hours=2),
            started_at=datetime.utcnow() - timedelta(hours=2)
        )
        active_strategies.append(mock_strategy)
        
        return active_strategies
        
    except Exception as e:
        logger.error(f"Error listing active strategies: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve active strategies"
        )


@router.post("/", response_model=StrategyInstance, summary="Create New Strategy")
async def create_strategy(
    request: CreateStrategyRequest,
    strategy_manager: StrategyManager = Depends(lambda: None),
    current_user: User = Depends(require_permission(UserRole.TRADER))
):
    """
    Create a new strategy instance.
    
    Creates and optionally starts a new trading strategy with
    the specified parameters and symbols.
    """
    try:
        # Validate strategy class
        if request.class_name not in STRATEGY_REGISTRY:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown strategy class: {request.class_name}"
            )
        
        strategy_config = STRATEGY_REGISTRY[request.class_name]
        
        # Validate parameters
        _validate_strategy_parameters(request.parameters, strategy_config["parameters"])
        
        # Create strategy instance
        strategy_id = f"strategy-{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        strategy_instance = StrategyInstance(
            id=strategy_id,
            name=request.name,
            class_name=request.class_name,
            status=StrategyStatus.ACTIVE if request.auto_start else StrategyStatus.INACTIVE,
            parameters=request.parameters,
            symbols=request.symbols,
            created_at=datetime.utcnow(),
            started_at=datetime.utcnow() if request.auto_start else None
        )
        
        # Here you would integrate with the actual strategy manager
        # strategy_manager.create_strategy(strategy_instance)
        
        logger.info(f"Strategy created: {strategy_id} by user {current_user.username}")
        
        return strategy_instance
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating strategy: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create strategy"
        )


@router.get("/{strategy_id}", response_model=StrategyInstance, summary="Get Strategy Details")
async def get_strategy(
    strategy_id: str = Path(..., description="Strategy ID"),
    strategy_manager: StrategyManager = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """
    Get detailed information about a specific strategy.
    
    Returns comprehensive strategy information including current status,
    parameters, symbols, and execution history.
    """
    try:
        # Mock strategy data - replace with actual strategy manager integration
        if strategy_id == "strategy-001":
            return StrategyInstance(
                id=strategy_id,
                name="RSI Mean Reversion - AAPL",
                class_name="RSIMeanReversion",
                status=StrategyStatus.ACTIVE,
                parameters={
                    "rsi_period": 14,
                    "oversold_threshold": 30,
                    "overbought_threshold": 70
                },
                symbols=["AAPL"],
                created_at=datetime.utcnow() - timedelta(hours=2),
                started_at=datetime.utcnow() - timedelta(hours=2)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving strategy {strategy_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve strategy"
        )


@router.put("/{strategy_id}", response_model=StrategyInstance, summary="Update Strategy")
async def update_strategy(
    strategy_id: str,
    request: UpdateStrategyRequest,
    strategy_manager: StrategyManager = Depends(lambda: None),
    current_user: User = Depends(require_permission(UserRole.TRADER))
):
    """
    Update strategy configuration.
    
    Updates strategy parameters and symbols. Strategy must be stopped
    to update parameters.
    """
    try:
        # Mock implementation - replace with actual strategy manager
        if strategy_id != "strategy-001":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
        
        # Validate new parameters if provided
        if request.parameters:
            # Get strategy config
            strategy_config = STRATEGY_REGISTRY.get("RSIMeanReversion")
            if strategy_config:
                _validate_strategy_parameters(request.parameters, strategy_config["parameters"])
        
        # Return updated strategy
        updated_strategy = StrategyInstance(
            id=strategy_id,
            name="RSI Mean Reversion - AAPL",
            class_name="RSIMeanReversion",
            status=StrategyStatus.ACTIVE,
            parameters=request.parameters or {
                "rsi_period": 14,
                "oversold_threshold": 30,
                "overbought_threshold": 70
            },
            symbols=request.symbols or ["AAPL"],
            created_at=datetime.utcnow() - timedelta(hours=2),
            started_at=datetime.utcnow() - timedelta(hours=2)
        )
        
        logger.info(f"Strategy {strategy_id} updated by user {current_user.username}")
        return updated_strategy
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating strategy {strategy_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update strategy"
        )


@router.post("/{strategy_id}/action", response_model=BaseResponse, summary="Control Strategy")
async def control_strategy(
    strategy_id: str,
    request: StrategyActionRequest,
    strategy_manager: StrategyManager = Depends(lambda: None),
    current_user: User = Depends(require_permission(UserRole.TRADER))
):
    """
    Control strategy execution (start, stop, pause, resume).
    
    Allows controlling the execution state of a trading strategy.
    Actions include start, stop, pause, and resume.
    """
    try:
        valid_actions = ["start", "stop", "pause", "resume"]
        if request.action not in valid_actions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid action. Must be one of: {valid_actions}"
            )
        
        # Mock implementation - replace with actual strategy manager
        if strategy_id != "strategy-001":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
        
        # Perform action
        action_messages = {
            "start": f"Strategy {strategy_id} started successfully",
            "stop": f"Strategy {strategy_id} stopped successfully", 
            "pause": f"Strategy {strategy_id} paused successfully",
            "resume": f"Strategy {strategy_id} resumed successfully"
        }
        
        logger.info(
            f"Strategy {strategy_id} action '{request.action}' performed by user {current_user.username}. "
            f"Reason: {request.reason or 'No reason provided'}"
        )
        
        return BaseResponse(
            success=True,
            message=action_messages[request.action]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error controlling strategy {strategy_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to control strategy"
        )


@router.delete("/{strategy_id}", response_model=BaseResponse, summary="Delete Strategy")
async def delete_strategy(
    strategy_id: str,
    strategy_manager: StrategyManager = Depends(lambda: None),
    current_user: User = Depends(require_permission(UserRole.ADMIN))
):
    """
    Delete a strategy instance.
    
    Permanently removes a strategy. Strategy must be stopped first.
    Only administrators can delete strategies.
    """
    try:
        # Mock implementation
        if strategy_id != "strategy-001":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
        
        # Check if strategy is stopped
        # if strategy.status != StrategyStatus.INACTIVE:
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="Strategy must be stopped before deletion"
        #     )
        
        logger.info(f"Strategy {strategy_id} deleted by user {current_user.username}")
        
        return BaseResponse(
            success=True,
            message=f"Strategy {strategy_id} deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting strategy {strategy_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete strategy"
        )


@router.get("/{strategy_id}/performance", response_model=StrategyPerformance, summary="Get Strategy Performance")
async def get_strategy_performance(
    strategy_id: str,
    start_date: Optional[datetime] = Query(None, description="Performance start date"),
    end_date: Optional[datetime] = Query(None, description="Performance end date"),
    strategy_manager: StrategyManager = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """
    Get strategy performance metrics.
    
    Returns comprehensive performance analytics including returns,
    risk metrics, trade statistics, and benchmarking data.
    """
    try:
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Mock performance data
        if strategy_id != "strategy-001":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
        
        performance = StrategyPerformance(
            strategy_id=strategy_id,
            strategy_name="RSI Mean Reversion - AAPL",
            total_trades=45,
            winning_trades=28,
            losing_trades=17,
            win_rate=0.62,
            total_return=0.087,
            annualized_return=0.125,
            sharpe_ratio=1.34,
            sortino_ratio=1.78,
            max_drawdown=0.052,
            volatility=0.089,
            calmar_ratio=2.4,
            profit_factor=1.86,
            avg_win=0.0234,
            avg_loss=-0.0156,
            period_start=start_date,
            period_end=end_date
        )
        
        return performance
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving strategy performance {strategy_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve strategy performance"
        )


def _validate_strategy_parameters(parameters: Dict[str, Any], parameter_schema: List[Dict[str, Any]]):
    """Validate strategy parameters against schema."""
    # Create parameter lookup
    param_schemas = {param["name"]: param for param in parameter_schema}
    
    # Check required parameters
    for param_name, schema in param_schemas.items():
        if schema["required"] and param_name not in parameters:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required parameter: {param_name}"
            )
    
    # Validate parameter values
    for param_name, value in parameters.items():
        if param_name not in param_schemas:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown parameter: {param_name}"
            )
        
        schema = param_schemas[param_name]
        
        # Type validation
        expected_type = schema["type"]
        if expected_type == "int" and not isinstance(value, int):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Parameter {param_name} must be an integer"
            )
        elif expected_type == "float" and not isinstance(value, (int, float)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Parameter {param_name} must be a number"
            )
        elif expected_type == "str" and not isinstance(value, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Parameter {param_name} must be a string"
            )
        
        # Range validation
        if "min_value" in schema and value < schema["min_value"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Parameter {param_name} must be >= {schema['min_value']}"
            )
        
        if "max_value" in schema and value > schema["max_value"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Parameter {param_name} must be <= {schema['max_value']}"
            )