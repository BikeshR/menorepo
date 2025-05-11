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
│   ├── sws_data/                   # SimplyWall.st API data (refreshed every 5 days)
│   ├── initial_memos/              # Historical initial investment memos (refreshed daily)
│   └── final_memos/                # Historical final investment memos
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

5. Install the Claude CLI:
   - Follow the instructions at https://github.com/anthropics/claude-cli
   - Make sure the `claude` command is available in your path
   - Log in with `claude login`

## Usage

1. Ensure your virtual environment is activated
2. Add stocks to your watchlist in `data/watchlist.txt`
3. Run the main script:

```bash
# Run with default settings
python src/main.py

# Or with custom settings
python src/main.py --json-days-threshold 7 --initial-memo-days-threshold 2 --claude-command "claude" --verbose
```

## Workflow

For each stock in the watchlist:

1. Check if SimplyWall.st data needs to be refreshed (>5 days since last update)
   - If yes, fetch new data from SimplyWall.st API and save as timestamped JSON
   
2. Check if initial memo needs to be refreshed (>1 day since last update or API data was updated)
   - If yes, generate new initial memo using the template
   
3. If either API data or initial memo was updated:
   - Generate a new final memo using stock data and the initial memo
   - Save as timestamped markdown file

All files are stored with timestamps in their respective folders, maintaining a historical record.

## Command-line Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--api-token` | SimplyWall.st API token | From .env file |
| `--watchlist` | Path to watchlist file | data/watchlist.txt |
| `--json-days-threshold` | Days before refreshing API data | 5 |
| `--initial-memo-days-threshold` | Days before refreshing initial memo | 1 |
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
- SimplyWall.st Pro API access
- Claude CLI installed and configured