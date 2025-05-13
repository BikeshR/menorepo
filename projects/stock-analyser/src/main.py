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
from dotenv import load_dotenv

from simplywall_api import SimplywallStAPI
from watchlist_parser import WatchlistParser
from file_manager import FileManager
from claude_integration import ClaudeIntegration


# Set up logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("stock_analyzer")


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="Stock Analyzer Workflow")

    parser.add_argument(
        "--api-token",
        help="SimplyWall.st API token (can also be set via SIMPLYWALL_API_TOKEN env var)",
        default=None,
    )

    parser.add_argument(
        "--watchlist",
        help="Path to watchlist YAML file (default: data/watchlist.yaml)",
        default="data/watchlist.yaml",
    )


    parser.add_argument(
        "--claude-command", help="Command to invoke Claude (default: claude)", default="claude"
    )

    parser.add_argument("--verbose", help="Enable verbose logging", action="store_true")

    parser.add_argument("--env-file", help="Path to .env file (default: .env)", default=".env")

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
    company_name: str,
    api_client: SimplywallStAPI,
    file_manager: FileManager,
    claude: ClaudeIntegration,
    current_index: int = 0,
    total_stocks: int = 0
) -> bool:
    """Process a single stock by fetching data and generating an investment memo

    The function follows these steps:
    1. Check if a memo already exists - if so, skip this stock
    2. Check if today's stock data exists - if so, use it
    3. Otherwise, fetch new data from SimplyWall.st API
    4. Generate investment memo using Claude
    5. Save the memo for future reference

    Args:
        ticker: Stock ticker symbol
        company_name: Company name from watchlist
        api_client: SimplyWall.st API client
        file_manager: File manager for data and memo files
        claude: Claude AI integration for memo generation
        current_index: Current stock index in the processing queue (for logging)
        total_stocks: Total number of stocks to process (for logging)

    Returns:
        True if processing was successful, False otherwise
    """
    try:
        # First check if there's already a memo file for this stock
        memo_file = file_manager.get_latest_final_memo(ticker)
        if memo_file:
            logger.info(f"Skipping {ticker} ({current_index}/{total_stocks}) - memo already exists at {memo_file}")
            return True

        # Check if there's already a stock data file with today's date
        today_file = file_manager.get_current_date_stock_data_file(ticker)

        if today_file:
            # Use existing data file from today
            logger.info(f"Using today's existing data file: {today_file}")
            stock_data = file_manager.load_json_data(today_file)
            json_file_path = today_file
        else:
            # Get data from API with company name for better matching
            logger.info(f"Fetching data for {ticker}")
            try:
                stock_data = api_client.get_company_data(ticker, company_name)

                # Verify we have valid stock data before proceeding
                if not stock_data:
                    logger.error(f"Received empty data for {ticker} - this ticker may not exist or be supported")
                    return False

                # Check if we only have minimal data for this stock
                if stock_data.get("is_minimal_data", False):
                    logger.warning(f"Only minimal data available for {ticker} - detailed analysis will be limited")

            except Exception as e:
                logger.error(f"Failed to retrieve data for {ticker}: {str(e)}")
                return False

            # Ensure required fields exist
            if "tickerSymbol" not in stock_data or not stock_data["tickerSymbol"]:
                logger.warning(f"Stock data for {ticker} is missing ticker symbol, using watchlist ticker")
                stock_data["tickerSymbol"] = ticker

            if "name" not in stock_data or not stock_data["name"]:
                logger.warning(f"Stock data for {ticker} is missing company name, using watchlist name")
                stock_data["name"] = company_name or ticker

            # Check if the API returned a different company name that was overridden
            if "originalName" in stock_data:
                logger.info(f"Company name from API '{stock_data['originalName']}' was replaced with '{stock_data['name']}' from watchlist")

            # Save data to file (and delete older files)
            json_file_path = file_manager.save_stock_data(ticker, stock_data)
            logger.info(f"Saved stock data to {json_file_path}")

        # Generate investment memo
        logger.info(f"Generating investment memo for {ticker} ({current_index}/{total_stocks})")
        memo = claude.generate_investment_memo(stock_data, company_name)

        # Save investment memo
        memo_file = file_manager.save_final_memo(ticker, memo)
        logger.info(f"Saved investment memo to {memo_file}")

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
        data_dir = os.path.join(project_root, "data")

        # Resolve paths
        watchlist_path = os.path.join(project_root, args.watchlist)
        sws_data_dir = os.path.join(data_dir, "sws_data")
        final_memos_dir = os.path.join(data_dir, "final_memos")
        portfolio_dir = os.path.join(data_dir, "portfolio")
        prompt_dir = os.path.join(project_root, "prompts")

        logger.debug(f"Project root: {project_root}")
        logger.debug(f"Data dir: {data_dir}")
        logger.debug(f"Watchlist path: {watchlist_path}")
        logger.debug(f"SimplyWall.st data dir: {sws_data_dir}")
        logger.debug(f"Final memos dir: {final_memos_dir}")
        logger.debug(f"Portfolio dir: {portfolio_dir}")
        logger.debug(f"Prompt directory: {prompt_dir}")

        # Initialize components
        watchlist_parser = WatchlistParser(watchlist_path)
        api_client = SimplywallStAPI(api_token)
        file_manager = FileManager(sws_data_dir, final_memos_dir, portfolio_dir, data_dir)
        claude = ClaudeIntegration(prompt_dir, args.claude_command)

        # Parse watchlist
        tickers = watchlist_parser.parse()
        total_tickers = len(tickers)
        logger.info(f"Found {total_tickers} stocks in watchlist")

        # Process each stock
        successful = 0

        for index, ticker in enumerate(tickers, 1):
            # Get company name if available
            company_name = watchlist_parser.get_company_name(ticker)

            # Add progress tracking to the context
            logger.info(f"Processing stock {index}/{total_tickers}: {ticker}")

            if process_stock(
                ticker,
                company_name,
                api_client,
                file_manager,
                claude,
                current_index=index,
                total_stocks=total_tickers
            ):
                successful += 1

        # Print summary of stock processing
        logger.info(f"Processed {successful} of {total_tickers} stocks successfully")

        # Generate portfolio allocation only if all stocks were processed successfully
        if successful == total_tickers:
            try:
                logger.info("Starting portfolio allocation generation")

                # Get all the final memos for the stocks in the watchlist
                memos_data = file_manager.get_all_latest_memos(tickers)
                memo_count = len(memos_data)

                if memo_count > 0:
                    # Read portfolio data from CSV
                    portfolio_data = file_manager.read_portfolio_csv()
                    if portfolio_data:
                        logger.info(f"Found current portfolio data with {len(portfolio_data)} holdings")
                    else:
                        logger.warning("No portfolio CSV file found - will generate allocation without current holdings")

                    # Generate portfolio allocation with memos and portfolio data
                    logger.info(f"Generating portfolio allocation from {memo_count} investment memos")
                    portfolio_allocation = claude.generate_portfolio_allocation(memos_data, portfolio_data)

                    # Save portfolio allocation
                    portfolio_file = file_manager.save_portfolio_allocation(portfolio_allocation)
                    logger.info(f"Saved portfolio allocation to {portfolio_file}")
                else:
                    logger.warning("No memos found for portfolio allocation - unable to proceed")

            except Exception as e:
                logger.error(f"Error generating portfolio allocation: {str(e)}")
                # Continue even if portfolio allocation fails

        if successful < total_tickers:
            logger.warning(
                f"Failed to process {total_tickers - successful} stocks. Check the logs for details."
            )
            return 1

        return 0

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return 1


if __name__ == "__main__":
    sys.exit(main())