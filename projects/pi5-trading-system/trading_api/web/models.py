"""
Pydantic Models for Pi5 Trading System Web API.

Request and response models for all API endpoints including strategies,
portfolio, orders, system health, and authentication.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field, validator, EmailStr
from core.interfaces import TradingSignal, OrderType, OrderStatus


# Base Models

class BaseResponse(BaseModel):
    """Base response model with common fields."""
    success: bool = True
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    message: Optional[str] = None


class ErrorResponse(BaseResponse):
    """Error response model."""
    success: bool = False
    error_code: str
    error_detail: str


class PaginationParams(BaseModel):
    """Pagination parameters."""
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(50, ge=1, le=1000, description="Items per page")
    
    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
    
    @property
    def limit(self) -> int:
        return self.page_size


class PaginatedResponse(BaseResponse):
    """Paginated response model."""
    total_items: int
    total_pages: int
    current_page: int
    page_size: int
    has_next: bool
    has_previous: bool


# Authentication Models

class UserRole(str, Enum):
    """User roles enum."""
    ADMIN = "admin"
    TRADER = "trader"
    VIEWER = "viewer"


class LoginRequest(BaseModel):
    """Login request model."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)


class LoginResponse(BaseResponse):
    """Login response model."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: 'UserInfo'


class RefreshTokenRequest(BaseModel):
    """Refresh token request model."""
    refresh_token: str


class UserInfo(BaseModel):
    """User information model."""
    id: str
    username: str
    email: EmailStr
    role: UserRole
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None


class ChangePasswordRequest(BaseModel):
    """Change password request model."""
    current_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=6)
    confirm_password: str = Field(..., min_length=6)
    
    @validator('confirm_password')
    def passwords_match(cls, v, values, **kwargs):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v


# Strategy Models

class StrategyStatus(str, Enum):
    """Strategy status enum."""
    INACTIVE = "inactive"
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"


class StrategyParameterSchema(BaseModel):
    """Strategy parameter schema."""
    name: str
    type: str
    default_value: Any
    min_value: Optional[Union[int, float]] = None
    max_value: Optional[Union[int, float]] = None
    description: Optional[str] = None
    required: bool = True


class StrategyInfo(BaseModel):
    """Strategy information model."""
    name: str
    class_name: str
    description: str
    version: str
    parameters: List[StrategyParameterSchema]
    supported_symbols: List[str]
    timeframes: List[str]


class StrategyInstance(BaseModel):
    """Strategy instance model."""
    id: str
    name: str
    class_name: str
    status: StrategyStatus
    parameters: Dict[str, Any]
    symbols: List[str]
    created_at: datetime
    started_at: Optional[datetime] = None
    stopped_at: Optional[datetime] = None
    error_message: Optional[str] = None


class StrategyPerformance(BaseModel):
    """Strategy performance metrics."""
    strategy_id: str
    strategy_name: str
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float = Field(..., ge=0, le=1)
    total_return: float
    annualized_return: float
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown: float
    volatility: float
    calmar_ratio: float
    profit_factor: float
    avg_win: float
    avg_loss: float
    period_start: datetime
    period_end: datetime


class CreateStrategyRequest(BaseModel):
    """Create strategy request model."""
    name: str = Field(..., min_length=1, max_length=100)
    class_name: str = Field(..., min_length=1, max_length=100)
    parameters: Dict[str, Any]
    symbols: List[str] = Field(..., min_items=1)
    auto_start: bool = False


class UpdateStrategyRequest(BaseModel):
    """Update strategy request model."""
    parameters: Optional[Dict[str, Any]] = None
    symbols: Optional[List[str]] = None


class StrategyActionRequest(BaseModel):
    """Strategy action request model."""
    action: str = Field(..., regex="^(start|stop|pause|resume)$")
    reason: Optional[str] = None


# Portfolio Models

class PositionInfo(BaseModel):
    """Position information model."""
    symbol: str
    quantity: Decimal
    average_price: Decimal
    current_price: Decimal
    market_value: Decimal
    unrealized_pnl: Decimal
    unrealized_pnl_percent: float
    cost_basis: Decimal
    side: str  # "long" or "short"
    first_acquired: datetime
    last_updated: datetime


class PortfolioSummary(BaseModel):
    """Portfolio summary model."""
    total_equity: Decimal
    cash_balance: Decimal
    invested_amount: Decimal
    total_return: Decimal
    total_return_percent: float
    day_change: Decimal
    day_change_percent: float
    unrealized_pnl: Decimal
    realized_pnl: Decimal
    positions_count: int
    last_updated: datetime


class PortfolioPerformance(BaseModel):
    """Portfolio performance metrics."""
    period_start: datetime
    period_end: datetime
    initial_value: Decimal
    final_value: Decimal
    total_return: float
    annualized_return: float
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown: float
    volatility: float
    calmar_ratio: float
    win_rate: float
    profit_factor: float
    total_trades: int
    benchmark_return: Optional[float] = None
    alpha: Optional[float] = None
    beta: Optional[float] = None


class RiskMetrics(BaseModel):
    """Risk metrics model."""
    var_95: float = Field(..., description="95% Value at Risk")
    var_99: float = Field(..., description="99% Value at Risk")
    expected_shortfall: float = Field(..., description="Expected Shortfall")
    maximum_drawdown: float
    current_drawdown: float
    volatility: float
    downside_volatility: float
    correlation_to_benchmark: Optional[float] = None
    beta: Optional[float] = None
    portfolio_concentration: float
    largest_position_weight: float


# Order Models

class OrderInfo(BaseModel):
    """Order information model."""
    id: str
    symbol: str
    side: str  # "buy" or "sell"
    order_type: OrderType
    quantity: Decimal
    price: Optional[Decimal] = None
    stop_price: Optional[Decimal] = None
    filled_quantity: Decimal = Decimal('0')
    remaining_quantity: Decimal
    average_fill_price: Optional[Decimal] = None
    status: OrderStatus
    created_at: datetime
    updated_at: datetime
    filled_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    strategy_id: Optional[str] = None
    error_message: Optional[str] = None


class TradeInfo(BaseModel):
    """Trade information model."""
    id: str
    order_id: str
    symbol: str
    side: str
    quantity: Decimal
    price: Decimal
    value: Decimal
    commission: Decimal
    executed_at: datetime
    strategy_id: Optional[str] = None


class CreateOrderRequest(BaseModel):
    """Create order request model."""
    symbol: str = Field(..., min_length=1, max_length=20)
    side: str = Field(..., regex="^(buy|sell)$")
    order_type: OrderType
    quantity: Decimal = Field(..., gt=0)
    price: Optional[Decimal] = Field(None, gt=0)
    stop_price: Optional[Decimal] = Field(None, gt=0)
    time_in_force: str = Field("GTC", regex="^(GTC|IOC|FOK|DAY)$")
    strategy_id: Optional[str] = None


class CancelOrderRequest(BaseModel):
    """Cancel order request model."""
    reason: Optional[str] = None


# Signal Models

class SignalInfo(BaseModel):
    """Signal information model."""
    id: str
    symbol: str
    signal_type: TradingSignal
    confidence: float = Field(..., ge=0, le=1)
    price: Decimal
    timestamp: datetime
    strategy_name: str
    metadata: Optional[Dict[str, Any]] = None
    processed: bool = False
    order_id: Optional[str] = None


# System Models

class SystemHealth(BaseModel):
    """System health model."""
    status: str
    version: str
    uptime_seconds: int
    components: Dict[str, Dict[str, Any]]
    system: Dict[str, Any]
    timestamp: datetime


class SystemMetrics(BaseModel):
    """System metrics model."""
    cpu_usage_percent: float
    memory_usage_percent: float
    memory_available_mb: float
    disk_usage_percent: float
    network_io: Dict[str, int]
    active_connections: int
    request_rate: float
    error_rate: float
    response_time_avg: float
    timestamp: datetime


class ComponentStatus(BaseModel):
    """Component status model."""
    name: str
    status: str
    uptime_seconds: int
    last_error: Optional[str] = None
    last_error_time: Optional[datetime] = None
    metrics: Dict[str, Any]


class LogEntry(BaseModel):
    """Log entry model."""
    timestamp: datetime
    level: str
    logger: str
    message: str
    module: Optional[str] = None
    function: Optional[str] = None
    line: Optional[int] = None


class SystemConfiguration(BaseModel):
    """System configuration model."""
    trading_enabled: bool
    paper_trading_enabled: bool
    risk_limits: Dict[str, Any]
    supported_brokers: List[str]
    supported_data_providers: List[str]
    max_positions: int
    max_strategies: int
    timezone: str


# WebSocket Models

class WebSocketMessage(BaseModel):
    """WebSocket message model."""
    type: str
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class WebSocketSubscription(BaseModel):
    """WebSocket subscription model."""
    channels: List[str]
    symbols: Optional[List[str]] = None
    strategies: Optional[List[str]] = None


# Market Data Models

class MarketDataTick(BaseModel):
    """Market data tick model."""
    symbol: str
    price: Decimal
    volume: int
    timestamp: datetime
    bid: Optional[Decimal] = None
    ask: Optional[Decimal] = None
    bid_size: Optional[int] = None
    ask_size: Optional[int] = None


class MarketDataBar(BaseModel):
    """Market data bar model."""
    symbol: str
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
    timestamp: datetime
    timeframe: str


class TechnicalIndicator(BaseModel):
    """Technical indicator model."""
    name: str
    symbol: str
    value: Union[Decimal, Dict[str, Decimal]]
    timestamp: datetime
    parameters: Dict[str, Any]


# Update forward references
LoginResponse.model_rebuild()
UserInfo.model_rebuild()