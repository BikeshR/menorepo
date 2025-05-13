"""
Claude Integration

This module handles integration with Claude API for
generating investment memos from stock data.

It provides functionality to:
1. Process prompt templates with dynamic placeholders
2. Execute Claude CLI commands with proper input handling
3. Parse and process Claude's output including JSON results
4. Extract only the investment memo content from responses
5. Handle errors and provide detailed error messages

The module uses prompt templates that contain placeholders like {{TICKER}},
{{COMPANY}}, {{DATE}}, and {{STOCK_JSON_DATA}} which are dynamically
replaced with actual data before sending to Claude.
"""

import os
import json
import subprocess
import tempfile
import logging
import datetime
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger("stock_analyzer")


class ClaudeIntegration:
    """Interface for generating investment memos using Claude

    This class handles:
    1. Preparing prompts from templates with dynamic content substitution
    2. Executing Claude CLI commands with proper error handling
    3. Parsing JSON responses and extracting relevant content
    4. Processing investment memo content for consistency

    The class uses prompt templates with placeholders (e.g., {{TICKER}}, {{COMPANY}})
    that are replaced with actual values before sending to Claude. The returned
    investment memos are processed to ensure they start with the "# Investment Memorandum"
    heading for consistent formatting.
    """

    def __init__(self, prompt_dir: str, claude_command: Optional[str] = None):
        """Initialize with paths to prompt files

        Args:
            prompt_dir: Directory containing prompt templates
            claude_command: Command to invoke Claude CLI (defaults to 'claude')
        """
        self.prompt_dir = prompt_dir
        self.claude_command = claude_command or "claude"

        # Validate investment memo prompt file exists
        self.memo_prompt_path = os.path.join(prompt_dir, "investment-memo.md")
        if not os.path.exists(self.memo_prompt_path):
            raise FileNotFoundError(f"Investment memo template not found: {self.memo_prompt_path}")

        # Validate portfolio allocation prompt file exists
        self.portfolio_prompt_path = os.path.join(prompt_dir, "portfolio-allocation.md")
        if not os.path.exists(self.portfolio_prompt_path):
            raise FileNotFoundError(f"Portfolio allocation template not found: {self.portfolio_prompt_path}")

    def _extract_company_info(
        self, stock_data: Dict[str, Any], company_name: str = ""
    ) -> Tuple[str, str]:
        """Extract ticker symbol and company name from stock data

        Args:
            stock_data: Stock data from API
            company_name: Optional company name from watchlist

        Returns:
            Tuple of (ticker_symbol, company_name)
        """
        ticker_symbol = ""
        extracted_company_name = company_name or ""

        try:
            # Ensure we have valid stock data
            if not stock_data:
                logger.warning("Stock data is empty or None")
                return ticker_symbol, extracted_company_name

            # Get ticker symbol from API data
            symbol = stock_data.get("tickerSymbol", "")
            if symbol:
                ticker_symbol = symbol

            # If company name wasn't provided from watchlist, try to get from API
            if not extracted_company_name:
                extracted_company_name = stock_data.get("name", "")
        except Exception as e:
            logger.warning(f"Error extracting company info: {str(e)}")

        return ticker_symbol, extracted_company_name

    def _prepare_prompt(self, template_path: str, replacements: Dict[str, str] = None) -> str:
        """Prepare prompt by replacing placeholders in the template

        This method loads a prompt template from file and replaces placeholder
        values with actual data. The template uses double curly braces for
        placeholders (e.g., {{TICKER}}, {{COMPANY}}, {{DATE}}, {{STOCK_JSON_DATA}}).

        The prompt templates (investment-memo.md, investment-memo-with.md, etc.)
        define the structure and instructions for Claude to generate investment
        memos with specific sections including executive summary, company overview,
        financial analysis, valuation, investment thesis, and final recommendation.

        Args:
            template_path: Path to prompt template file (.md format)
            replacements: Dictionary of replacements where:
                - keys are placeholder names without braces (e.g., "TICKER")
                - values are the actual data to insert (e.g., "AAPL")

        Returns:
            Processed prompt text with all placeholders replaced
        """
        with open(template_path, "r") as f:
            template = f.read()

        # Apply replacements if provided
        if replacements:
            for placeholder, value in replacements.items():
                template = template.replace(f"{{{{{placeholder}}}}}", value)

        return template

    def _run_claude(self, prompt: str) -> str:
        """Run Claude with the given prompt

        Args:
            prompt: Prompt text for Claude

        Returns:
            Claude's response

        Raises:
            RuntimeError: If Claude command fails
        """
        # Create temporary file for prompt
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as prompt_file:
            prompt_file.write(prompt)
            prompt_file_path = prompt_file.name

        try:
            # Parse the base claude command to handle both simple and complex forms
            command_parts = self.claude_command.split()

            # Build the command with JSON output format
            command = f"{' '.join(command_parts)} -p --output-format json < {prompt_file_path}"

            # Log the full command that will be executed
            logger.info(f"Executing Claude command: {command}")
            logger.debug(f"Prompt file: {prompt_file_path}")

            # Run the command with shell=True to enable redirection
            result = subprocess.run(
                command,
                shell=True,  # Required for redirection
                check=False,  # Don't raise exception on non-zero exit
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )

            # Check for errors
            if result.returncode != 0:
                error_msg = f"Claude command failed with exit code {result.returncode}.\n"
                error_msg += f"STDOUT: {result.stdout}\n"
                error_msg += f"STDERR: {result.stderr}"
                logger.error(error_msg)

                # Raise an exception
                raise RuntimeError(f"Claude command failed: {error_msg}")

            # Parse JSON from stdout
            if not result.stdout:
                error_msg = "Claude command produced no output"
                logger.error(error_msg)
                raise RuntimeError(error_msg)

            try:
                # Parse JSON response
                json_response = json.loads(result.stdout)

                # Extract content from the "result" field
                if "result" not in json_response:
                    error_msg = "Claude JSON output missing 'result' field"
                    logger.error(error_msg)
                    raise RuntimeError(error_msg)

                # Log some stats if available
                if "cost_usd" in json_response:
                    logger.info(f"Claude request cost: ${json_response['cost_usd']:.6f}")
                if "duration_ms" in json_response:
                    logger.info(f"Claude request duration: {json_response['duration_ms']/1000:.2f} seconds")

                # Extract only the content after the "# Investment Memorandum" heading
                result = json_response["result"]
                if "# Investment Memorandum" in result:
                    result = "# Investment Memorandum" + result.split("# Investment Memorandum", 1)[1]

                return result

            except json.JSONDecodeError as e:
                error_msg = f"Failed to parse JSON response from Claude: {str(e)}"
                logger.error(error_msg)
                logger.debug(f"Raw response: {result.stdout}")
                raise RuntimeError(error_msg)

        finally:
            # Clean up temporary file
            try:
                if os.path.exists(prompt_file_path):
                    os.unlink(prompt_file_path)
            except Exception as e:
                logger.warning(f"Failed to clean up temporary file: {str(e)}")


    def generate_investment_memo(
        self, stock_data: Dict[str, Any], company_name: str = ""
    ) -> str:
        """Generate investment memo using stock data

        Args:
            stock_data: Stock data from SimplyWall.st API
            company_name: Optional company name from watchlist

        Returns:
            Generated investment memo content

        Raises:
            RuntimeError: If Claude command fails
            ValueError: If stock data is empty or None
        """
        # Ensure we have valid data
        if not stock_data:
            raise ValueError("Stock data is empty or None")

        # Extract ticker and company name for logging
        ticker, extracted_company_name = self._extract_company_info(stock_data, company_name)
        current_date = datetime.datetime.now().strftime("%Y-%m-%d")

        # Get full ticker with exchange for logging
        full_ticker = ""
        try:
            exchange = stock_data.get("exchangeSymbol", "")
            if exchange and ticker:
                full_ticker = f"{exchange}:{ticker}"
            else:
                full_ticker = ticker
        except:
            full_ticker = ticker

        logger.info(
            f"Generating investment memo for {full_ticker} ({extracted_company_name}) with stock data"
        )

        # Convert stock data to JSON string
        stock_json = json.dumps(stock_data, indent=2)


        # Prepare replacements dict with all required placeholders
        replacements = {
            "TICKER": ticker,
            "COMPANY": extracted_company_name,
            "DATE": current_date,
            "STOCK_JSON_DATA": stock_json
        }

        # Prepare prompt with all replacements
        prompt = self._prepare_prompt(self.memo_prompt_path, replacements)

        # Run Claude and return response
        return self._run_claude(prompt)

    def generate_portfolio_allocation(self, memos_data: Dict[str, str], portfolio_data: Dict[str, Dict[str, Any]] = None) -> str:
        """Generate portfolio allocation recommendation using investment memos and current portfolio data

        Args:
            memos_data: Dictionary with ticker as key and memo content as value
            portfolio_data: Optional dictionary with ticker as key and portfolio holdings data as value

        Returns:
            Generated portfolio allocation content

        Raises:
            RuntimeError: If Claude command fails
            ValueError: If memos data is empty
        """
        # Ensure we have valid data
        if not memos_data:
            raise ValueError("No investment memos provided for portfolio allocation")

        # Get current date for the prompt
        current_date = datetime.datetime.now().strftime("%Y-%m-%d")

        # Format memos data for the prompt
        formatted_memos = ""
        for ticker, memo in memos_data.items():
            formatted_memos += f"\n\n==== MEMO FOR {ticker} ====\n\n{memo}"

        # Format portfolio data if provided
        formatted_portfolio = ""
        if portfolio_data:
            # Add CSV header
            formatted_portfolio = "Ticker,Name,Invested Value (GBP),Current Value (GBP),Result (GBP),Quantity\n"

            # Add each holding as a CSV row
            for ticker, data in portfolio_data.items():
                row = f"{ticker},{data['name']},{data['invested_value']:.2f},{data['current_value']:.2f},{data['result']:.2f},{data['quantity']:.6f}\n"
                formatted_portfolio += row

            logger.info(f"Including {len(portfolio_data)} holdings from current portfolio in allocation")

        # Prepare replacements for the prompt
        replacements = {
            "DATE": current_date,
            "MEMOS_DATA": formatted_memos,
            "CURRENT_PORTFOLIO": formatted_portfolio
        }

        logger.info(f"Generating portfolio allocation using {len(memos_data)} investment memos")

        # Prepare prompt with replacements
        prompt = self._prepare_prompt(self.portfolio_prompt_path, replacements)

        # Run Claude and return response
        result = self._run_claude(prompt)

        return result
