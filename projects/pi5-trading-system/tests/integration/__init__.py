"""
Integration Test Suite for Pi5 Trading System.

This module contains comprehensive integration tests that validate
the complete trading system working as a cohesive unit.

Test Categories:
- Market Data Integration: Multi-provider data pipeline testing
- Strategy Coordination: Multi-strategy signal aggregation and coordination
- Backtesting Integration: Complete backtesting workflow validation
- End-to-End System: Full system integration with realistic scenarios

Usage:
    # Run all integration tests
    pytest tests/integration/ -v
    
    # Run specific test category
    pytest tests/integration/test_market_data_integration.py -v
    pytest tests/integration/test_strategy_coordination.py -v
    pytest tests/integration/test_backtesting_integration.py -v
    pytest tests/integration/test_end_to_end_system.py -v
    
    # Run with parallel execution
    pytest tests/integration/ -v -n auto
    
Test Requirements:
- pytest>=7.0.0
- pytest-asyncio>=0.21.0
- pytest-xdist>=3.0.0 (for parallel execution)
- All Pi5 Trading System dependencies

Test Data:
- Uses realistic mock market data with proper OHLCV relationships
- Simulates multi-provider failover scenarios
- Tests with various market conditions (trending, sideways, volatile)
- Validates performance under stress conditions
"""

import logging
import sys
from pathlib import Path

# Add project root to path for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Configure logging for tests
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('tests/integration/integration_tests.log')
    ]
)

# Test configuration
INTEGRATION_TEST_CONFIG = {
    'market_data': {
        'test_symbols': ['AAPL', 'MSFT', 'SPY', 'TSLA', 'JNJ'],
        'test_period_days': 90,
        'data_frequency': '1min',
        'enable_data_validation': True,
        'test_provider_failover': True
    },
    'strategies': {
        'test_rsi_parameters': {
            'rsi_period': [10, 14, 20],
            'oversold_threshold': [20, 25, 30],
            'overbought_threshold': [70, 75, 80]
        },
        'test_momentum_parameters': {
            'fast_ema_period': [8, 12, 16],
            'slow_ema_period': [21, 26, 30],
            'adx_threshold': [20, 25, 30]
        },
        'max_test_strategies': 5,
        'enable_multi_strategy_coordination': True
    },
    'backtesting': {
        'test_capital': 100000.0,
        'commission_rate': 0.001,
        'slippage_bps': 2.0,
        'enable_parameter_optimization': True,
        'max_optimization_iterations': 20,
        'monte_carlo_simulations': 100
    },
    'performance': {
        'max_test_duration_minutes': 30,
        'max_memory_usage_mb': 1024,
        'enable_stress_testing': True,
        'stress_test_events': 10000
    }
}

__all__ = [
    'INTEGRATION_TEST_CONFIG'
]