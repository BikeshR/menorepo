#!/usr/bin/env python3
"""
Stock Analyzer Main Script

This script orchestrates the stock analysis workflow:
1. Load watchlist
2. For each stock:
   - Check if fresh data is needed
   - Fetch data from SimplyWall.st API
   - Generate investment memos using Claude
"""

import os
import sys
import argparse
import logging
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv

from simplywall_api import SimplywallStAPI
from watchlist_parser import WatchlistParser
from file_manager import FileManager
from claude_integration import ClaudeIntegration


# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('stock_analyzer')


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="Stock Analyzer Workflow")
    
    parser.add_argument(
        "--api-token",
        help="SimplyWall.st API token (can also be set via SIMPLYWALL_API_TOKEN env var)",
        default=None
    )
    
    parser.add_argument(
        "--watchlist",
        help="Path to watchlist file (default: data/watchlist.txt)",
        default="data/watchlist.txt"
    )
    
    parser.add_argument(
        "--days-threshold",
        help="Days before refreshing stock data (default: 5)",
        type=int,
        default=5
    )
    
    parser.add_argument(
        "--claude-command",
        help="Command to invoke Claude (default: claude)",
        default="claude"
    )
    
    parser.add_argument(
        "--verbose",
        help="Enable verbose logging",
        action="store_true"
    )
    
    parser.add_argument(
        "--env-file",
        help="Path to .env file (default: .env)",
        default=".env"
    )
    
    return parser.parse_args()


def load_api_token(args):
    """Load API token from arguments, environment, or .env file
    
    Args:
        args: Command line arguments
        
    Returns:
        API token string
        
    Raises:
        ValueError: If API token cannot be found
    """
    # Check if API token is provided in command line arguments
    if args.api_token:
        return args.api_token
    
    # Load environment variables from .env file
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(project_root, args.env_file)
    
    if os.path.exists(env_path):
        load_dotenv(env_path)
        logger.debug(f"Loaded environment variables from {env_path}")
    
    # Check environment variable
    api_token = os.environ.get("SIMPLYWALL_API_TOKEN")
    if api_token:
        return api_token
    
    # No API token found
    raise ValueError(
        "SimplyWall.st API token not found. Please provide it via command line argument, "
        "environment variable SIMPLYWALL_API_TOKEN, or in .env file."
    )


def process_stock(
    ticker: str,
    api_client: SimplywallStAPI,
    file_manager: FileManager,
    claude: ClaudeIntegration,
    days_threshold: int
) -> bool:
    """Process a single stock
    
    Args:
        ticker: Stock ticker
        api_client: SimplyWall.st API client
        file_manager: File manager
        claude: Claude integration
        days_threshold: Days threshold for refreshing data
        
    Returns:
        True if processing was successful, False otherwise
    """
    try:
        logger.info(f"Processing stock: {ticker}")
        
        # Check if we need to fetch new data
        if file_manager.needs_update(ticker, days_threshold):
            logger.info(f"Fetching new data for {ticker}")
            
            # Get data from API
            stock_data = api_client.get_company_data(ticker)
            
            # Save data to file
            data_file = file_manager.save_stock_data(ticker, stock_data)
            logger.info(f"Saved stock data to {data_file}")
        else:
            # Use existing data
            data_file = file_manager.get_latest_data_file(ticker)
            logger.info(f"Using existing data from {data_file}")
            stock_data = file_manager.load_json_data(data_file)
        
        # Generate initial memo
        logger.info(f"Generating initial investment memo for {ticker}")
        initial_memo = claude.generate_initial_memo(stock_data)
        
        # Save initial memo
        initial_memo_file = file_manager.save_current_memo(ticker, initial_memo)
        logger.info(f"Saved initial memo to {initial_memo_file}")
        
        # Generate final memo
        logger.info(f"Generating final investment memo for {ticker}")
        final_memo = claude.generate_final_memo(stock_data, initial_memo)
        
        # Save final memo
        final_memo_file = file_manager.save_historical_memo(ticker, final_memo)
        logger.info(f"Saved final memo to {final_memo_file}")
        
        return True
    
    except Exception as e:
        logger.error(f"Error processing {ticker}: {str(e)}")
        return False


def main():
    """Main workflow"""
    # Parse command line arguments
    args = parse_args()
    
    # Set logging level
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    try:
        # Get API token
        api_token = load_api_token(args)
        
        # Get project root directory (assuming src/ is in project root)
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        # Resolve paths
        watchlist_path = os.path.join(project_root, args.watchlist)
        historical_json_dir = os.path.join(project_root, "data", "historical_json")
        current_memos_dir = os.path.join(project_root, "data", "current_memos")
        historical_memos_dir = os.path.join(project_root, "data", "historical_memos")
        prompt_dir = os.path.join(project_root, "prompts")
        
        logger.debug(f"Project root: {project_root}")
        logger.debug(f"Watchlist path: {watchlist_path}")
        logger.debug(f"Historical JSON dir: {historical_json_dir}")
        logger.debug(f"Current memos dir: {current_memos_dir}")
        logger.debug(f"Historical memos dir: {historical_memos_dir}")
        logger.debug(f"Prompt directory: {prompt_dir}")
        
        # Initialize components
        watchlist_parser = WatchlistParser(watchlist_path)
        api_client = SimplywallStAPI(api_token)
        file_manager = FileManager(
            historical_json_dir,
            current_memos_dir,
            historical_memos_dir
        )
        claude = ClaudeIntegration(prompt_dir, args.claude_command)
        
        # Parse watchlist
        tickers = watchlist_parser.parse()
        logger.info(f"Found {len(tickers)} stocks in watchlist")
        
        # Process each stock
        successful = 0
        for ticker in tickers:
            if process_stock(ticker, api_client, file_manager, claude, args.days_threshold):
                successful += 1
        
        # Print summary
        logger.info(f"Processed {successful} of {len(tickers)} stocks successfully")
        
        if successful < len(tickers):
            logger.warning(f"Failed to process {len(tickers) - successful} stocks. Check the logs for details.")
            return 1
        
        return 0
    
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return 1


if __name__ == "__main__":
    sys.exit(main())