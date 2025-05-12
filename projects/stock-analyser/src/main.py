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
        "--json-days-threshold",
        help="Days before refreshing stock data (default: 5)",
        type=int,
        default=5,
    )

    parser.add_argument(
        "--memo-days-threshold",
        help="Days before refreshing investment memo (default: 5)",
        type=int,
        default=5,
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
    json_days_threshold: int,
    memo_days_threshold: int,
) -> bool:
    """Process a single stock

    Args:
        ticker: Stock ticker
        company_name: Company name from watchlist
        api_client: SimplyWall.st API client
        file_manager: File manager
        claude: Claude integration
        json_days_threshold: Days threshold for refreshing JSON data
        memo_days_threshold: Days threshold for refreshing investment memo

    Returns:
        True if processing was successful, False otherwise
    """
    try:
        logger.info(f"Processing stock: {ticker} ({company_name})")

        # Track if any updates were made
        update_json = False

        # Check if we need to fetch new JSON data
        needs_json_update, json_file_path = file_manager.needs_json_update(
            ticker, json_days_threshold
        )

        if needs_json_update:
            logger.info(f"Fetching new data for {ticker}")

            # Get data from API with company name for better matching
            stock_data = api_client.get_company_data(ticker, company_name)

            # Verify we have valid stock data before proceeding
            if not stock_data:
                logger.error(f"Received empty or invalid data for {ticker}")
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

            # Save data to file
            json_file_path = file_manager.save_stock_data(ticker, stock_data)
            logger.info(f"Saved stock data to {json_file_path}")
            update_json = True
        else:
            # Use existing data
            logger.info(f"Using existing data from {json_file_path}")
            stock_data = file_manager.load_json_data(json_file_path)

            # Validate company name in existing data
            if company_name and stock_data.get("name"):
                fetched_name = stock_data.get("name", "").lower()
                watch_name = company_name.lower()

                # Check for significant mismatch
                if watch_name != fetched_name and watch_name not in fetched_name and fetched_name not in watch_name:
                    logger.warning(f"Company name mismatch in existing data: Watchlist has '{company_name}' but data has '{stock_data.get('name')}'")
                    logger.warning(f"Overriding with watchlist name for {ticker}")

                    # Keep original name for reference
                    stock_data["originalName"] = stock_data["name"]
                    stock_data["name"] = company_name

                    # Save updated data
                    json_file_path = file_manager.save_stock_data(ticker, stock_data)
                    logger.info(f"Saved updated stock data to {json_file_path}")
                    update_json = True

        # Check if we need a new final memo (no recent one exists)
        needs_memo_update, memo_path = file_manager.needs_final_memo_update(
            ticker, memo_days_threshold
        )

        # Generate investment memo if stock data was updated or if memo is older than threshold
        if update_json or needs_memo_update:
            logger.info(f"Generating investment memo for {ticker}")
            # Generate investment memo
            memo = claude.generate_investment_memo(stock_data, "", company_name)

            # Save investment memo
            memo_file = file_manager.save_final_memo(ticker, memo)
            logger.info(f"Saved investment memo to {memo_file}")
        else:
            logger.info(f"Skipping memo generation for {ticker} - no updates needed")

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
        sws_data_dir = os.path.join(project_root, "data", "sws_data")
        final_memos_dir = os.path.join(project_root, "data", "final_memos")
        prompt_dir = os.path.join(project_root, "prompts")

        logger.debug(f"Project root: {project_root}")
        logger.debug(f"Watchlist path: {watchlist_path}")
        logger.debug(f"SimplyWall.st data dir: {sws_data_dir}")
        logger.debug(f"Final memos dir: {final_memos_dir}")
        logger.debug(f"Prompt directory: {prompt_dir}")

        # Initialize components
        watchlist_parser = WatchlistParser(watchlist_path)
        api_client = SimplywallStAPI(api_token)
        file_manager = FileManager(sws_data_dir, final_memos_dir)
        claude = ClaudeIntegration(prompt_dir, args.claude_command)

        # Parse watchlist
        tickers = watchlist_parser.parse()
        logger.info(f"Found {len(tickers)} stocks in watchlist")

        # Process each stock
        successful = 0
        for ticker in tickers:
            # Get company name if available
            company_name = watchlist_parser.get_company_name(ticker)
            
            if process_stock(
                ticker,
                company_name,
                api_client,
                file_manager,
                claude,
                args.json_days_threshold,
                args.memo_days_threshold,
            ):
                successful += 1

        # Print summary
        logger.info(f"Processed {successful} of {len(tickers)} stocks successfully")

        if successful < len(tickers):
            logger.warning(
                f"Failed to process {len(tickers) - successful} stocks. Check the logs for details."
            )
            return 1

        return 0

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return 1


if __name__ == "__main__":
    sys.exit(main())