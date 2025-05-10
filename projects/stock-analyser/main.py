#!/usr/bin/env python3

import os
import sys
import time
import json
import subprocess
import argparse
import concurrent.futures
import logging
import requests
import datetime
from pathlib import Path
import pandas as pd
from ratelimit import limits, sleep_and_retry

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("stock_analysis.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# SimplyWall.st API Configuration
API_ENDPOINT = "https://api.simplywall.st/graphql"
API_TOKEN = os.environ.get("SIMPLYWALL_API_TOKEN")
# Default rate limits: 60 requests per minute (adjust based on your API tier)
RATE_LIMIT_CALLS = 60
RATE_LIMIT_PERIOD = 60  # in seconds

# Claude API Configuration
CLAUDE_MAX_MESSAGES_PER_SESSION = 200  # Conservative estimate for 5x tier
SESSION_DURATION_HOURS = 5
SESSION_TRACKING_FILE = "claude_sessions.json"

# Map of common exchanges for US tickers
EXCHANGE_MAP = {
    "default": "NasdaqGS",  # Default to Nasdaq Global Select
    "NYSE": "NYSE",
    "NASDAQ": "NasdaqGS",
    "AMEX": "AMEX",
}

def setup_directories(csv_dir, output_dir):
    """Create necessary directories if they don't exist."""
    Path(csv_dir).mkdir(exist_ok=True)
    Path(output_dir).mkdir(exist_ok=True)

def load_session_tracking():
    """Load session tracking information from file."""
    if os.path.exists(SESSION_TRACKING_FILE):
        try:
            with open(SESSION_TRACKING_FILE, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            logger.warning(f"Error reading session tracking file. Creating new tracking data.")

    # Default structure if file doesn't exist or is corrupted
    return {
        "current_session": {
            "start_time": None,
            "message_count": 0
        },
        "sessions_this_month": 0,
        "last_month_reset": datetime.datetime.now().strftime("%Y-%m-01"),
        "total_messages": 0
    }

def save_session_tracking(tracking_data):
    """Save session tracking information to file."""
    with open(SESSION_TRACKING_FILE, 'w') as f:
        json.dump(tracking_data, f, indent=2, default=str)

def update_session_tracking(message_count=1):
    """Update session tracking with new messages."""
    tracking_data = load_session_tracking()

    # Check if we need to reset monthly counters
    current_month_start = datetime.datetime.now().strftime("%Y-%m-01")
    if tracking_data["last_month_reset"] != current_month_start:
        tracking_data["last_month_reset"] = current_month_start
        tracking_data["sessions_this_month"] = 0

    # Check if we need to start a new session
    now = datetime.datetime.now()
    if tracking_data["current_session"]["start_time"] is None:
        # First session ever
        tracking_data["current_session"]["start_time"] = now.isoformat()
        tracking_data["current_session"]["message_count"] = message_count
        tracking_data["sessions_this_month"] += 1
    else:
        # Convert stored time string back to datetime
        start_time = datetime.datetime.fromisoformat(tracking_data["current_session"]["start_time"])
        session_age = now - start_time

        if session_age > datetime.timedelta(hours=SESSION_DURATION_HOURS):
            # Start a new session if the previous one expired
            tracking_data["current_session"]["start_time"] = now.isoformat()
            tracking_data["current_session"]["message_count"] = message_count
            tracking_data["sessions_this_month"] += 1
        else:
            # Add to existing session
            tracking_data["current_session"]["message_count"] += message_count

    tracking_data["total_messages"] += message_count

    # Save updated tracking data
    save_session_tracking(tracking_data)
    return tracking_data

def check_session_limits():
    """Check if we're approaching session limits and return warnings if needed."""
    tracking_data = load_session_tracking()
    warnings = []

    # Check monthly session limit
    if tracking_data["sessions_this_month"] >= 45:  # Warning at 90% of 50 session limit
        warnings.append(f"WARNING: You have used {tracking_data['sessions_this_month']}/50 sessions this month!")

    # Check current session message count
    if tracking_data["current_session"]["message_count"] >= CLAUDE_MAX_MESSAGES_PER_SESSION * 0.8:
        warnings.append(f"WARNING: Current session has used {tracking_data['current_session']['message_count']}/{CLAUDE_MAX_MESSAGES_PER_SESSION} messages!")

    return warnings, tracking_data

@sleep_and_retry
@limits(calls=RATE_LIMIT_CALLS, period=RATE_LIMIT_PERIOD)
def execute_graphql_query(query, variables=None):
    """Execute a GraphQL query against the SimplyWall.st API with rate limiting."""
    if API_TOKEN is None:
        raise ValueError("SIMPLYWALL_API_TOKEN environment variable not set")

    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "query": query,
        "variables": variables or {}
    }

    try:
        response = requests.post(API_ENDPOINT, json=payload, headers=headers)

        # Handle rate limiting
        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 60))
            logger.warning(f"Rate limit exceeded. Waiting {retry_after} seconds...")
            time.sleep(retry_after)
            return execute_graphql_query(query, variables)

        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed: {str(e)}")
        raise

def get_exchanges():
    """Get a list of available exchanges from SimplyWall.st API."""
    query = """
    query {
      exchanges {
        symbol
        companiesCount
      }
    }
    """

    result = execute_graphql_query(query)
    exchanges = {}

    if result and "data" in result and "exchanges" in result["data"]:
        for exchange in result["data"]["exchanges"]:
            exchanges[exchange["symbol"]] = exchange["companiesCount"]

    return exchanges

def find_company_id(ticker):
    """Find a company's ID by searching for its ticker symbol."""
    query = """
    query searchCompanies($query: String!) {
      searchCompanies(query: $query) {
        id
        name
        exchangeSymbol
        tickerSymbol
      }
    }
    """

    variables = {
        "query": ticker
    }

    result = execute_graphql_query(query, variables)

    if result and "data" in result and "searchCompanies" in result["data"]:
        companies = result["data"]["searchCompanies"]

        # Try to find an exact match first
        for company in companies:
            if company["tickerSymbol"].upper() == ticker.upper():
                return company["id"], company["exchangeSymbol"]

        # If no exact match, return the first result
        if companies:
            return companies[0]["id"], companies[0]["exchangeSymbol"]

    return None, None

def get_company_by_ticker_and_exchange(ticker, exchange):
    """Get company data by ticker symbol and exchange."""
    query = """
    query companyByExchangeAndTickerSymbol($exchange: String!, $symbol: String!) {
      companyByExchangeAndTickerSymbol(exchange: $exchange, tickerSymbol: $symbol) {
        id
        name
        exchangeSymbol
        tickerSymbol
        marketCapUSD
        # Add fields for financial metrics
        primaryIndustry {
          name
        }
        market {
          name
          iso2
        }
        # Get statements which contain financial insights
        statements {
          name
          title
          area
          type
          value
          outcome
          description
          state
          severity
          outcomeName
        }
        # Get ownership information
        owners {
          name
          type
          sharesHeld
          percentOfSharesOutstanding
          holdingDate
        }
        # Get insider transactions
        insiderTransactions {
          type
          ownerName
          ownerType
          shares
          transactionValue
          tradeDateMin
          isManagementInsider
        }
        # Get management team
        members {
          name
          title
          age
          tenure
          compensation
        }
      }
    }
    """

    variables = {
        "exchange": exchange,
        "symbol": ticker
    }

    try:
        result = execute_graphql_query(query, variables)

        if result and "data" in result and "companyByExchangeAndTickerSymbol" in result["data"]:
            return result["data"]["companyByExchangeAndTickerSymbol"]

        logger.warning(f"No data found for {ticker} on {exchange}")
        return None
    except Exception as e:
        logger.error(f"Error fetching data for {ticker} on {exchange}: {str(e)}")
        return None

def get_company_detail_by_id(company_id):
    """Get detailed company data by ID."""
    query = """
    query Company($id: ID!) {
      company(id: $id) {
        id
        name
        exchangeSymbol
        tickerSymbol
        marketCapUSD
        # Add all the detailed metrics we need
        primaryIndustry {
          name
        }
        secondaryIndustry {
          name
        }
        tertiaryIndustry {
          name
        }
        market {
          name
          iso2
        }
        statements {
          name
          title
          area
          type
          value
          outcome
          description
          severity
        }
        owners {
          name
          type
          sharesHeld
          percentOfSharesOutstanding
        }
        insiderTransactions {
          type
          ownerName
          shares
          transactionValue
        }
        members {
          name
          title
          age
          tenure
          compensation
        }
      }
    }
    """

    variables = {
        "id": company_id
    }

    try:
        result = execute_graphql_query(query, variables)

        if result and "data" in result and "company" in result["data"]:
            return result["data"]["company"]

        logger.warning(f"No data found for company ID {company_id}")
        return None
    except Exception as e:
        logger.error(f"Error fetching data for company ID {company_id}: {str(e)}")
        return None

def process_company_data(company_data):
    """Process company data into a flat structure for CSV."""
    if not company_data:
        return {}

    # Initialize an empty dictionary for our flattened data
    flat_data = {}

    # Process basic company info
    flat_data["company_id"] = company_data.get("id", "")
    flat_data["company_name"] = company_data.get("name", "")
    flat_data["exchange_symbol"] = company_data.get("exchangeSymbol", "")
    flat_data["ticker_symbol"] = company_data.get("tickerSymbol", "")
    flat_data["market_cap_usd"] = company_data.get("marketCapUSD", 0)

    # Process industry data
    if "primaryIndustry" in company_data and company_data["primaryIndustry"]:
        flat_data["primary_industry"] = company_data["primaryIndustry"].get("name", "")

    if "secondaryIndustry" in company_data and company_data["secondaryIndustry"]:
        flat_data["secondary_industry"] = company_data["secondaryIndustry"].get("name", "")

    if "tertiaryIndustry" in company_data and company_data["tertiaryIndustry"]:
        flat_data["tertiary_industry"] = company_data["tertiaryIndustry"].get("name", "")

    # Process market data
    if "market" in company_data and company_data["market"]:
        flat_data["market_name"] = company_data["market"].get("name", "")
        flat_data["market_country_iso2"] = company_data["market"].get("iso2", "")

    # Process statements (financial insights)
    if "statements" in company_data and company_data["statements"]:
        # Group statements by area (VALUE, FUTURE, HEALTH, etc.)
        statements_by_area = {}

        for statement in company_data["statements"]:
            area = statement.get("area", "UNKNOWN")

            if area not in statements_by_area:
                statements_by_area[area] = []

            statements_by_area[area].append(statement)

        # Process each statement area
        for area, statements in statements_by_area.items():
            area_lower = area.lower()

            for i, statement in enumerate(statements):
                name = statement.get("name", f"unknown_{i}")
                value = statement.get("value", None)
                outcome = statement.get("outcome", 0)

                # Create keys like "value_pe_ratio", "health_debt_to_equity", etc.
                flat_key = f"{area_lower}_{name}"
                flat_data[flat_key] = value if value is not None else outcome

                # Also add description if available
                if "description" in statement and statement["description"]:
                    flat_data[f"{flat_key}_description"] = statement["description"]

    # Process ownership data
    if "owners" in company_data and company_data["owners"]:
        for i, owner in enumerate(company_data["owners"][:10]):  # Limit to top 10 owners
            prefix = f"owner_{i+1}"
            flat_data[f"{prefix}_name"] = owner.get("name", "")
            flat_data[f"{prefix}_type"] = owner.get("type", "")
            flat_data[f"{prefix}_shares_held"] = owner.get("sharesHeld", 0)
            flat_data[f"{prefix}_percent"] = owner.get("percentOfSharesOutstanding", 0)

    # Process insider transactions
    if "insiderTransactions" in company_data and company_data["insiderTransactions"]:
        buy_count = 0
        sell_count = 0
        buy_value = 0
        sell_value = 0

        for transaction in company_data["insiderTransactions"]:
            if transaction.get("type") == "BUY":
                buy_count += 1
                buy_value += transaction.get("transactionValue", 0)
            elif transaction.get("type") == "SELL":
                sell_count += 1
                sell_value += transaction.get("transactionValue", 0)

        flat_data["insider_buy_count"] = buy_count
        flat_data["insider_sell_count"] = sell_count
        flat_data["insider_buy_value"] = buy_value
        flat_data["insider_sell_value"] = sell_value
        flat_data["insider_net_transactions"] = buy_count - sell_count
        flat_data["insider_net_value"] = buy_value - sell_value

    # Process management team
    if "members" in company_data and company_data["members"]:
        flat_data["management_count"] = len(company_data["members"])

        # Add CEO info if available
        for member in company_data["members"]:
            title = member.get("title", "").upper()
            if "CEO" in title or "CHIEF EXECUTIVE" in title:
                flat_data["ceo_name"] = member.get("name", "")
                flat_data["ceo_age"] = member.get("age", 0)
                flat_data["ceo_tenure"] = member.get("tenure", 0)
                flat_data["ceo_compensation"] = member.get("compensation", 0)
                break

    return flat_data

def fetch_stock_data(ticker, csv_dir):
    """Fetch stock data from SimplyWall.st API and save as CSV."""
    csv_path = os.path.join(csv_dir, f"{ticker}.csv")

    # Check if we already have recent data (less than 24 hours old)
    if os.path.exists(csv_path):
        file_age = time.time() - os.path.getmtime(csv_path)
        if file_age < 86400:  # 24 hours in seconds
            logger.info(f"Using cached data for {ticker} (less than 24 hours old)")
            return csv_path

    logger.info(f"Fetching data for {ticker} from SimplyWall.st API")

    try:
        # First, search for the company to get its ID
        company_id, exchange = find_company_id(ticker)

        if not company_id:
            logger.warning(f"Could not find company ID for {ticker}. Trying exchanges...")

            # Try different exchanges if available
            for exchange_name in ["NasdaqGS", "NYSE", "AMEX", "TSX", "LSE"]:
                logger.info(f"Trying {ticker} on {exchange_name}...")
                company_data = get_company_by_ticker_and_exchange(ticker, exchange_name)

                if company_data:
                    logger.info(f"Found {ticker} on {exchange_name}")
                    break
            else:
                logger.error(f"Could not find {ticker} on any exchange")
                return None
        else:
            # If we found the company ID, get detailed data
            logger.info(f"Found company ID {company_id} for {ticker} on {exchange}")
            company_data = get_company_detail_by_id(company_id)

        if not company_data:
            logger.error(f"Could not fetch data for {ticker}")
            return None

        # Process the company data
        flat_data = process_company_data(company_data)

        # Convert to DataFrame and save as CSV
        df = pd.DataFrame([flat_data]).transpose()
        df.to_csv(csv_path, header=False)

        logger.info(f"Successfully saved data for {ticker} to {csv_path}")
        return csv_path
    except Exception as e:
        logger.error(f"Failed to fetch data for {ticker}: {str(e)}")
        return None

def rate_limited_claude_command(command, args, output_path=None):
    """Execute a Claude command with rate limiting and session tracking."""
    # Check for session limits
    warnings, tracking_data = check_session_limits()
    for warning in warnings:
        logger.warning(warning)

    # If we're approaching message limits, slow down
    if tracking_data["current_session"]["message_count"] > CLAUDE_MAX_MESSAGES_PER_SESSION * 0.8:
        logger.warning(f"Approaching session message limit, adding delay between requests")
        time.sleep(5)  # Add extra delay to avoid hitting limits too quickly

    # Run Claude command
    cmd_args = [command] + args
    if output_path:
        cmd_args += ["--output", output_path]

    result = subprocess.run(cmd_args, capture_output=True, text=True)

    # Update session tracking
    update_session_tracking(1)  # Count as 1 message

    return result

def generate_initial_analysis(ticker, template_path, output_path):
    """Generate initial stock analysis using Claude with web search."""
    try:
        with open(template_path, 'r') as f:
            template = f.read()

        prompt = f"""Generate a comprehensive stock analysis for {ticker}.
Use web search to get the latest information including financial data, recent news,
analyst ratings, and market trends. Follow the structure of this template:
{template}"""

        result = rate_limited_claude_command("claude", [prompt], output_path)

        if not os.path.exists(output_path):
            logger.error(f"Failed to generate initial analysis for {ticker}. No output file created.")
            return False

        return True
    except Exception as e:
        logger.error(f"Error generating initial analysis for {ticker}: {str(e)}")
        return False

def update_with_csv_data(ticker, initial_path, csv_path, final_path):
    """Update stock analysis with private CSV data."""
    try:
        with open(initial_path, 'r') as f:
            initial_analysis = f.read()

        with open(csv_path, 'r') as f:
            csv_data = f.read()

        prompt = f"""I have a stock analysis for {ticker} and private financial data in CSV format.
First, read and analyze this CSV data to extract key insights that aren't publicly available.
Then, update the stock analysis to incorporate these insights.

Original analysis:
{initial_analysis}

Private CSV data:
{csv_data}"""

        result = rate_limited_claude_command("claude", [prompt], final_path)

        if not os.path.exists(final_path):
            logger.error(f"Failed to update analysis with CSV data for {ticker}. No output file created.")
            return False

        return True
    except Exception as e:
        logger.error(f"Error updating analysis with CSV data for {ticker}: {str(e)}")
        return False

def process_stock_batch(batch, template_path, csv_dir, output_dir, progress_file, fetch_data=True):
    """Process a batch of stocks sequentially to minimize session usage."""
    results = {}

    for ticker in batch:
        # Check if this ticker has already been processed
        if os.path.exists(progress_file):
            with open(progress_file, 'r') as f:
                completed = set(line.strip() for line in f)
                if ticker in completed:
                    logger.info(f"Skipping {ticker} - already completed")
                    results[ticker] = True
                    continue

        logger.info(f"Processing {ticker}...")
        initial_path = os.path.join(output_dir, f"{ticker}_initial.md")
        final_path = os.path.join(output_dir, f"{ticker}_final.md")

        # Step 1: Fetch data from API if requested
        csv_path = None
        if fetch_data:
            csv_path = fetch_stock_data(ticker, csv_dir)
        else:
            csv_path = os.path.join(csv_dir, f"{ticker}.csv")
            if not os.path.exists(csv_path):
                logger.warning(f"No CSV file found for {ticker} at {csv_path}")
                csv_path = None

        # Check session limits before Claude API calls
        warnings, tracking_data = check_session_limits()
        for warning in warnings:
            logger.warning(warning)

        # If we're very close to limit, break batch processing
        if tracking_data["current_session"]["message_count"] >= CLAUDE_MAX_MESSAGES_PER_SESSION * 0.9:
            logger.warning(f"Session message limit almost reached ({tracking_data['current_session']['message_count']}). Ending batch processing.")
            results[ticker] = False
            break

        # Step 2: Generate initial analysis
        logger.info(f"Generating initial analysis for {ticker}")
        if not generate_initial_analysis(ticker, template_path, initial_path):
            results[ticker] = False
            continue

        # Step 3: Update with CSV data if available
        if csv_path and os.path.exists(csv_path):
            logger.info(f"Updating analysis with CSV data for {ticker}")
            success = update_with_csv_data(ticker, initial_path, csv_path, final_path)
        else:
            logger.warning(f"No CSV data available for {ticker}. Using initial analysis only.")
            os.rename(initial_path, final_path)
            success = True

        # Cleanup
        if os.path.exists(initial_path) and os.path.exists(final_path):
            os.remove(initial_path)

        # Update progress file
        if success:
            with open(progress_file, 'a') as f:
                f.write(f"{ticker}\n")
            results[ticker] = True
        else:
            results[ticker] = False

    return results

def estimate_resource_usage(tickers, session_stats=True, fetch_data=True):
    """Estimate resource usage for processing the watchlist."""
    num_tickers = len(tickers)

    # Estimate API calls
    estimated_simplywall_api_calls = num_tickers * 2 if fetch_data else 0

    # Estimate Claude messages
    estimated_claude_messages = num_tickers * 2  # Initial analysis + update with CSV

    # Estimate sessions needed (with 90% capacity utilization)
    max_tickers_per_session = int(CLAUDE_MAX_MESSAGES_PER_SESSION * 0.9 / 2)
    estimated_sessions = (num_tickers + max_tickers_per_session - 1) // max_tickers_per_session

    # Get current session stats if requested
    current_session_stats = None
    if session_stats:
        _, tracking_data = check_session_limits()
        current_session_stats = tracking_data

    return {
        "num_tickers": num_tickers,
        "estimated_simplywall_api_calls": estimated_simplywall_api_calls,
        "estimated_claude_messages": estimated_claude_messages,
        "max_tickers_per_session": max_tickers_per_session,
        "estimated_sessions": estimated_sessions,
        "current_session_stats": current_session_stats
    }

def main():
    parser = argparse.ArgumentParser(description="Stock Analysis Automation Script")
    parser.add_argument("--watchlist", default="watchlist.txt", help="File containing stock tickers")
    parser.add_argument("--csv-dir", default="./stock_data", help="Directory containing CSV files")
    parser.add_argument("--output-dir", default="./analyses", help="Directory for output markdown files")
    parser.add_argument("--template", default="./template.md", help="Template file for analysis")
    parser.add_argument("--batch-size", type=int, default=0, help="Process stocks in batches of this size (0 = auto)")
    parser.add_argument("--skip-data-fetch", action="store_true", help="Skip fetching data from API")
    parser.add_argument("--refresh-cache", action="store_true", help="Force refresh of cached CSV data")
    parser.add_argument("--test-api", action="store_true", help="Test API connection and exit")
    parser.add_argument("--dry-run", action="store_true", help="Estimate resource usage without processing")
    parser.add_argument("--session-limit", type=int, default=CLAUDE_MAX_MESSAGES_PER_SESSION,
                      help=f"Maximum Claude messages per session (default: {CLAUDE_MAX_MESSAGES_PER_SESSION})")
    args = parser.parse_args()

    # Update session limit from args
    global CLAUDE_MAX_MESSAGES_PER_SESSION
    CLAUDE_MAX_MESSAGES_PER_SESSION = args.session_limit

    # Check for API token
    if not args.skip_data_fetch and not API_TOKEN:
        logger.error("SIMPLYWALL_API_TOKEN environment variable not set. Set it or use --skip-data-fetch")
        return 1

    # Test API connection if requested
    if args.test_api:
        try:
            exchanges = get_exchanges()
            logger.info(f"API connection successful. Found {len(exchanges)} exchanges.")
            for exchange, count in list(exchanges.items())[:5]:  # Show top 5
                logger.info(f"  {exchange}: {count} companies")
            return 0
        except Exception as e:
            logger.error(f"API connection failed: {str(e)}")
            return 1

    # Setup directories
    setup_directories(args.csv_dir, args.output_dir)

    # Read watchlist
    try:
        with open(args.watchlist, 'r') as f:
            tickers = [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        logger.error(f"Watchlist file not found: {args.watchlist}")
        return 1

    logger.info(f"Found {len(tickers)} tickers in watchlist")

    # If dry run, just estimate resource usage and exit
    if args.dry_run:
        usage = estimate_resource_usage(tickers, True, not args.skip_data_fetch)
        logger.info("Estimated resource usage:")
        logger.info(f"  Number of tickers: {usage['num_tickers']}")
        logger.info(f"  SimplyWall.st API calls: {usage['estimated_simplywall_api_calls']}")
        logger.info(f"  Claude messages: {usage['estimated_claude_messages']}")
        logger.info(f"  Max tickers per session: {usage['max_tickers_per_session']}")
        logger.info(f"  Estimated sessions needed: {usage['estimated_sessions']}")

        if usage['current_session_stats']:
            logger.info("Current session stats:")
            logger.info(f"  Sessions used this month: {usage['current_session_stats']['sessions_this_month']}/50")
            logger.info(f"  Current session messages: {usage['current_session_stats']['current_session']['message_count']}")

            # Calculate remaining capacity
            remaining_msgs = CLAUDE_MAX_MESSAGES_PER_SESSION - usage['current_session_stats']['current_session']['message_count']
            remaining_tickers = remaining_msgs // 2  # Each ticker needs about 2 messages
            logger.info(f"  Remaining capacity in current session: ~{remaining_tickers} tickers")

        return 0

    # If refresh_cache, delete existing CSV files
    if args.refresh_cache:
        logger.info("Refreshing cached data...")
        for ticker in tickers:
            csv_path = os.path.join(args.csv_dir, f"{ticker}.csv")
            if os.path.exists(csv_path):
                os.remove(csv_path)

    # Progress tracking file
    progress_file = os.path.join(args.output_dir, ".progress")

    # Calculate batch size if not specified
    if args.batch_size <= 0:
        # Automatic batch sizing based on Claude limits
        # Each ticker uses approximately 2 Claude messages
        max_msgs_per_session = CLAUDE_MAX_MESSAGES_PER_SESSION * 0.9  # 90% of limit for safety
        batch_size = int(max_msgs_per_session // 2)
        logger.info(f"Auto batch size: {batch_size} tickers per session")
    else:
        batch_size = args.batch_size
        logger.info(f"Using specified batch size: {batch_size} tickers per batch")

    # First, fetch all data in parallel if needed
    if not args.skip_data_fetch:
        logger.info("Fetching data for all stocks...")

        # Process in smaller chunks to avoid overwhelming the API
        fetch_chunk_size = 10
        for i in range(0, len(tickers), fetch_chunk_size):
            chunk = tickers[i:i+fetch_chunk_size]
            logger.info(f"Fetching data for tickers {i+1}-{i+len(chunk)} of {len(tickers)}")

            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                futures = {
                    executor.submit(fetch_stock_data, ticker, args.csv_dir): ticker
                    for ticker in chunk
                }

                for future in concurrent.futures.as_completed(futures):
                    ticker = futures[future]
                    try:
                        result = future.result()
                        if result:
                            logger.info(f"✅ Data fetched for {ticker}")
                        else:
                            logger.warning(f"⚠️ Could not fetch data for {ticker}")
                    except Exception as e:
                        logger.error(f"❌ Exception while fetching data for {ticker}: {str(e)}")

    # Process stocks in batches
    succeeded = 0
    failed = 0
    skipped = 0

    # Check if we have existing progress
    completed_tickers = set()
    if os.path.exists(progress_file):
        with open(progress_file, 'r') as f:
            completed_tickers = set(line.strip() for line in f)
        logger.info(f"Found {len(completed_tickers)} already completed tickers")

    # Filter out completed tickers
    remaining_tickers = [t for t in tickers if t not in completed_tickers]

    if not remaining_tickers:
        logger.info("All tickers have already been processed. Use --refresh-cache to start over.")
        return 0

    # Process in batches
    for i in range(0, len(remaining_tickers), batch_size):
        # Check session limits before starting a new batch
        warnings, tracking_data = check_session_limits()
        for warning in warnings:
            logger.warning(warning)

        # If we're close to monthly session limit, warn and continue with caution
        if tracking_data["sessions_this_month"] >= 45:
            logger.warning(f"WARNING: You're approaching the monthly limit of 50 sessions ({tracking_data['sessions_this_month']}/50)!")
            user_input = input("Continue with processing? (y/n): ")
            if user_input.lower() != 'y':
                logger.info("Aborting processing.")
                break

        batch = remaining_tickers[i:i+batch_size]
        logger.info(f"Processing batch {i//batch_size + 1} of {(len(remaining_tickers) + batch_size - 1) // batch_size}: {len(batch)} tickers")

        results = process_stock_batch(batch, args.template, args.csv_dir, args.output_dir,
                                     progress_file, not args.skip_data_fetch)

        for ticker, success in results.items():
            if success:
                succeeded += 1
                logger.info(f"✅ Completed analysis for {ticker}")
            else:
                failed += 1
                logger.error(f"❌ Failed to process {ticker}")

        # Get session stats after batch
        _, tracking_data = check_session_limits()
        logger.info(f"Session status: {tracking_data['current_session']['message_count']} messages used, {tracking_data['sessions_this_month']}/50 sessions this month")

        # If we're approaching the session message limit, wait for session to expire
        if tracking_data["current_session"]["message_count"] >= CLAUDE_MAX_MESSAGES_PER_SESSION * 0.9:
            # Check when the current session started
            start_time = datetime.datetime.fromisoformat(tracking_data["current_session"]["start_time"])
            now = datetime.datetime.now()
            session_age = now - start_time
            time_to_new_session = datetime.timedelta(hours=SESSION_DURATION_HOURS) - session_age

            if time_to_new_session.total_seconds() > 0 and i + batch_size < len(remaining_tickers):
                minutes = int(time_to_new_session.total_seconds() / 60)
                logger.info(f"Approaching session message limit. Waiting {minutes} minutes for a new session to start...")

                # Ask user if they want to wait or stop
                user_input = input(f"Wait {minutes} minutes for a new session or stop now? (wait/stop): ")
                if user_input.lower() == 'wait':
                    logger.info(f"Waiting {minutes} minutes...")
                    # Wait until the session expires
                    time.sleep(time_to_new_session.total_seconds())
                    logger.info("Continuing with a new session")
                else:
                    logger.info("Stopping batch processing at user request")
                    break

    skipped = len(completed_tickers)
    logger.info(f"Stock analysis complete: {succeeded} succeeded, {failed} failed, {skipped} skipped")
    logger.info(f"Final analyses are available in {args.output_dir}")

    # Final session stats
    _, tracking_data = check_session_limits()
    logger.info(f"Final session status: {tracking_data['current_session']['message_count']} messages in current session")
    logger.info(f"Sessions used this month: {tracking_data['sessions_this_month']}/50")

    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
