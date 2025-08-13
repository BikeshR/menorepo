"""
Market Data API Router for Pi5 Trading System.

REST API endpoints for market data access, provider management,
and real-time data streaming.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
import pandas as pd
import json

from core.market_data.manager import MarketDataManager
from web.models import BaseResponse
from core.exceptions import MarketDataError, DataQualityError


logger = logging.getLogger(__name__)

router = APIRouter()


# Import dependencies at function level to avoid circular imports


@router.get("/providers/status", summary="Get Market Data Provider Status")
async def get_provider_status():
    """Get status and health information for all market data providers."""
    try:
        # Get dependencies locally to avoid circular imports
        from web.app import app_state
        market_data_manager = app_state.get('market_data_manager')
        
        if not market_data_manager:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Market data manager not available"
            )
        
        provider_status = market_data_manager.get_provider_status()
        statistics = market_data_manager.get_statistics()
        
        return {
            "success": True,
            "timestamp": datetime.utcnow(),
            "providers": provider_status,
            "statistics": statistics
        }
        
    except Exception as e:
        logger.error(f"Error getting provider status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get provider status: {str(e)}"
        )


@router.get("/quotes/{symbol}", summary="Get Real-time Quote")
async def get_realtime_quote(symbol: str):
    """Get real-time quote for a specific symbol."""
    try:
        # Get dependencies locally to avoid circular imports
        from web.app import app_state
        market_data_manager = app_state.get('market_data_manager')
        
        if not market_data_manager:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Market data manager not available"
            )
        
        # Get symbol info (this will use the first available provider)
        symbol_info = await market_data_manager.get_symbol_info(symbol.upper())
        
        if not symbol_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Symbol {symbol} not found"
            )
        
        return {
            "success": True,
            "timestamp": datetime.utcnow(),
            "symbol": symbol.upper(),
            "data": symbol_info
        }
        
    except MarketDataError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Market data service error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error getting quote for {symbol}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get quote: {str(e)}"
        )


@router.get("/historical/{symbol}", summary="Get Historical Data")
async def get_historical_data(
    symbol: str,
    start_date: datetime = Query(..., description="Start date for historical data"),
    end_date: datetime = Query(default_factory=datetime.utcnow, description="End date for historical data"),
    interval: str = Query("1d", description="Data interval (1min, 5min, 15min, 30min, 1h, 1d)")
):
    """Get historical OHLCV data for a symbol."""
    try:
        # Get dependencies locally to avoid circular imports
        from web.app import app_state
        market_data_manager = app_state.get('market_data_manager')
        
        if not market_data_manager:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Market data manager not available"
            )
        
        # Validate date range
        if start_date >= end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start date must be before end date"
            )
        
        # Limit data range to prevent abuse
        max_days = 365
        if (end_date - start_date).days > max_days:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Date range cannot exceed {max_days} days"
            )
        
        # Get historical data
        df = await market_data_manager.get_historical_data(
            symbol=symbol.upper(),
            start_date=start_date,
            end_date=end_date,
            interval=interval
        )
        
        if df.empty:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No historical data found for {symbol}"
            )
        
        # Convert DataFrame to JSON-serializable format
        data = []
        for timestamp, row in df.iterrows():
            data.append({
                "timestamp": timestamp.isoformat(),
                "open": float(row['open']),
                "high": float(row['high']),
                "low": float(row['low']),
                "close": float(row['close']),
                "volume": int(row['volume']) if pd.notna(row['volume']) else 0
            })
        
        return {
            "success": True,
            "timestamp": datetime.utcnow(),
            "symbol": symbol.upper(),
            "interval": interval,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "data_points": len(data),
            "data": data
        }
        
    except MarketDataError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Market data service error: {str(e)}"
        )
    except DataQualityError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Data quality issue: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error getting historical data for {symbol}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get historical data: {str(e)}"
        )


@router.get("/search", summary="Search Symbols")
async def search_symbols(
    query: str = Query(..., min_length=1, description="Symbol search query"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of results")
):
    """Search for trading symbols."""
    try:
        # Get dependencies locally to avoid circular imports
        from web.app import app_state
        market_data_manager = app_state.get('market_data_manager')
        
        if not market_data_manager:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Market data manager not available"
            )
        
        # For now, return common symbols that match the query
        # This could be enhanced to use a real symbol search API
        common_symbols = [
            "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "NFLX",
            "SPY", "QQQ", "IWM", "GLD", "SLV", "TLT", "VIX",
            "BTC-USD", "ETH-USD", "ADA-USD", "DOGE-USD"
        ]
        
        query_upper = query.upper()
        matching_symbols = [
            symbol for symbol in common_symbols 
            if query_upper in symbol
        ][:limit]
        
        # Get detailed info for matching symbols
        results = []
        for symbol in matching_symbols:
            try:
                info = await market_data_manager.get_symbol_info(symbol)
                if info:
                    results.append({
                        "symbol": symbol,
                        "name": info.get('name', symbol),
                        "exchange": info.get('exchange'),
                        "currency": info.get('currency'),
                        "type": "stock"  # Could be enhanced to detect asset type
                    })
            except Exception as e:
                logger.warning(f"Failed to get info for {symbol}: {e}")
                continue
        
        return {
            "success": True,
            "timestamp": datetime.utcnow(),
            "query": query,
            "results_count": len(results),
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error searching symbols with query '{query}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search symbols: {str(e)}"
        )


@router.get("/stream/{symbol}", summary="Stream Real-time Data")
async def stream_realtime_data(symbol: str):
    """Stream real-time market data for a symbol."""
    async def generate_stream():
        try:
            # Get dependencies locally to avoid circular imports
            from web.app import app_state
            market_data_manager = app_state.get('market_data_manager')
            
            if not market_data_manager:
                error_data = json.dumps({
                    "error": "Market data manager not available",
                    "timestamp": datetime.utcnow().isoformat()
                })
                yield f"data: {error_data}\n\n"
                return
            
            async for quote_data in market_data_manager.get_real_time_quotes([symbol.upper()]):
                # Convert to JSON and yield
                json_data = json.dumps({
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": quote_data
                })
                yield f"data: {json_data}\n\n"
                
        except Exception as e:
            logger.error(f"Error in real-time stream for {symbol}: {e}")
            error_data = json.dumps({
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
            yield f"data: {error_data}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )


@router.get("/test-connection-public", summary="Test Market Data Connection (Public)")
async def test_market_data_connection_public():
    """Test market data provider connections and return diagnostics."""
    try:
        # Get dependencies locally to avoid circular imports
        from web.app import app_state
        market_data_manager = app_state.get('market_data_manager')
        
        if not market_data_manager:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Market data manager not available"
            )
        
        # Test with a common symbol
        test_symbol = "AAPL"
        
        # Test symbol info retrieval
        symbol_info = None
        try:
            symbol_info = await market_data_manager.get_symbol_info(test_symbol)
        except Exception as e:
            logger.warning(f"Symbol info test failed: {e}")
        
        # Test historical data retrieval
        historical_data = None
        try:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=5)
            df = await market_data_manager.get_historical_data(
                symbol=test_symbol,
                start_date=start_date,
                end_date=end_date,
                interval="1d"
            )
            historical_data = len(df) if not df.empty else 0
        except Exception as e:
            logger.warning(f"Historical data test failed: {e}")
        
        # Get provider status
        provider_status = market_data_manager.get_provider_status()
        statistics = market_data_manager.get_statistics()
        
        return {
            "success": True,
            "timestamp": datetime.utcnow(),
            "test_results": {
                "symbol_info_available": symbol_info is not None,
                "historical_data_points": historical_data,
                "test_symbol": test_symbol
            },
            "providers": provider_status,
            "statistics": statistics
        }
        
    except Exception as e:
        logger.error(f"Error testing market data connection: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test connection: {str(e)}"
        )