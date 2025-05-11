# Stock Analyzer

A tool for analyzing stocks using SimplyWall.st API data and generating investment memos with Claude.

## Features

- Fetches detailed stock information from SimplyWall.st API
- Manages historical stock data 
- Generates investment memos using Claude
- Tracks a watchlist of stocks
- Maintains history of analyses for tracking performance

## Project Structure

```
stock-analyser/
├── data/
│   ├── watchlist.txt               # Stock watchlist
│   ├── historical_json/            # Historical API data
│   ├── current_memos/              # Latest investment memos
│   └── historical_memos/           # Historical investment memos
├── prompts/
│   ├── investment-memo-template.md # Template for initial memo
│   └── update-investment-memo.md   # Template for final memo
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
```

5. Install the Claude CLI (https://github.com/anthropics/claude-cli)

## Usage

1. Ensure your virtual environment is activated
2. Add stocks to your watchlist in `data/watchlist.txt`
3. Run the main script:

```bash
# Run with default settings
python src/main.py

# Or with custom settings
python src/main.py --watchlist data/watchlist.txt --days-threshold 7 --claude-command custom-claude-command --verbose
```

## Workflow

For each stock in the watchlist:

1. Check if new data is needed (>5 days since last update)
2. If yes, fetch data from SimplyWall.st API and save as JSON
3. Generate initial investment memo using Claude
4. Update the memo with a final version
5. Save outputs to appropriate folders

## Command-line Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--api-token` | SimplyWall.st API token | From .env file |
| `--watchlist` | Path to watchlist file | data/watchlist.txt |
| `--days-threshold` | Days before refreshing data | 5 |
| `--claude-command` | Command to invoke Claude | claude |
| `--verbose` | Enable verbose logging | False |
| `--env-file` | Path to .env file | .env |

## Example Watchlist File

```
# Tech stocks
NasdaqGS:AAPL
NasdaqGS:MSFT
NasdaqGS:GOOG

# Finance
NYSE:JPM
NYSE:BAC
```

## Requirements

- Python 3.8+
- SimplyWall.st Pro API access
- Claude CLI installed and configured