"""
Watchlist Parser

This module parses a watchlist file in YAML format containing stock tickers
and provides functionality to retrieve ticker information.
"""

from typing import List, Dict, Optional, Tuple
import os
import yaml
import re


class WatchlistParser:
    """Parser for stock watchlist files in YAML format"""

    def __init__(self, watchlist_path: str):
        """Initialize with path to watchlist file

        Args:
            watchlist_path: Path to the watchlist YAML file
        """
        self.watchlist_path = watchlist_path
        self.tickers = []
        self.ticker_info = {}  # Holds ticker to company name mapping

    def parse(self) -> List[str]:
        """Parse the watchlist YAML file and extract ticker information

        Returns:
            List of ticker strings

        Raises:
            FileNotFoundError: If watchlist file does not exist
            yaml.YAMLError: If YAML parsing fails
        """
        if not os.path.exists(self.watchlist_path):
            raise FileNotFoundError(f"Watchlist file not found: {self.watchlist_path}")

        with open(self.watchlist_path, "r") as file:
            try:
                watchlist_data = yaml.safe_load(file)
            except yaml.YAMLError as e:
                raise yaml.YAMLError(f"Error parsing YAML in watchlist file: {str(e)}")

        # Validate YAML structure
        if not watchlist_data or not isinstance(watchlist_data, dict) or 'stocks' not in watchlist_data:
            raise ValueError("Invalid watchlist YAML format: 'stocks' key not found")

        stocks_data = watchlist_data['stocks']
        if not isinstance(stocks_data, list):
            raise ValueError("Invalid watchlist YAML format: 'stocks' must be a list")

        tickers = []
        ticker_info = {}

        # Process each stock entry in the list
        for stock_entry in stocks_data:
            if not isinstance(stock_entry, str):
                continue

            # Extract ticker and company name using pattern:
            # Format: "TICKER (Company Name)"
            match = re.match(r'([A-Z0-9]+)\s*\((.*)\)', stock_entry)
            if match:
                ticker = match.group(1).strip()
                company_name = match.group(2).strip()
                tickers.append(ticker)
                ticker_info[ticker] = company_name
            else:
                # Just a ticker with no company name
                ticker = stock_entry.strip()
                tickers.append(ticker)
                ticker_info[ticker] = ""

        self.tickers = tickers
        self.ticker_info = ticker_info
        return tickers

    def get_company_name(self, ticker: str) -> str:
        """Get company name for ticker if available

        Args:
            ticker: Ticker symbol

        Returns:
            Company name or empty string if not available
        """
        return self.ticker_info.get(ticker, "")

    def get_exchange_and_symbol(self, ticker: str) -> Dict[str, str]:
        """Parse ticker string into exchange and symbol

        For the YAML format, we don't have exchange information in the tickers,
        so this is primarily a compatibility function for older code.

        Args:
            ticker: Ticker string

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

    def get_ticker_and_company(self, ticker: str) -> Tuple[str, str]:
        """Get ticker and company name

        Args:
            ticker: Ticker symbol

        Returns:
            Tuple of (ticker, company_name)
        """
        company_name = self.get_company_name(ticker)
        return (ticker, company_name)


def load_watchlist(watchlist_path: str) -> List[str]:
    """Convenience function to load watchlist from YAML file

    Args:
        watchlist_path: Path to watchlist YAML file

    Returns:
        List of ticker strings
    """
    parser = WatchlistParser(watchlist_path)
    return parser.parse()