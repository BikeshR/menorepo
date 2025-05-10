# Stock Analyser

Automated tool for generating comprehensive stock analyses using SimplyWall.st API data and Claude AI.

## Features

- Fetches detailed stock data from SimplyWall.st API
- Combines private financial data with public information
- Generates in-depth stock analyses using Claude AI
- Manages API rate limits and Claude session tracking
- Processes stocks in batches with caching for efficiency

## Requirements

- Python 3.7+
- SimplyWall.st API token
- Claude CLI access

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Set environment variables:
   ```
   export SIMPLYWALL_API_TOKEN="your_api_token_here"
   ```

## Usage

### Basic Usage

```bash
python main.py --watchlist watchlist.txt
```

### Command-line Arguments

```
python main.py --help
```

| Argument | Description | Default |
|----------|-------------|---------|
| `--watchlist` | File containing stock tickers | watchlist.txt |
| `--csv-dir` | Directory for stock data | ./stock_data |
| `--output-dir` | Directory for analyses | ./analyses |
| `--template` | Template file for analysis | ./template.md |
| `--batch-size` | Process stocks in batches (0 = auto) | 0 |
| `--skip-data-fetch` | Skip API data fetching | False |
| `--refresh-cache` | Force refresh cached data | False |
| `--test-api` | Test API connection and exit | False |
| `--dry-run` | Estimate resource usage without processing | False |
| `--session-limit` | Max Claude messages per session | 200 |

### Example Watchlist File

```
AAPL
MSFT
GOOG
AMZN
META
```

### Template File

Create a `template.md` file to structure your stock analyses:

```markdown
# {TICKER} Stock Analysis

## Company Overview

[Basic company information]

## Financial Analysis

[Key financial metrics]

## Growth Prospects

[Growth analysis and projections]

## Risks and Concerns

[Risk factors]

## Valuation

[Valuation analysis]

## Recommendation

[Investment recommendation]
```

## Output

For each ticker, the tool generates a markdown file in the output directory with a comprehensive stock analysis.

## Resource Management

- SimplyWall.st API: Respects rate limits (default: 60 requests/minute)
- Claude: Tracks session usage and limits (default: 200 messages/session)

## Limitations

- API token required for SimplyWall.st data
- Subject to Claude usage limits (typically 50 sessions/month)
