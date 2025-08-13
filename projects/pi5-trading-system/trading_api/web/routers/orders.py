"""
Order Management API Endpoints.

REST API endpoints for order creation, monitoring,
and trade history management.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..models import (
    BaseResponse,
    OrderInfo,
    TradeInfo,
    CreateOrderRequest,
    CancelOrderRequest,
    OrderStatus,
    OrderType,
    UserRole
)
from ..auth import User
from orders.enhanced_order_manager import EnhancedOrderManager


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


@router.get("/", response_model=List[OrderInfo], summary="Get Order History")
async def get_orders(
    status_filter: Optional[OrderStatus] = Query(None, description="Filter by order status"),
    symbol: Optional[str] = Query(None, description="Filter by symbol"),
    limit: int = Query(100, ge=1, le=1000, description="Number of orders to return"),
    order_manager: EnhancedOrderManager = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """Get order history with optional filtering."""
    try:
        # Mock order data
        orders = [
            OrderInfo(
                id="order-001",
                symbol="AAPL",
                side="buy",
                order_type=OrderType.MARKET,
                quantity=Decimal('100'),
                price=None,
                filled_quantity=Decimal('100'),
                remaining_quantity=Decimal('0'),
                average_fill_price=Decimal('155.75'),
                status=OrderStatus.FILLED,
                created_at=datetime.utcnow() - timedelta(hours=2),
                updated_at=datetime.utcnow() - timedelta(hours=2),
                filled_at=datetime.utcnow() - timedelta(hours=2)
            ),
            OrderInfo(
                id="order-002",
                symbol="MSFT",
                side="buy",
                order_type=OrderType.LIMIT,
                quantity=Decimal('75'),
                price=Decimal('280.00'),
                filled_quantity=Decimal('0'),
                remaining_quantity=Decimal('75'),
                status=OrderStatus.PENDING,
                created_at=datetime.utcnow() - timedelta(minutes=30),
                updated_at=datetime.utcnow() - timedelta(minutes=30)
            )
        ]
        
        # Apply filters
        if status_filter:
            orders = [o for o in orders if o.status == status_filter]
        if symbol:
            orders = [o for o in orders if o.symbol == symbol.upper()]
        
        return orders[:limit]
        
    except Exception as e:
        logger.error(f"Error retrieving orders: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve orders"
        )


@router.post("/", response_model=OrderInfo, summary="Create Order")
async def create_order(
    request: CreateOrderRequest,
    order_manager: EnhancedOrderManager = Depends(lambda: None),
    current_user: User = Depends(require_permission(UserRole.TRADER))
):
    """Create a new trading order."""
    try:
        # Mock order creation
        order = OrderInfo(
            id=f"order-{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            symbol=request.symbol.upper(),
            side=request.side,
            order_type=request.order_type,
            quantity=request.quantity,
            price=request.price,
            filled_quantity=Decimal('0'),
            remaining_quantity=request.quantity,
            status=OrderStatus.PENDING,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        logger.info(f"Order created: {order.id} by user {current_user.username}")
        return order
        
    except Exception as e:
        logger.error(f"Error creating order: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create order"
        )


@router.get("/{order_id}", response_model=OrderInfo, summary="Get Order Details")
async def get_order(
    order_id: str,
    order_manager: EnhancedOrderManager = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """Get detailed information about a specific order."""
    try:
        # Mock order retrieval
        if order_id == "order-001":
            return OrderInfo(
                id=order_id,
                symbol="AAPL",
                side="buy",
                order_type=OrderType.MARKET,
                quantity=Decimal('100'),
                filled_quantity=Decimal('100'),
                remaining_quantity=Decimal('0'),
                average_fill_price=Decimal('155.75'),
                status=OrderStatus.FILLED,
                created_at=datetime.utcnow() - timedelta(hours=2),
                updated_at=datetime.utcnow() - timedelta(hours=2),
                filled_at=datetime.utcnow() - timedelta(hours=2)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving order {order_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve order"
        )


@router.delete("/{order_id}", response_model=BaseResponse, summary="Cancel Order")
async def cancel_order(
    order_id: str,
    request: CancelOrderRequest = None,
    order_manager: EnhancedOrderManager = Depends(lambda: None),
    current_user: User = Depends(require_permission(UserRole.TRADER))
):
    """Cancel a pending order."""
    try:
        # Mock order cancellation
        logger.info(f"Order {order_id} cancelled by user {current_user.username}")
        
        return BaseResponse(
            success=True,
            message=f"Order {order_id} cancelled successfully"
        )
        
    except Exception as e:
        logger.error(f"Error cancelling order {order_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel order"
        )


@router.get("/trades/history", response_model=List[TradeInfo], summary="Get Trade History")
async def get_trades(
    symbol: Optional[str] = Query(None, description="Filter by symbol"),
    limit: int = Query(100, ge=1, le=1000, description="Number of trades to return"),
    order_manager: EnhancedOrderManager = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """Get trade execution history."""
    try:
        # Mock trade data
        trades = [
            TradeInfo(
                id="trade-001",
                order_id="order-001",
                symbol="AAPL",
                side="buy",
                quantity=Decimal('100'),
                price=Decimal('155.75'),
                value=Decimal('15575.00'),
                commission=Decimal('1.00'),
                executed_at=datetime.utcnow() - timedelta(hours=2)
            ),
            TradeInfo(
                id="trade-002",
                order_id="order-003",
                symbol="MSFT",
                side="sell",
                quantity=Decimal('50'),
                price=Decimal('285.20'),
                value=Decimal('14260.00'),
                commission=Decimal('1.00'),
                executed_at=datetime.utcnow() - timedelta(hours=4)
            )
        ]
        
        # Apply filters
        if symbol:
            trades = [t for t in trades if t.symbol == symbol.upper()]
        
        return trades[:limit]
        
    except Exception as e:
        logger.error(f"Error retrieving trades: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve trades"
        )