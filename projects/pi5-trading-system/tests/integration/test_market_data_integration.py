"""
Integration tests for Market Data System.

Tests the complete market data pipeline including multi-provider failover,
data quality validation, caching, and real-time streaming capabilities.
"""

import pytest
import asyncio
import pandas as pd
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import numpy as np

from core.market_data import (
    MarketDataManager,
    YahooFinanceProvider,
    AlphaVantageProvider,
    TechnicalIndicators,
    DataQualityValidator
)
from core.exceptions import MarketDataError, DataQualityError


@pytest.fixture
async def market_data_manager():
    """Create MarketDataManager with mocked providers for testing."""
    
    # Mock Yahoo Finance provider
    yahoo_provider = AsyncMock(spec=YahooFinanceProvider)
    yahoo_provider.name = "yahoo_finance"
    yahoo_provider.is_healthy.return_value = True
    yahoo_provider.get_rate_limit_status.return_value = {
        'requests_per_minute': 100,
        'requests_made': 10,
        'reset_time': datetime.utcnow() + timedelta(minutes=1)
    }
    
    # Mock Alpha Vantage provider
    alpha_provider = AsyncMock(spec=AlphaVantageProvider)
    alpha_provider.name = "alpha_vantage"
    alpha_provider.is_healthy.return_value = True
    alpha_provider.get_rate_limit_status.return_value = {
        'requests_per_minute': 5,
        'requests_made': 1,
        'reset_time': datetime.utcnow() + timedelta(minutes=1)
    }
    
    # Create manager with mocked providers
    manager = MarketDataManager()
    manager.providers = [yahoo_provider, alpha_provider]
    manager.active_providers = [yahoo_provider, alpha_provider]
    
    return manager, yahoo_provider, alpha_provider


@pytest.fixture
def sample_ohlcv_data():
    """Generate sample OHLCV data for testing."""
    dates = pd.date_range(start='2024-01-01', end='2024-01-31', freq='1min')
    
    # Generate realistic price data
    np.random.seed(42)
    base_price = 100.0
    returns = np.random.normal(0, 0.001, len(dates))  # 0.1% volatility
    prices = base_price * np.exp(np.cumsum(returns))
    
    # Create OHLCV data
    data = pd.DataFrame({
        'timestamp': dates,
        'open': prices,
        'high': prices * np.random.uniform(1.0, 1.02, len(dates)),
        'low': prices * np.random.uniform(0.98, 1.0, len(dates)),
        'close': prices,
        'volume': np.random.randint(1000, 10000, len(dates))
    })
    
    # Ensure OHLC relationships are valid
    data['high'] = np.maximum(data['high'], np.maximum(data['open'], data['close']))
    data['low'] = np.minimum(data['low'], np.minimum(data['open'], data['close']))
    
    data.set_index('timestamp', inplace=True)
    return data


class TestMarketDataProviderFailover:
    """Test multi-provider failover scenarios."""
    
    @pytest.mark.asyncio
    async def test_primary_provider_success(self, market_data_manager, sample_ohlcv_data):
        """Test successful data retrieval from primary provider."""
        manager, yahoo_provider, alpha_provider = market_data_manager
        
        # Configure primary provider to return data
        yahoo_provider.get_historical_data.return_value = sample_ohlcv_data
        
        result = await manager.get_historical_data(
            symbol="AAPL",
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            interval="1min"
        )
        
        # Verify primary provider was called
        yahoo_provider.get_historical_data.assert_called_once()
        alpha_provider.get_historical_data.assert_not_called()
        
        # Verify data integrity
        assert not result.empty
        assert len(result) == len(sample_ohlcv_data)
        assert all(col in result.columns for col in ['open', 'high', 'low', 'close', 'volume'])
    
    @pytest.mark.asyncio
    async def test_failover_to_secondary_provider(self, market_data_manager, sample_ohlcv_data):
        """Test failover when primary provider fails."""
        manager, yahoo_provider, alpha_provider = market_data_manager
        
        # Configure primary provider to fail
        yahoo_provider.get_historical_data.side_effect = MarketDataError("Primary provider failed")
        
        # Configure secondary provider to succeed
        alpha_provider.get_historical_data.return_value = sample_ohlcv_data
        
        result = await manager.get_historical_data(
            symbol="AAPL",
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            interval="1min"
        )
        
        # Verify both providers were called
        yahoo_provider.get_historical_data.assert_called_once()
        alpha_provider.get_historical_data.assert_called_once()
        
        # Verify data integrity
        assert not result.empty
        assert len(result) == len(sample_ohlcv_data)
    
    @pytest.mark.asyncio
    async def test_all_providers_fail(self, market_data_manager):
        """Test behavior when all providers fail."""
        manager, yahoo_provider, alpha_provider = market_data_manager
        
        # Configure all providers to fail
        yahoo_provider.get_historical_data.side_effect = MarketDataError("Yahoo failed")
        alpha_provider.get_historical_data.side_effect = MarketDataError("Alpha Vantage failed")
        
        with pytest.raises(MarketDataError, match="All market data providers failed"):
            await manager.get_historical_data(
                symbol="AAPL",
                start_date=datetime(2024, 1, 1),
                end_date=datetime(2024, 1, 31),
                interval="1min"
            )
        
        # Verify both providers were attempted
        yahoo_provider.get_historical_data.assert_called_once()
        alpha_provider.get_historical_data.assert_called_once()


class TestDataQualityValidation:
    """Test comprehensive data quality validation workflows."""
    
    @pytest.fixture
    def validator(self):
        """Create DataQualityValidator instance."""
        return DataQualityValidator(strict_mode=True)
    
    def test_valid_data_passes_validation(self, validator, sample_ohlcv_data):
        """Test that clean data passes validation."""
        result = validator.validate_ohlcv_data(sample_ohlcv_data, "AAPL")
        
        assert result.is_valid
        assert len(result.issues) == 0
        assert result.cleaned_data is not None
    
    def test_invalid_ohlc_relationships_detected(self, validator):
        """Test detection of invalid OHLC relationships."""
        # Create data with high < low (invalid)
        invalid_data = pd.DataFrame({
            'open': [100, 101, 102],
            'high': [99, 100, 101],  # High < Open (invalid)
            'low': [98, 99, 100],
            'close': [100.5, 101.5, 102.5],
            'volume': [1000, 1100, 1200]
        }, index=pd.date_range('2024-01-01', periods=3, freq='1min'))
        
        result = validator.validate_ohlcv_data(invalid_data, "TEST")
        
        assert not result.is_valid
        assert any(issue.category == "invalid_high_open" for issue in result.issues)
        assert result.cleaned_data is not None
        assert len(result.cleaned_data) < len(invalid_data)  # Invalid rows removed
    
    def test_negative_prices_handled(self, validator):
        """Test handling of negative or zero prices."""
        invalid_data = pd.DataFrame({
            'open': [100, -50, 102],  # Negative price
            'high': [105, 55, 107],
            'low': [95, -55, 97],
            'close': [103, 0, 105],  # Zero price
            'volume': [1000, 1100, 1200]
        }, index=pd.date_range('2024-01-01', periods=3, freq='1min'))
        
        result = validator.validate_ohlcv_data(invalid_data, "TEST")
        
        assert not result.is_valid
        assert any(issue.category == "negative_price" for issue in result.issues)
        assert len(result.cleaned_data) == 1  # Only one valid row remains
    
    def test_outlier_detection(self, validator):
        """Test statistical outlier detection."""
        # Create data with extreme outlier
        outlier_data = pd.DataFrame({
            'open': [100] * 50 + [1000],  # Extreme outlier
            'high': [105] * 50 + [1050],
            'low': [95] * 50 + [950],
            'close': [103] * 50 + [1030],
            'volume': [1000] * 51
        }, index=pd.date_range('2024-01-01', periods=51, freq='1min'))
        
        result = validator.validate_ohlcv_data(outlier_data, "TEST")
        
        # Should detect outlier but still be valid (outliers are warnings)
        assert result.is_valid
        outlier_issues = [issue for issue in result.issues if "outliers" in issue.category]
        assert len(outlier_issues) > 0


class TestTechnicalIndicatorsIntegration:
    """Test technical indicators integration with market data."""
    
    @pytest.fixture
    def indicators(self):
        """Create TechnicalIndicators instance."""
        return TechnicalIndicators()
    
    def test_sma_calculation_with_real_data(self, indicators, sample_ohlcv_data):
        """Test SMA calculation with realistic market data."""
        result = indicators.simple_moving_average(
            data=sample_ohlcv_data,
            column='close',
            period=20
        )
        
        assert len(result) == len(sample_ohlcv_data)
        assert not result.isna().all()  # Should have valid values
        assert result.iloc[-1] > 0  # Last value should be positive
        
        # Verify SMA is actually the average
        manual_sma = sample_ohlcv_data['close'].tail(20).mean()
        assert abs(result.iloc[-1] - manual_sma) < 0.01
    
    def test_rsi_calculation_accuracy(self, indicators, sample_ohlcv_data):
        """Test RSI calculation accuracy."""
        result = indicators.rsi(
            data=sample_ohlcv_data,
            column='close',
            period=14
        )
        
        assert len(result) == len(sample_ohlcv_data)
        assert (result >= 0).all() and (result <= 100).all()  # RSI range 0-100
        assert not result.isna().all()
    
    def test_multiple_indicators_calculation(self, indicators, sample_ohlcv_data):
        """Test calculation of multiple indicators simultaneously."""
        indicators_config = {
            'sma': {'periods': [20, 50]},
            'ema': {'periods': [12, 26]},
            'rsi': {'period': 14},
            'macd': {'fast_period': 12, 'slow_period': 26, 'signal_period': 9},
            'bollinger_bands': {'period': 20, 'std_dev': 2.0}
        }
        
        result = indicators.calculate_multiple_indicators(
            ohlcv_data=sample_ohlcv_data,
            indicators=indicators_config
        )
        
        # Verify all expected columns are present
        expected_columns = [
            'sma_20', 'sma_50', 'ema_12', 'ema_26', 'rsi',
            'macd', 'signal', 'histogram', 'bb_upper', 'bb_middle', 'bb_lower'
        ]
        
        for col in expected_columns:
            assert col in result.columns, f"Missing indicator column: {col}"
        
        # Verify data integrity
        assert len(result) == len(sample_ohlcv_data)
        assert not result[expected_columns].isna().all().any()


class TestMarketDataCaching:
    """Test market data caching performance and consistency."""
    
    @pytest.mark.asyncio
    async def test_cache_hit_performance(self, market_data_manager, sample_ohlcv_data):
        """Test that cached data is returned quickly."""
        manager, yahoo_provider, alpha_provider = market_data_manager
        
        # Configure provider to return data
        yahoo_provider.get_historical_data.return_value = sample_ohlcv_data
        
        # First call - should hit provider
        start_time = datetime.utcnow()
        result1 = await manager.get_historical_data(
            symbol="AAPL",
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            interval="1min",
            use_cache=True
        )
        first_call_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Second call - should hit cache
        start_time = datetime.utcnow()
        result2 = await manager.get_historical_data(
            symbol="AAPL",
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            interval="1min",
            use_cache=True
        )
        second_call_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Verify provider was only called once
        yahoo_provider.get_historical_data.assert_called_once()
        
        # Verify cache hit is faster (allowing for some tolerance)
        assert second_call_time < first_call_time * 0.5
        
        # Verify data consistency
        pd.testing.assert_frame_equal(result1, result2)
    
    @pytest.mark.asyncio
    async def test_cache_expiration(self, market_data_manager, sample_ohlcv_data):
        """Test that cache expires correctly."""
        manager, yahoo_provider, alpha_provider = market_data_manager
        
        # Set very short cache TTL for testing
        original_ttl = manager.cache_ttl_minutes
        manager.cache_ttl_minutes = 0.01  # 0.6 seconds
        
        try:
            yahoo_provider.get_historical_data.return_value = sample_ohlcv_data
            
            # First call
            await manager.get_historical_data(
                symbol="AAPL",
                start_date=datetime(2024, 1, 1),
                end_date=datetime(2024, 1, 31),
                interval="1min",
                use_cache=True
            )
            
            # Wait for cache to expire
            await asyncio.sleep(1)
            
            # Second call - should hit provider again
            await manager.get_historical_data(
                symbol="AAPL",
                start_date=datetime(2024, 1, 1),
                end_date=datetime(2024, 1, 31),
                interval="1min",
                use_cache=True
            )
            
            # Verify provider was called twice
            assert yahoo_provider.get_historical_data.call_count == 2
            
        finally:
            # Restore original TTL
            manager.cache_ttl_minutes = original_ttl


class TestRealTimeDataStreaming:
    """Test real-time market data streaming capabilities."""
    
    @pytest.mark.asyncio
    async def test_real_time_quote_streaming(self, market_data_manager):
        """Test real-time quote data streaming."""
        manager, yahoo_provider, alpha_provider = market_data_manager
        
        # Mock real-time quotes
        mock_quotes = [
            {
                'symbol': 'AAPL',
                'timestamp': datetime.utcnow(),
                'last_price': 150.25,
                'bid_price': 150.20,
                'ask_price': 150.30,
                'volume': 1000
            },
            {
                'symbol': 'AAPL', 
                'timestamp': datetime.utcnow(),
                'last_price': 150.35,
                'bid_price': 150.30,
                'ask_price': 150.40,
                'volume': 1500
            }
        ]
        
        async def mock_quote_generator():
            for quote in mock_quotes:
                yield quote
                await asyncio.sleep(0.1)
        
        yahoo_provider.get_real_time_quotes.return_value = mock_quote_generator()
        
        # Collect streaming quotes
        collected_quotes = []
        async for quote in manager.get_real_time_quotes(['AAPL']):
            collected_quotes.append(quote)
            if len(collected_quotes) >= 2:
                break
        
        # Verify quotes were received
        assert len(collected_quotes) == 2
        assert collected_quotes[0]['symbol'] == 'AAPL'
        assert collected_quotes[1]['last_price'] == 150.35
    
    @pytest.mark.asyncio
    async def test_quote_validation_in_stream(self, market_data_manager):
        """Test that invalid quotes are filtered from stream."""
        manager, yahoo_provider, alpha_provider = market_data_manager
        
        # Mock quotes with invalid data
        mock_quotes = [
            {
                'symbol': 'AAPL',
                'timestamp': datetime.utcnow(),
                'last_price': 150.25,
                'bid_price': 150.20,
                'ask_price': 150.30,
                'volume': 1000
            },
            {
                'symbol': 'AAPL',
                'timestamp': datetime.utcnow(),
                'last_price': -50.0,  # Invalid negative price
                'bid_price': 150.30,
                'ask_price': 150.40,
                'volume': 1500
            },
            {
                'symbol': 'AAPL',
                'timestamp': datetime.utcnow(),
                'last_price': 150.45,
                'bid_price': 150.50,  # Invalid: bid > ask
                'ask_price': 150.40,
                'volume': 2000
            }
        ]
        
        async def mock_quote_generator():
            for quote in mock_quotes:
                yield quote
                await asyncio.sleep(0.1)
        
        yahoo_provider.get_real_time_quotes.return_value = mock_quote_generator()
        
        # Enable validation
        manager.enable_real_time_validation = True
        
        # Collect valid quotes only
        collected_quotes = []
        async for quote in manager.get_real_time_quotes(['AAPL']):
            collected_quotes.append(quote)
            if len(collected_quotes) >= 3:  # Try to collect all quotes
                break
        
        # Only the first quote should be valid
        assert len(collected_quotes) == 1
        assert collected_quotes[0]['last_price'] == 150.25


class TestEndToEndMarketDataWorkflow:
    """Test complete end-to-end market data workflows."""
    
    @pytest.mark.asyncio
    async def test_complete_data_pipeline(self, sample_ohlcv_data):
        """Test complete data pipeline from provider to indicators."""
        
        # Create real MarketDataManager with mocked providers
        manager = MarketDataManager()
        
        # Mock provider
        mock_provider = AsyncMock()
        mock_provider.name = "test_provider"
        mock_provider.is_healthy.return_value = True
        mock_provider.get_historical_data.return_value = sample_ohlcv_data
        mock_provider.get_rate_limit_status.return_value = {
            'requests_per_minute': 100,
            'requests_made': 1,
            'reset_time': datetime.utcnow() + timedelta(minutes=1)
        }
        
        manager.providers = [mock_provider]
        manager.active_providers = [mock_provider]
        
        # Test complete workflow
        result = await manager.get_historical_data(
            symbol="AAPL",
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            interval="1min"
        )
        
        # Verify data was retrieved
        assert not result.empty
        assert len(result) == len(sample_ohlcv_data)
        
        # Test indicator calculation
        indicators = TechnicalIndicators()
        indicators_config = {
            'sma': {'periods': [20]},
            'rsi': {'period': 14}
        }
        
        enhanced_data = indicators.calculate_multiple_indicators(
            ohlcv_data=result,
            indicators=indicators_config
        )
        
        # Verify indicators were calculated
        assert 'sma_20' in enhanced_data.columns
        assert 'rsi' in enhanced_data.columns
        assert not enhanced_data['sma_20'].isna().all()
        assert not enhanced_data['rsi'].isna().all()
        
        # Test data quality validation
        validator = DataQualityValidator()
        validation_result = validator.validate_ohlcv_data(enhanced_data, "AAPL")
        
        assert validation_result.is_valid
        assert validation_result.cleaned_data is not None
    
    @pytest.mark.asyncio
    async def test_provider_health_monitoring(self, market_data_manager):
        """Test provider health monitoring and circuit breaker."""
        manager, yahoo_provider, alpha_provider = market_data_manager
        
        # Simulate provider becoming unhealthy
        yahoo_provider.is_healthy.return_value = False
        yahoo_provider.get_historical_data.side_effect = MarketDataError("Provider unhealthy")
        
        # Configure backup provider
        alpha_provider.get_historical_data.return_value = pd.DataFrame({
            'open': [100],
            'high': [105],
            'low': [95],
            'close': [103],
            'volume': [1000]
        }, index=[datetime.utcnow()])
        
        # Request should automatically use healthy provider
        result = await manager.get_historical_data(
            symbol="AAPL",
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            interval="1min"
        )
        
        # Verify unhealthy provider was skipped
        yahoo_provider.get_historical_data.assert_not_called()
        alpha_provider.get_historical_data.assert_called_once()
        
        # Verify data was still retrieved
        assert not result.empty


if __name__ == "__main__":
    pytest.main([__file__, "-v"])