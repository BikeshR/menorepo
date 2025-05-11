"""
Claude Integration

This module handles integration with Claude API for
generating investment memos from stock data.
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
    """Interface for generating investment memos using Claude"""

    def __init__(self, prompt_dir: str, claude_command: Optional[str] = None):
        """Initialize with paths to prompt files

        Args:
            prompt_dir: Directory containing prompt templates
            claude_command: Command to invoke Claude CLI (defaults to 'claude')
        """
        self.prompt_dir = prompt_dir
        self.claude_command = claude_command or "claude"

        # Validate prompt files exist
        self.initial_prompt_path = os.path.join(prompt_dir, "investment-memo-template.md")
        self.update_prompt_path = os.path.join(prompt_dir, "update-investment-memo.md")

        if not os.path.exists(self.initial_prompt_path):
            raise FileNotFoundError(
                f"Initial prompt template not found: {self.initial_prompt_path}"
            )

        if not os.path.exists(self.update_prompt_path):
            raise FileNotFoundError(f"Update prompt template not found: {self.update_prompt_path}")

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
        """Prepare prompt by replacing placeholders

        Args:
            template_path: Path to prompt template
            replacements: Dictionary of replacements (key: placeholder, value: replacement)

        Returns:
            Processed prompt text
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

                return json_response["result"]

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

    def generate_initial_memo(self, stock_data: Dict[str, Any], company_name: str = "") -> str:
        """Generate initial investment memo using template with company info

        Args:
            stock_data: Stock data from API (used for ticker and company name)
            company_name: Optional company name from watchlist

        Returns:
            Generated memo content

        Raises:
            RuntimeError: If Claude command fails
            ValueError: If stock data is invalid
        """
        # Ensure we have valid data
        if not stock_data:
            raise ValueError("Stock data is empty or None")

        # Extract ticker symbol and company name from stock data
        ticker, extracted_company_name = self._extract_company_info(stock_data, company_name)
        current_date = datetime.datetime.now().strftime("%Y-%m-%d")

        # Ensure we have a valid ticker and company name
        if not ticker:
            logger.warning("No ticker found in stock data, using placeholder")
            ticker = "UNKNOWN"

        if not extracted_company_name:
            logger.warning("No company name found, using placeholder")
            extracted_company_name = "Unknown Company"

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

        logger.info(f"Generating initial memo for {full_ticker} ({extracted_company_name})")

        # Prepare replacements for the template
        replacements = {"TICKER": ticker, "COMPANY": extracted_company_name, "DATE": current_date}

        # Prepare prompt with replacements
        prompt = self._prepare_prompt(self.initial_prompt_path, replacements)

        # Run Claude and return response
        return self._run_claude(prompt)

    def generate_final_memo(
        self, stock_data: Dict[str, Any], draft_memo: str, company_name: str = ""
    ) -> str:
        """Generate final investment memo using stock data and draft memo

        Args:
            stock_data: Stock data from SimplyWall.st API
            draft_memo: Draft memo from initial generation
            company_name: Optional company name from watchlist

        Returns:
            Generated final memo content

        Raises:
            RuntimeError: If Claude command fails
        """
        # Ensure we have valid data
        if not stock_data:
            raise ValueError("Stock data is empty or None")

        if not draft_memo:
            raise ValueError("Draft memo is empty or None")

        # Extract ticker and company name for logging
        ticker, extracted_company_name = self._extract_company_info(stock_data, company_name)

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
            f"Generating final memo for {full_ticker} ({extracted_company_name}) with stock data"
        )

        # Convert stock data to JSON string
        stock_json = json.dumps(stock_data, indent=2)

        # Prepare prompt with stock data and draft memo
        prompt = self._prepare_prompt(
            self.update_prompt_path, {"STOCK_JSON_DATA": stock_json, "DRAFT_MEMO": draft_memo}
        )

        # Run Claude and return response
        return self._run_claude(prompt)
