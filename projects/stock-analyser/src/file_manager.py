"""
File Manager

This module handles file operations for the stock analyzer,
including checking for existing files and managing historical data.

It provides a centralized interface for:
1. Storing and retrieving SimplyWall.st API JSON data with timestamped filenames
2. Managing investment memo files with consistent naming conventions
3. Checking file freshness based on configurable day thresholds
4. Intelligently determining when new data or memos need to be generated

All files are stored with timestamps (YYYYMMDD) in their filenames to maintain
a historical record of analyses and enable performance tracking over time.
"""

import os
import glob
import json
import datetime
from typing import Dict, List, Optional, Any, Union, Tuple


class FileManager:
    """Manages file operations for stock data and investment memos

    This class handles file system operations for the stock analyzer application
    including checking for file updates, managing historical data storage, and
    implementing file naming conventions. It supports:

    File naming conventions:
    - Stock data: TICKER_YYYYMMDD.json (e.g., AAPL_20230501.json)
    - Investment memos: TICKER_YYYYMMDD.md (e.g., AAPL_20230501.md)

    Key features:
    - Timestamped file storage for SimplyWall.st API data in JSON format
    - Managing final investment memos with consistent naming patterns
    - Determining when files need to be refreshed based on time thresholds
    - Processing and storing insider transaction data with limits
    - Standardized naming convention for stock files across the application
    """

    def __init__(self, sws_data_dir: str, final_memos_dir: str):
        """Initialize with paths to data directories

        Args:
            sws_data_dir: Directory for storing SimplyWall.st API data in JSON format
            final_memos_dir: Directory for storing final investment memos as markdown files
                             with historical versioning by timestamp
        """
        self.sws_data_dir = sws_data_dir
        self.final_memos_dir = final_memos_dir

        # Create directories if they don't exist
        os.makedirs(sws_data_dir, exist_ok=True)
        os.makedirs(final_memos_dir, exist_ok=True)

    def _get_stock_filename(self, ticker: str) -> str:
        """Convert ticker to a safe filename

        Args:
            ticker: Ticker string like "EXCHANGE:SYMBOL" or "SYMBOL"

        Returns:
            Safe filename string
        """
        # Replace : with _ and make uppercase
        return ticker.replace(":", "_").upper()

    def _needs_update(
        self, ticker: str, pattern: str, days_threshold: int
    ) -> Tuple[bool, Optional[str]]:
        """Check if new data should be fetched for a stock

        Args:
            ticker: Stock ticker
            pattern: File pattern to search for
            days_threshold: Number of days before refreshing data

        Returns:
            Tuple of (needs_update, latest_file_path)
            - needs_update: True if stock needs update, False otherwise
            - latest_file_path: Path to most recent file, or None if no files exist
        """
        stock_filename = self._get_stock_filename(ticker)

        # Get all matching files for this stock
        files = glob.glob(pattern.format(stock_filename=stock_filename))

        if not files:
            # No files exist, update needed
            return True, None

        # Find the most recent file
        most_recent_file = max(files, key=os.path.getctime)

        # Get file creation time
        file_time = datetime.datetime.fromtimestamp(os.path.getctime(most_recent_file))
        current_time = datetime.datetime.now()

        # Calculate time difference in days
        days_diff = (current_time - file_time).days

        # Return True if the most recent file is older than threshold
        return days_diff >= days_threshold, most_recent_file

    def needs_json_update(self, ticker: str, days_threshold: int = 5) -> Tuple[bool, Optional[str]]:
        """Check if new SimplyWall.st data should be fetched for a stock

        Args:
            ticker: Stock ticker
            days_threshold: Number of days before refreshing data

        Returns:
            Tuple of (needs_update, latest_file_path)
        """
        pattern = os.path.join(self.sws_data_dir, "{stock_filename}_*.json")
        return self._needs_update(ticker, pattern, days_threshold)

    def needs_final_memo_update(
        self, ticker: str, days_threshold: int = 5
    ) -> Tuple[bool, Optional[str]]:
        """Check if new final memo should be generated for a stock

        Args:
            ticker: Stock ticker
            days_threshold: Number of days before refreshing memo

        Returns:
            Tuple of (needs_update, latest_file_path)
        """
        pattern = os.path.join(self.final_memos_dir, "{stock_filename}_*.md")
        return self._needs_update(ticker, pattern, days_threshold)

    def save_stock_data(self, ticker: str, data: Dict[str, Any]) -> str:
        """Save stock data to a timestamped JSON file

        Args:
            ticker: Stock ticker
            data: Stock data to save

        Returns:
            Path to saved file
        """
        stock_filename = self._get_stock_filename(ticker)
        timestamp = datetime.datetime.now().strftime("%Y%m%d")

        # Limit insider transactions to the latest 5 if more than 5 exist
        if "insiderTransactions" in data and isinstance(data["insiderTransactions"], list) and len(data["insiderTransactions"]) > 5:
            # Sort by filingDate (if available) or tradeDateMax in descending order
            if all("filingDate" in tx for tx in data["insiderTransactions"]):
                data["insiderTransactions"].sort(key=lambda x: x["filingDate"], reverse=True)
            elif all("tradeDateMax" in tx for tx in data["insiderTransactions"]):
                data["insiderTransactions"].sort(key=lambda x: x["tradeDateMax"], reverse=True)

            # Keep only the latest 5 transactions
            data["insiderTransactions"] = data["insiderTransactions"][:5]

        filename = f"{stock_filename}_{timestamp}.json"
        filepath = os.path.join(self.sws_data_dir, filename)

        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)

        return filepath

    def save_final_memo(self, ticker: str, memo_content: str) -> str:
        """Save a final memo to the final memos directory with timestamp

        Args:
            ticker: Stock ticker
            memo_content: Content of the memo

        Returns:
            Path to saved file
        """
        stock_filename = self._get_stock_filename(ticker)
        timestamp = datetime.datetime.now().strftime("%Y%m%d")

        filename = f"{stock_filename}_{timestamp}.md"
        filepath = os.path.join(self.final_memos_dir, filename)

        with open(filepath, "w") as f:
            f.write(memo_content)

        return filepath

    def get_latest_data_file(self, ticker: str) -> Optional[str]:
        """Get path to the most recent data file for a stock

        Args:
            ticker: Stock ticker

        Returns:
            Path to the most recent file, or None if no files exist
        """
        _, file_path = self.needs_json_update(ticker, days_threshold=999999)
        return file_path

    def get_latest_final_memo(self, ticker: str) -> Optional[str]:
        """Get path to the most recent final memo for a stock

        Args:
            ticker: Stock ticker

        Returns:
            Path to the most recent file, or None if no files exist
        """
        _, file_path = self.needs_final_memo_update(ticker, days_threshold=999999)
        return file_path

    def load_json_data(self, filepath: str) -> Dict[str, Any]:
        """Load JSON data from file

        Args:
            filepath: Path to JSON file

        Returns:
            Parsed JSON data

        Raises:
            FileNotFoundError: If file does not exist
            json.JSONDecodeError: If file contains invalid JSON
        """
        with open(filepath, "r") as f:
            return json.load(f)

    def load_memo_content(self, filepath: str) -> str:
        """Load memo content from file

        Args:
            filepath: Path to markdown memo file

        Returns:
            Memo content as string

        Raises:
            FileNotFoundError: If file does not exist
        """
        with open(filepath, "r") as f:
            return f.read()
