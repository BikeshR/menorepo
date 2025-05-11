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
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
    
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
            
        payload = {
            "query": query,
            "variables": variables
        }
        
        response = requests.post(
            self.BASE_URL,
            headers=self.headers,
            data=json.dumps(payload)
        )
        
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
                    state
                    severity
                    outcomeName
                }
                owners {
                    name
                    type
                    sharesHeld
                    percentOfSharesOutstanding
                    holdingDate
                    periodStartDate
                    periodEndDate
                    rankSharesHeld
                    rankSharesSold
                }
                insiderTransactions {
                    type
                    ownerName
                    ownerType
                    description
                    tradeDateMin
                    tradeDateMax
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
                    age
                    name
                    title
                    tenure
                    compensation
                }
                closingPrices
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
            graphql_query, 
            {"exchange": exchange, "symbol": ticker_symbol}
        )
        return response.get("data", {}).get("companyByExchangeAndTickerSymbol", {})
    
    def get_company_data(self, ticker_info: str) -> Dict[str, Any]:
        """Get comprehensive company data from a ticker string
        
        Args:
            ticker_info: Ticker string in format "EXCHANGE:SYMBOL" or just "SYMBOL"
                         If only symbol is provided, will attempt to find the right exchange
            
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
            company = search_results[0]  # Take the first result
        
        # If we didn't get a company, raise error
        if not company:
            raise ValueError(f"Could not find company matching '{ticker_info}'")
        
        # Get detailed information using the company ID
        return self.get_company_detailed(company["id"])
    
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