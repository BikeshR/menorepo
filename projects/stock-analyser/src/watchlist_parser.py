"""
Watchlist Parser

This module parses a watchlist file containing stock tickers
and provides functionality to retrieve ticker information.
"""

from typing import List, Dict, Optional
import os
import re


class WatchlistParser:
    """Parser for stock watchlist files"""

    def __init__(self, watchlist_path: str):
        """Initialize with path to watchlist file

        Args:
            watchlist_path: Path to the watchlist file
        """
        self.watchlist_path = watchlist_path
        self.tickers = []

    def parse(self) -> List[str]:
        """Parse the watchlist file and extract ticker information

        Returns:
            List of ticker strings in format "EXCHANGE:SYMBOL" or "SYMBOL"

        Raises:
            FileNotFoundError: If watchlist file does not exist
        """
        if not os.path.exists(self.watchlist_path):
            raise FileNotFoundError(f"Watchlist file not found: {self.watchlist_path}")

        tickers = []

        with open(self.watchlist_path, "r") as file:
            for line in file:
                # Remove comments and whitespace
                line = line.split("#", 1)[0].strip()

                # Skip empty lines
                if not line:
                    continue

                # Add ticker to list
                tickers.append(line)

        self.tickers = tickers
        return tickers

    def get_exchange_and_symbol(self, ticker: str) -> Dict[str, str]:
        """Parse ticker string into exchange and symbol

        Args:
            ticker: Ticker string in format "EXCHANGE:SYMBOL" or "SYMBOL"

        Returns:
            Dictionary with 'exchange' and 'symbol' keys
        """
        if ":" in ticker:
            exchange, symbol = ticker.split(":", 1)
            return {"exchange": exchange, "symbol": symbol}
        else:
            # No exchange specified
            return {"exchange": None, "symbol": ticker}

    def get_tickers(self) -> List[str]:
        """Get the list of tickers

        If parse() hasn't been called yet, it will be called automatically.

        Returns:
            List of ticker strings
        """
        if not self.tickers:
            self.parse()

        return self.tickers


def load_watchlist(watchlist_path: str) -> List[str]:
    """Convenience function to load watchlist from file

    Args:
        watchlist_path: Path to watchlist file

    Returns:
        List of ticker strings
    """
    parser = WatchlistParser(watchlist_path)
    return parser.parse()
