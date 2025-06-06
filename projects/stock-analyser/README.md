# Stock Analyzer

A tool for analyzing stocks using SimplyWall.st API data and generating investment memos with Claude.

## Features

- Fetches detailed stock information from SimplyWall.st API
- Manages historical stock data
- Generates investment memos using Claude
- Creates portfolio allocation recommendations based on current holdings
- Tracks a watchlist of stocks in YAML format
- Maintains history of analyses for tracking performance

## Project Structure

```
stock-analyser/
├── data/
│   ├── watchlist.yaml              # Stock watchlist in YAML format
│   ├── sws_data/                   # SimplyWall.st API data
│   ├── final_memos/                # Historical investment memos
│   └── portfolio/                  # Portfolio allocation recommendations
├── prompts/
│   ├── investment-memo.md          # Investment memo prompt template
│   └── portfolio-allocation.md     # Portfolio allocation prompt template
├── src/
│   ├── simplywall_api.py           # API client
│   ├── file_manager.py             # File/folder operations
│   ├── watchlist_parser.py         # Parse watchlist
│   ├── claude_integration.py       # Claude API integration
│   └── main.py                     # Main workflow script
├── .env.example                    # Example environment variables
├── setup.sh                        # Setup script
└── requirements.txt                # Dependencies
```

## Quick Setup

Run the setup script to create a virtual environment and install dependencies:

```bash
./setup.sh
```

## Manual Installation

1. Clone the repository

2. Create and activate a virtual environment:
```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up SimplyWall.st API access:
   - Register for SimplyWall.st Pro API access
   - Create an API token
   - Copy `.env.example` to `.env` and add your token:

```bash
cp .env.example .env
# Edit .env with your API token
# Example contents:
# SIMPLYWALL_API_TOKEN=your_api_token_here
```

5. Install the Claude CLI:
   - Follow the instructions at https://github.com/anthropics/claude-cli
   - Make sure the `claude` command is available in your path
   - Log in with `claude login`

## Usage

1. Ensure your virtual environment is activated
2. Add stocks to your watchlist in `data/watchlist.yaml`
3. Run the main script:

```bash
# Run with default settings
python src/main.py

# Or with custom settings
python src/main.py --claude-command "claude" --verbose
```

## Workflow

The workflow consists of two main phases:

### Phase 1: Individual Stock Analysis
For each stock in the watchlist:

1. Check if an investment memo already exists for the stock
   - If a memo exists, skip processing this stock entirely
   - If no memo exists, proceed with data collection and analysis

2. Check if stock data from today already exists
   - If today's data exists, use it without making API calls
   - If no data from today exists, fetch from SimplyWall.st API
   - Save as timestamped JSON file with today's date
   - Delete any older data files for this stock to conserve space

3. Generate investment memo using Claude and the template
   - The memo includes a comprehensive analysis with BUY/HOLD/SELL recommendation
   - Generated memo is processed to extract the investment memorandum section
   - Save as timestamped markdown file

### Phase 2: Portfolio Allocation
After all individual stocks are successfully processed:

1. Collect all the latest investment memos for stocks in the watchlist
2. Read current portfolio holdings from CSV file (if available)
3. Generate a portfolio allocation recommendation using Claude
   - Analyze all BUY-rated stocks for inclusion in the portfolio
   - Consider current holdings and investments when making recommendations
   - Determine allocation percentages based on conviction and diversification
   - Suggest sector allocations and implementation strategy
4. Save the portfolio allocation as a timestamped file

Note: The portfolio allocation is only generated if all stocks in the watchlist are successfully processed. This ensures the allocation recommendation is based on a complete dataset.

This approach minimizes API calls and storage requirements while providing both individual stock analysis and holistic portfolio recommendations.

## Command-line Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--api-token` | SimplyWall.st API token | From .env file |
| `--watchlist` | Path to watchlist file | data/watchlist.yaml |
| `--claude-command` | Command to invoke Claude | claude |
| `--verbose` | Enable verbose logging | False |
| `--env-file` | Path to .env file | .env |

## Example Watchlist YAML File

```yaml
# Stock Watchlist
# Format: Lists of stocks with ticker and company name

stocks:
  # Tech
  - AAPL (Apple Inc.)
  - MSFT (Microsoft Corporation)
  - GOOGL (Alphabet (Class A))

  # Finance
  - JPM (JPMorgan Chase & Co)
  - BAC (Bank of America Corporation)
  
  # ETFs
  - VOO (Vanguard S&P 500 ETF)
  
  # Healthcare
  - JNJ (Johnson & Johnson)
```

Note: The watchlist is in YAML format with a list of stocks using the format `TICKER (Company Name)`. This structure provides better organization and allows for categorization with comments and grouping.

## Output Formats

### Investment Memo Format

The generated investment memos follow a structured format:

```markdown
# Investment Memorandum
**Ticker/Company:** AAPL (Apple Inc.)
**Date:** 2023-05-01
**Recommendation:** BUY
**Target Price:** $200.00
**Current Price:** $170.50
**Potential Upside:** 17.3%
**Confidence Level:** HIGH

## 1. Executive Summary
[Concise overview with investment thesis]

## 2. Company Overview
[Business model, management, ownership structure]

## 3. Financial Analysis
[Revenue, earnings, balance sheet, return metrics]

## 4. Valuation & Technical Factors
[Fundamental valuation, technical indicators]

## 5. Investment Thesis & Catalysts
[Thesis, catalysts, scenario analysis]

## 6. Risk Assessment
[Key risks and mitigating factors]

## 7. Investment Recommendation
[Final recommendation with rationale]
```

### Portfolio Allocation Format

The portfolio allocation recommendation follows this structure:

```markdown
# Portfolio Allocation Recommendation
**Date:** 2023-05-01
**Number of Analyzed Securities:** 15
**Recommended Positions:** 8
**Expected Return:** 12.4%
**Risk Level:** MEDIUM

## 1. Executive Summary
[Overview of portfolio strategy and key themes]

## 2. Portfolio Allocation
| Stock | Company | Sector | Recommendation | Target Price | Current Price | Upside | Allocation % | Rationale |
|-------|---------|--------|----------------|-------------|---------------|--------|--------------|-----------|
| AAPL  | Apple   | Tech   | BUY            | $200        | $170          | 17.6%  | 8%           | High conviction |
| [Other BUY-rated stocks] |

## 3. Sector Allocation
| Sector | Allocation % | Key Holdings | Sector View |
|--------|--------------|--------------|-------------|
| Technology | 25% | AAPL, MSFT | Overweight |
| [Other sectors] |

## 4. Risk Assessment
[Portfolio-level risks and mitigation strategies]

## 5. Implementation Strategy
[Recommended implementation approach]

## 6. Alternative Scenarios
[Performance under different market conditions]

## 7. Conclusion
[Summary of recommendations]
```

## Troubleshooting

### Claude CLI Issues

If you see errors related to the Claude CLI:

1. Ensure Claude CLI is installed: `pip install claude-cli`
2. Make sure you're logged in: `claude login`
3. Test with a simple query: `claude -p "Hello" > output.txt`
4. If Claude responds with an error, try running in verbose mode to see details: `python src/main.py --verbose`

### Environment Errors

If you see "externally-managed-environment" errors:
1. Make sure you're using a virtual environment
2. Activate it with `source venv/bin/activate`
3. Then install packages with pip

## Requirements

- Python 3.8+
- SimplyWall.st Pro API access (for financial data)
- Claude CLI installed and configured (for investment memo generation)
- YAML support for watchlist management