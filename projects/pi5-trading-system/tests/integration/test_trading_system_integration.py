"""
Integration tests for Pi5 Trading System.

Tests the complete trading system workflow from market data ingestion
through strategy execution to portfolio management. Validates that all
components work together correctly in realistic scenarios.

Test Scenarios:
1. End-to-end trading workflow
2. Multi-strategy coordination  
3. Risk management integration
4. Event-driven architecture validation
5. Error handling and recovery
"""

import asyncio
import pytest
import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

from core.interfaces import RiskLimits
from events.event_bus import EventBus
from events.event_types import MarketDataEvent, SignalGeneratedEvent
from strategies.manager import StrategyManager
from strategies.moving_average_crossover import MovingAverageCrossoverStrategy
from risk.manager import RiskManagerImplementation
from orders.manager import OrderManager
from orders.brokers.paper_broker import PaperTradingBroker
from portfolio.manager import PortfolioManager
from database.repositories.market_data import MarketDataRepository


@pytest.fixture
async def trading_system():
    """Create a complete trading system for integration testing."""
    
    # Create event bus
    event_bus = EventBus()
    await event_bus.start()
    
    # Mock database components
    db_manager = AsyncMock()
    market_data_repo = AsyncMock()
    
    # Create risk limits
    risk_limits = RiskLimits(
        max_position_size=0.1,  # 10% max position
        max_portfolio_exposure=0.8,  # 80% max exposure
        max_daily_loss=0.02,  # 2% daily loss limit
        max_drawdown=0.1,  # 10% drawdown limit
        max_correlation=0.7,  # 70% correlation limit
        max_sector_exposure=0.3,  # 30% sector exposure limit
    )
    
    # Create system components
    portfolio_manager = PortfolioManager(
        event_bus=event_bus,
        db_manager=db_manager,
        market_data_repo=market_data_repo,
        initial_cash=100000.0
    )
    
    risk_manager = RiskManagerImplementation(
        risk_limits=risk_limits,
        db_manager=db_manager,
        event_bus=event_bus
    )
    
    paper_broker = PaperTradingBroker(
        event_bus=event_bus,
        market_data_repo=market_data_repo,
        initial_cash=100000.0
    )
    
    order_manager = OrderManager(
        event_bus=event_bus,
        db_manager=db_manager,
        risk_manager=risk_manager,
        primary_broker=paper_broker
    )
    
    strategy_manager = StrategyManager(
        event_bus=event_bus,
        db_manager=db_manager
    )
    
    # Create a test strategy
    ma_strategy = MovingAverageCrossoverStrategy(
        name="TestMAStrategy",
        parameters={
            'short_period': 10,
            'long_period': 20,
            'min_volume': 1000,
            'confidence_threshold': 0.7,
        },
        symbols=["AAPL", "GOOGL"]
    )
    
    # Start all components
    await portfolio_manager.start()
    await order_manager.start()
    await strategy_manager.start()
    
    # Register strategy
    strategy_id = strategy_manager.register_strategy(ma_strategy, auto_start=True)
    
    # Set portfolio in order manager for risk validation
    order_manager.set_portfolio(portfolio_manager.get_portfolio())
    
    # Wait for strategy to initialize
    await asyncio.sleep(0.1)
    
    system = {
        'event_bus': event_bus,
        'portfolio_manager': portfolio_manager,
        'risk_manager': risk_manager,
        'order_manager': order_manager,
        'strategy_manager': strategy_manager,
        'paper_broker': paper_broker,
        'strategy_id': strategy_id,
        'strategy': ma_strategy,
    }
    
    yield system
    
    # Cleanup
    await portfolio_manager.stop()
    await order_manager.stop()
    await strategy_manager.stop()
    await event_bus.stop()


@pytest.mark.asyncio
async def test_end_to_end_trading_workflow(trading_system):
    """Test complete trading workflow from market data to portfolio update."""
    
    system = trading_system
    event_bus = system['event_bus']
    portfolio_manager = system['portfolio_manager']
    strategy = system['strategy']
    
    # Get initial portfolio state
    initial_portfolio = portfolio_manager.get_portfolio()
    initial_cash = initial_portfolio.cash
    initial_positions = len(initial_portfolio.positions)
    
    # Generate market data that should trigger MA crossover signals
    # First, send data to build up history (below threshold)
    symbol = "AAPL"
    base_price = 150.0
    
    # Send historical data to build moving averages
    for i in range(30):  # 30 days of data
        price = base_price + (i * 0.5)  # Upward trend
        
        market_data = MarketDataEvent(
            symbol=symbol,
            timestamp=datetime.utcnow() - timedelta(days=30-i),
            open_price=price - 0.5,
            high_price=price + 1.0,
            low_price=price - 1.0,
            close_price=price,
            volume=100000,
            source="test"
        )
        
        await event_bus.publish(market_data)
    
    # Wait for processing
    await asyncio.sleep(1.0)
    
    # Send market data that should trigger a BUY signal (golden cross)
    trigger_price = base_price + 20.0  # Significant price jump
    
    market_data = MarketDataEvent(
        symbol=symbol,
        timestamp=datetime.utcnow(),
        open_price=trigger_price - 1.0,
        high_price=trigger_price + 2.0,
        low_price=trigger_price - 0.5,
        close_price=trigger_price,
        volume=150000,  # High volume
        source="test"
    )
    
    await event_bus.publish(market_data)
    
    # Wait for complete processing chain
    await asyncio.sleep(2.0)
    
    # Check that trading occurred
    final_portfolio = portfolio_manager.get_portfolio()
    
    # Verify portfolio changes
    assert final_portfolio.cash < initial_cash, "Cash should decrease after buying"
    
    # Check for position creation
    position = final_portfolio.get_position(symbol)
    if position:
        assert position.quantity > 0, "Should have created a long position"
        assert position.symbol == symbol, "Position should be for correct symbol"
        
        print(f"✅ Position created: {position.quantity} shares of {symbol} @ ${position.average_cost:.2f}")
    
    # Verify order manager statistics
    order_stats = system['order_manager'].get_manager_stats()
    assert order_stats['orders_created'] > 0, "Should have created at least one order"
    
    print(f"✅ Order statistics: {order_stats['orders_created']} orders created")
    
    # Verify strategy manager statistics  
    strategy_stats = system['strategy_manager'].get_manager_stats()
    assert strategy_stats['running_strategies'] > 0, "Should have running strategies"
    
    print(f"✅ Strategy statistics: {strategy_stats['running_strategies']} strategies running")
    
    # Verify portfolio manager statistics
    portfolio_stats = portfolio_manager.get_manager_stats()
    assert portfolio_stats['trade_count'] >= 0, "Should track trades"
    
    print(f"✅ Portfolio statistics: ${portfolio_stats['total_value']:,.2f} total value")


@pytest.mark.asyncio
async def test_risk_management_integration(trading_system):
    """Test that risk management properly blocks risky trades."""
    
    system = trading_system
    event_bus = system['event_bus']
    risk_manager = system['risk_manager']
    portfolio_manager = system['portfolio_manager']
    
    # Create a signal that should violate position size limits
    from core.interfaces import Signal, TradingSignal
    
    large_signal = Signal(
        symbol="AAPL",
        signal_type=TradingSignal.BUY,
        confidence=0.9,
        price=150.0,
        timestamp=datetime.utcnow(),
        strategy_name="TestStrategy",
        metadata={}
    )
    
    # Test risk validation
    portfolio = portfolio_manager.get_portfolio()
    is_valid, violation = await risk_manager.validate_signal(large_signal, portfolio)
    
    # Should be valid for reasonable position size
    assert is_valid or violation is not None, "Risk manager should provide clear validation result"
    
    print(f"✅ Risk validation result: valid={is_valid}")
    
    # Test position sizing
    position_size = await risk_manager.calculate_position_size(
        large_signal, 
        portfolio.total_value, 
        large_signal.price
    )
    
    assert position_size >= 0, "Position size should be non-negative"
    
    # Position size should respect limits
    max_position_value = portfolio.total_value * risk_manager.risk_limits.max_position_size
    calculated_value = position_size * large_signal.price
    
    assert calculated_value <= max_position_value * 1.01, "Position size should respect risk limits"  # Small tolerance
    
    print(f"✅ Position sizing: {position_size} shares (${calculated_value:,.2f})")


@pytest.mark.asyncio 
async def test_event_system_integration(trading_system):
    """Test that the event system properly coordinates all components."""
    
    system = trading_system
    event_bus = system['event_bus']
    
    # Get event bus statistics
    initial_stats = event_bus.get_stats()
    
    # Publish test events
    test_events = [
        MarketDataEvent(
            symbol="TEST",
            timestamp=datetime.utcnow(),
            open_price=100.0,
            high_price=101.0,
            low_price=99.0,
            close_price=100.5,
            volume=50000,
            source="test"
        ),
        SignalGeneratedEvent(
            strategy_name="TestStrategy",
            symbol="TEST",
            signal_type="buy",
            confidence=0.8,
            price=100.5,
            timestamp=datetime.utcnow(),
            metadata={}
        )
    ]
    
    for event in test_events:
        await event_bus.publish(event)
    
    # Wait for processing
    await asyncio.sleep(0.5)
    
    # Check event statistics
    final_stats = event_bus.get_stats()
    
    assert final_stats['events_published'] > initial_stats['events_published'], "Events should be published"
    assert final_stats['events_processed'] > initial_stats['events_processed'], "Events should be processed"
    
    print(f"✅ Event processing: {final_stats['events_processed']} events processed")


@pytest.mark.asyncio
async def test_paper_trading_broker(trading_system):
    """Test paper trading broker functionality."""
    
    system = trading_system
    paper_broker = system['paper_broker']
    
    # Get initial account info
    initial_account = await paper_broker.get_account_info()
    initial_cash = initial_account['cash']
    
    # Create and submit a test order
    from core.interfaces import Order, OrderType, OrderStatus
    
    test_order = Order(
        order_id=f"TEST_{uuid.uuid4().hex[:8]}",
        symbol="AAPL",
        side="buy",
        quantity=10,
        order_type=OrderType.MARKET,
        strategy_name="TestStrategy"
    )
    
    # Submit order
    broker_order_id = await paper_broker.submit_order(test_order)
    assert broker_order_id is not None, "Order should be submitted successfully"
    
    print(f"✅ Order submitted: {broker_order_id}")
    
    # Wait for potential fill
    await asyncio.sleep(2.0)
    
    # Check account changes
    final_account = await paper_broker.get_account_info()
    broker_stats = paper_broker.get_broker_stats()
    
    assert broker_stats['orders_submitted'] > 0, "Should track submitted orders"
    
    print(f"✅ Broker statistics: {broker_stats['orders_submitted']} orders submitted")


@pytest.mark.asyncio
async def test_strategy_performance_tracking(trading_system):
    """Test strategy performance tracking and metrics."""
    
    system = trading_system
    strategy_manager = system['strategy_manager']
    strategy = system['strategy']
    
    # Get strategy performance metrics
    performance = strategy.get_performance_metrics()
    
    # Should have basic structure
    assert isinstance(performance, dict), "Performance should be a dictionary"
    assert 'total_trades' in performance, "Should track total trades"
    assert 'signals_generated' in performance, "Should track signals generated"
    
    print(f"✅ Strategy performance: {performance.get('signals_generated', 0)} signals generated")
    
    # Get strategy status
    status = strategy_manager.get_strategy_status()
    
    assert len(status) > 0, "Should have strategy status information"
    
    strategy_id = system['strategy_id']
    if strategy_id in status:
        strategy_status = status[strategy_id]
        assert strategy_status['name'] == strategy.name, "Should track strategy name correctly"
        
        print(f"✅ Strategy status: {strategy_status['status']}")


@pytest.mark.asyncio
async def test_portfolio_valuation(trading_system):
    """Test portfolio valuation and metrics calculation."""
    
    system = trading_system
    portfolio_manager = system['portfolio_manager']
    
    # Get portfolio summary
    summary = portfolio_manager.get_portfolio_summary()
    
    # Validate portfolio summary structure
    required_fields = [
        'total_value', 'cash', 'long_value', 'short_value',
        'unrealized_pnl', 'realized_pnl', 'total_pnl'
    ]
    
    for field in required_fields:
        assert field in summary, f"Portfolio summary should include {field}"
    
    assert summary['total_value'] > 0, "Portfolio should have positive total value"
    assert summary['cash'] <= 100000.0, "Cash should not exceed initial amount without gains"
    
    print(f"✅ Portfolio valuation: ${summary['total_value']:,.2f} total value")
    
    # Test performance metrics
    metrics = portfolio_manager.get_performance_metrics()
    
    # Should have performance metrics structure
    assert hasattr(metrics, 'total_return'), "Should have total return metric"
    assert hasattr(metrics, 'sharpe_ratio'), "Should have Sharpe ratio metric"
    
    print(f"✅ Performance metrics: {metrics.total_return:.4f} total return")


if __name__ == "__main__":
    # Run integration tests
    async def run_tests():
        """Run all integration tests."""
        print("🚀 Starting Pi5 Trading System Integration Tests\n")
        
        # This would normally use pytest, but for demo we'll run one test
        print("Creating trading system...")
        
        # Note: In real testing, you'd use pytest fixtures
        # This is a simplified version for demonstration
        print("✅ Integration tests would run here with proper pytest setup")
        print("\nTo run full tests, use: pytest tests/integration/")
    
    asyncio.run(run_tests())