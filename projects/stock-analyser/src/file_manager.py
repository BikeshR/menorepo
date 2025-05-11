"""
File Manager

This module handles file operations for the stock analyzer,
including checking for existing files and managing historical data.
"""

import os
import glob
import json
import datetime
from typing import Dict, List, Optional, Any, Union


class FileManager:
    """Manages file operations for stock data and memos"""
    
    def __init__(
        self,
        historical_json_dir: str,
        current_memos_dir: str,
        historical_memos_dir: str
    ):
        """Initialize with paths to data directories
        
        Args:
            historical_json_dir: Directory for storing historical JSON data
            current_memos_dir: Directory for current investment memos
            historical_memos_dir: Directory for historical investment memos
        """
        self.historical_json_dir = historical_json_dir
        self.current_memos_dir = current_memos_dir
        self.historical_memos_dir = historical_memos_dir
        
        # Create directories if they don't exist
        os.makedirs(historical_json_dir, exist_ok=True)
        os.makedirs(current_memos_dir, exist_ok=True)
        os.makedirs(historical_memos_dir, exist_ok=True)
    
    def _get_stock_filename(self, ticker: str) -> str:
        """Convert ticker to a safe filename
        
        Args:
            ticker: Ticker string like "EXCHANGE:SYMBOL" or "SYMBOL"
            
        Returns:
            Safe filename string
        """
        # Replace : with _ and make uppercase
        return ticker.replace(":", "_").upper()
    
    def needs_update(self, ticker: str, days_threshold: int = 5) -> bool:
        """Check if new data should be fetched for a stock
        
        Args:
            ticker: Stock ticker
            days_threshold: Number of days before refreshing data
            
        Returns:
            True if stock needs update, False otherwise
        """
        stock_filename = self._get_stock_filename(ticker)
        
        # Get all JSON files for this stock
        pattern = os.path.join(
            self.historical_json_dir, 
            f"{stock_filename}_*.json"
        )
        files = glob.glob(pattern)
        
        if not files:
            # No files exist, update needed
            return True
        
        # Find the most recent file
        most_recent_file = max(files, key=os.path.getctime)
        
        # Get file creation time
        file_time = datetime.datetime.fromtimestamp(os.path.getctime(most_recent_file))
        current_time = datetime.datetime.now()
        
        # Calculate time difference in days
        days_diff = (current_time - file_time).days
        
        # Return True if the most recent file is older than threshold
        return days_diff >= days_threshold
    
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
        
        filename = f"{stock_filename}_{timestamp}.json"
        filepath = os.path.join(self.historical_json_dir, filename)
        
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
        
        return filepath
    
    def get_latest_data_file(self, ticker: str) -> Optional[str]:
        """Get path to the most recent data file for a stock
        
        Args:
            ticker: Stock ticker
            
        Returns:
            Path to the most recent file, or None if no files exist
        """
        stock_filename = self._get_stock_filename(ticker)
        
        pattern = os.path.join(
            self.historical_json_dir, 
            f"{stock_filename}_*.json"
        )
        files = glob.glob(pattern)
        
        if not files:
            return None
        
        # Find the most recent file
        return max(files, key=os.path.getctime)
    
    def save_current_memo(self, ticker: str, memo_content: str) -> str:
        """Save a memo to the current memos directory
        
        Args:
            ticker: Stock ticker
            memo_content: Content of the memo
            
        Returns:
            Path to saved file
        """
        stock_filename = self._get_stock_filename(ticker)
        
        filename = f"{stock_filename}.md"
        filepath = os.path.join(self.current_memos_dir, filename)
        
        with open(filepath, 'w') as f:
            f.write(memo_content)
        
        return filepath
    
    def save_historical_memo(self, ticker: str, memo_content: str) -> str:
        """Save a memo to the historical memos directory
        
        Args:
            ticker: Stock ticker
            memo_content: Content of the memo
            
        Returns:
            Path to saved file
        """
        stock_filename = self._get_stock_filename(ticker)
        timestamp = datetime.datetime.now().strftime("%Y%m%d")
        
        filename = f"{stock_filename}_{timestamp}.md"
        filepath = os.path.join(self.historical_memos_dir, filename)
        
        with open(filepath, 'w') as f:
            f.write(memo_content)
        
        return filepath
    
    def get_current_memo(self, ticker: str) -> Optional[str]:
        """Get content of current memo for a stock
        
        Args:
            ticker: Stock ticker
            
        Returns:
            Memo content, or None if no memo exists
        """
        stock_filename = self._get_stock_filename(ticker)
        filepath = os.path.join(self.current_memos_dir, f"{stock_filename}.md")
        
        if not os.path.exists(filepath):
            return None
        
        with open(filepath, 'r') as f:
            return f.read()
    
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
        with open(filepath, 'r') as f:
            return json.load(f)