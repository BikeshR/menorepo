"""
SimplyWall.st API Client

This module provides a client for interacting with the SimplyWall.st GraphQL API.
It handles authentication, query execution, and provides methods for
retrieving company data.
"""

import requests
import json
from typing import Dict, List, Optional, Any, Union


class SimplywallStAPI:
    """Client for the SimplyWall.st GraphQL API"""

    BASE_URL = "https://api.simplywall.st/graphql"

    def __init__(self, api_token: str):
        """Initialize the API client with authentication token

        Args:
            api_token: SimplyWall.st Pro API token
        """
        self.api_token = api_token
        self.headers = {"Authorization": f"Bearer {api_token}", "Content-Type": "application/json"}

    def _execute_query(self, query: str, variables: Dict[str, Any] = None) -> Dict[str, Any]:
        """Execute a GraphQL query

        Args:
            query: GraphQL query string
            variables: Variables for the query

        Returns:
            API response as dictionary

        Raises:
            requests.RequestException: If the API request fails
        """
        if variables is None:
            variables = {}

        payload = {"query": query, "variables": variables}

        response = requests.post(self.BASE_URL, headers=self.headers, data=json.dumps(payload))

        response.raise_for_status()
        return response.json()

    def search_companies(self, query: str) -> List[Dict[str, Any]]:
        """Search for companies by name or ticker

        Args:
            query: Search term for company name or ticker

        Returns:
            List of matching companies
        """
        graphql_query = """
        query searchCompanies($query: String!) {
            searchCompanies(query: $query) {
                id
                name
                exchangeSymbol
                tickerSymbol
                marketCapUSD
            }
        }
        """

        response = self._execute_query(graphql_query, {"query": query})
        return response.get("data", {}).get("searchCompanies", [])

    def get_company_detailed(self, company_id: str) -> Dict[str, Any]:
        """Get comprehensive company information by ID

        Args:
            company_id: SimplyWall.st company UUID

        Returns:
            Detailed company information
        """
        graphql_query = """
        query CompanyDetailedQuery($id: ID!) {
            company(id: $id) {
                id
                name
                exchangeSymbol
                tickerSymbol
                marketCapUSD
                primaryIndustry {
                    name
                }
                secondaryIndustry {
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
                    value
                    description
                }
                owners {
                    name
                    type
                    percentOfSharesOutstanding
                    holdingDate
                }
                insiderTransactions {
                    type
                    ownerName
                    ownerType
                    description
                    shares
                    priceMin
                    priceMax
                    transactionValue
                    percentageSharesTraded
                    percentageChangeTransShares
                    isManagementInsider
                    filingDate
                }
                members {
                    name
                    title
                    tenure
                    compensation
                }
            }
        }
        """

        response = self._execute_query(graphql_query, {"id": company_id})
        return response.get("data", {}).get("company", {})

    def get_company_by_ticker(self, exchange: str, ticker_symbol: str) -> Dict[str, Any]:
        """Get company information by exchange and ticker symbol

        Args:
            exchange: Exchange symbol (e.g., "NasdaqGS")
            ticker_symbol: Ticker symbol (e.g., "TSLA")

        Returns:
            Basic company information including ID for further queries
        """
        graphql_query = """
        query CompanyByExchangeAndTickerSymbol($exchange: String!, $symbol: String!) {
            companyByExchangeAndTickerSymbol(exchange: $exchange, tickerSymbol: $symbol) {
                id
                name
                exchangeSymbol
                tickerSymbol
                marketCapUSD
            }
        }
        """

        response = self._execute_query(
            graphql_query, {"exchange": exchange, "symbol": ticker_symbol}
        )
        return response.get("data", {}).get("companyByExchangeAndTickerSymbol", {})

    def get_company_data(self, ticker_info: str, company_name: str = "") -> Dict[str, Any]:
        """Get comprehensive company data from a ticker string

        Args:
            ticker_info: Ticker string in format "EXCHANGE:SYMBOL" or just "SYMBOL"
                         If only symbol is provided, will attempt to find the right exchange
            company_name: Optional company name from watchlist to help find correct match

        Returns:
            Complete company data including financial metrics, statements, etc.

        Raises:
            ValueError: If company cannot be found
        """
        # Parse ticker info
        if ":" in ticker_info:
            exchange, symbol = ticker_info.split(":", 1)
            # Get company ID
            company = self.get_company_by_ticker(exchange, symbol)
        else:
            # Try to find the company by name/symbol
            search_results = self.search_companies(ticker_info)

            if not search_results:
                raise ValueError(f"Could not find company matching '{ticker_info}'")

            # If company_name is provided, try to find best match
            if company_name and len(search_results) > 1:
                best_match = None
                highest_score = 0

                for result in search_results:
                    # Extract core company name (remove Inc, Corp, etc.)
                    result_name = result.get("name", "").lower()
                    watch_name = company_name.lower()

                    # Simple scoring: 1 point if watchlist name is in result name
                    # 2 points if they are exactly the same
                    score = 0
                    if watch_name == result_name:
                        score = 2
                    elif watch_name in result_name or result_name in watch_name:
                        score = 1

                    # Update best match if this score is higher
                    if score > highest_score:
                        highest_score = score
                        best_match = result

                # If we found a match, use it; otherwise use first result
                if best_match:
                    company = best_match
                else:
                    company = search_results[0]
            else:
                company = search_results[0]  # Take the first result

        # If we didn't get a company, raise error
        if not company:
            raise ValueError(f"Could not find company matching '{ticker_info}'")

        # Check if company has an ID
        if "id" not in company or not company["id"]:
            raise ValueError(f"Company found for '{ticker_info}' but has no valid ID")

        # Get detailed information using the company ID
        detailed_data = self.get_company_detailed(company["id"])

        # Ensure we have valid data
        if not detailed_data:
            raise ValueError(f"Could not retrieve detailed data for '{ticker_info}'")

        # Add basic company information to ensure it's available
        # This helps when the detailed data might be missing some fields
        for key in ["name", "exchangeSymbol", "tickerSymbol", "marketCapUSD"]:
            if key in company and key not in detailed_data:
                detailed_data[key] = company[key]

        # Override company name if provided from watchlist and significantly different
        if company_name and detailed_data.get("name") and company_name.lower() != detailed_data["name"].lower():
            # Still log the original name for reference
            original_name = detailed_data["name"]
            detailed_data["originalName"] = original_name
            detailed_data["name"] = company_name

        return detailed_data

    def get_exchanges(self) -> List[Dict[str, Any]]:
        """Get list of available exchanges

        Returns:
            List of exchanges with symbol and company count
        """
        graphql_query = """
        query {
            exchanges {
                symbol
                companiesCount
            }
        }
        """

        response = self._execute_query(graphql_query)
        return response.get("data", {}).get("exchanges", [])
