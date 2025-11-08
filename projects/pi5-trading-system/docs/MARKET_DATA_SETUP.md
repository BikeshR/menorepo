# Market Data Setup Guide

**Complete guide to setting up real-time market data for day trading**

---

## Overview

The Pi5 Trading System supports two market data modes:

1. **Live Data (Alpaca)** - Real-time 1-minute bars from IEX exchange (FREE)
2. **Simulated Data** - Fake price movements for testing (no API required)

For profitable day trading, you **must use real market data** from Alpaca.

---

## Option 1: Alpaca Markets (RECOMMENDED)

### Why Alpaca?

✅ **Free Tier Benefits:**
- Real-time IEX market data (1-minute bars)
- Paper trading with $100,000 virtual money
- No credit card required
- REST API + WebSocket streaming
- 7 days of historical data
- Perfect for day trading strategies

✅ **Production Ready:**
- High availability
- Excellent documentation
- Active community support
- Can upgrade to paid SIP feed later

---

## Step 1: Create Free Alpaca Account

### 1.1 Sign Up

1. Go to [https://alpaca.markets](https://alpaca.markets)
2. Click **"Sign Up"**
3. Choose **"Paper Trading"** account
4. Fill in your information:
   - Email address
   - Create password
   - Complete verification

**No credit card required!**

### 1.2 Account Verification

1. Check your email for verification link
2. Click the link to verify your account
3. Log in to Alpaca dashboard

---

## Step 2: Generate API Keys

### 2.1 Navigate to API Keys

1. Log in to [https://app.alpaca.markets/paper/dashboard/overview](https://app.alpaca.markets/paper/dashboard/overview)
2. Click **"Account"** in the top right
3. Select **"API Keys"** from dropdown
4. Click **"Generate New Key"**

### 2.2 Copy Your Credentials

You'll see:
```
API Key ID:    PKxxxxxxxxxxxxxxxxxx
Secret Key:    xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**IMPORTANT:** Copy both values immediately - you won't see the secret again!

---

## Step 3: Configure Pi5 Trading System

### 3.1 Set Environment Variables

**Option A: Using .env file (Development)**

```bash
cd /home/user/menorepo/projects/pi5-trading-system
cp .env.example .env
nano .env
```

Add your Alpaca credentials:
```bash
# Alpaca API Credentials
ALPACA_API_KEY=PKxxxxxxxxxxxxxxxxxx
ALPACA_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Option B: Export variables (Temporary)**

```bash
export ALPACA_API_KEY="PKxxxxxxxxxxxxxxxxxx"
export ALPACA_API_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Option C: Docker environment (Production)**

In `deployments/.env`:
```bash
ALPACA_API_KEY=PKxxxxxxxxxxxxxxxxxx
ALPACA_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3.2 Verify Configuration

Check `configs/config.yaml`:

```yaml
market_data:
  provider: "alpaca"  # Must be "alpaca"

  alpaca:
    api_key: ""  # Leave blank, use env var
    api_secret: ""  # Leave blank, use env var
    feed_type: "iex"  # Free tier
    paper_trading: true  # Use paper trading endpoint

  backfill:
    enabled: true  # Load historical data on startup
    lookback_days: 7  # 7 days of history
    timeframe: "1Min"  # 1-minute bars
```

---

## Step 4: Test Connection

### 4.1 Start the System

```bash
# Using Docker (recommended)
cd deployments
docker-compose -f docker-compose.pi5-optimized.yml up

# Or build and run locally
go build ./cmd/api
./api
```

### 4.2 Check Logs

Look for these success messages:

```
{"level":"info","component":"alpaca_client","message":"Connecting to Alpaca market data"}
{"level":"info","component":"alpaca_websocket","message":"WebSocket connected and authenticated"}
{"level":"info","message":"Subscribed to real-time market data from Alpaca","symbols":["AAPL","MSFT","GOOGL"],"feed_type":"iex"}
{"level":"info","message":"Starting historical data backfill"}
{"level":"info","message":"Historical data backfill completed"}
```

### 4.3 Verify Real Data

Check market data events:

```bash
# Watch logs for real prices
docker-compose -f deployments/docker-compose.pi5-optimized.yml logs -f trading_api | grep "market data"
```

You should see:
```json
{
  "level":"debug",
  "symbol":"AAPL",
  "close":182.45,
  "volume":1234567,
  "timestamp":"2025-11-08T14:30:00Z",
  "message":"Published bar event"
}
```

**Real prices, not simulated!**

---

## Step 5: Monitor System Performance

### 5.1 Check Web Dashboard

Open browser: `http://your-pi5-ip:8080`

You should see:
- Real-time price updates
- Strategy signals based on actual market data
- Order execution with realistic prices

### 5.2 View Metrics

Prometheus metrics: `http://your-pi5-ip:8080/metrics`

Look for:
```
# Market data events received
market_data_events_total{symbol="AAPL"} 1234

# WebSocket connection status
alpaca_websocket_connected 1
```

---

## Troubleshooting

### Problem: "Alpaca API credentials not set"

**Solution:**
```bash
# Check if variables are set
echo $ALPACA_API_KEY
echo $ALPACA_API_SECRET

# If empty, set them
export ALPACA_API_KEY="your-key-here"
export ALPACA_API_SECRET="your-secret-here"

# Restart system
docker-compose restart trading_api
```

### Problem: "Authentication failed"

**Causes:**
- Wrong API keys
- Copy-paste error (extra spaces)
- Using live trading keys instead of paper trading

**Solution:**
1. Regenerate API keys in Alpaca dashboard
2. Copy carefully (no extra spaces)
3. Make sure you're using **paper trading** keys

### Problem: "No market data received"

**Causes:**
- Market is closed (US stock market hours: 9:30 AM - 4:00 PM ET)
- Symbols not actively traded
- Rate limiting

**Solution:**
1. Check if market is open
2. Test with highly liquid symbols: AAPL, SPY, MSFT
3. Check Alpaca status page: https://status.alpaca.markets

### Problem: "WebSocket disconnected"

**Causes:**
- Network issues
- Alpaca maintenance
- Connection timeout

**Solution:**
- System will automatically reconnect with exponential backoff
- Check logs for reconnection attempts
- If persistent, check your internet connection

---

## Market Hours & Trading Schedule

### US Stock Market Hours (Eastern Time)

- **Pre-Market**: 4:00 AM - 9:30 AM (limited data)
- **Regular Hours**: 9:30 AM - 4:00 PM (full data)
- **After-Hours**: 4:00 PM - 8:00 PM (limited data)

**Day Trading Focus**: 9:30 AM - 3:30 PM ET

### Data Availability

| Time Period | IEX Data | Notes |
|-------------|----------|-------|
| Market Open | ✅ Full | All symbols, high volume |
| First 30 min | ⚠️ Volatile | Avoid or use carefully |
| Mid-Day | ✅ Best | Consistent data |
| Last 30 min | ⚠️ Volatile | Close all positions by 3:55 PM |
| After Hours | ⚠️ Limited | Reduced liquidity |
| Weekends | ❌ None | Market closed |

---

## Upgrading to Paid Data (Optional)

### When to Upgrade?

Consider upgrading when:
- You're consistently profitable with IEX data
- You need sub-second data for scalping
- You trade low-volume stocks (IEX misses some trades)
- You need level 2 market depth

### Alpaca SIP Feed ($99/month)

**Benefits:**
- Full consolidated tape (all exchanges)
- More accurate volume data
- Lower latency
- Better quote data

**How to Upgrade:**

1. Go to Alpaca dashboard
2. Billing → Subscribe to SIP feed
3. Update config:
```yaml
market_data:
  alpaca:
    feed_type: "sip"  # Change from "iex"
```

---

## Data Quality Comparison

### Free IEX Feed
- **Latency**: ~1 second
- **Coverage**: IEX exchange only (~3% of volume)
- **Best for**: Day trading with 1-5 min bars
- **Cost**: FREE
- **Symbols**: All US stocks
- **Timeframes**: 1-min, 5-min, 15-min, 1-hour, 1-day

### Paid SIP Feed
- **Latency**: ~100-300ms
- **Coverage**: All US exchanges (100% of volume)
- **Best for**: Scalping, high-frequency strategies
- **Cost**: $99/month
- **Symbols**: All US stocks
- **Timeframes**: 1-sec to 1-day bars

---

## Best Practices

### For Day Trading (1-5 min bars)

✅ **DO:**
- Use free IEX feed (sufficient for day trading)
- Focus on high-volume stocks (AAPL, MSFT, TSLA, SPY, QQQ)
- Trade during regular market hours (9:30 AM - 3:30 PM ET)
- Backfill 7 days of historical data for indicator warmup
- Monitor connection status

❌ **DON'T:**
- Don't trade first 5 minutes after open (too volatile)
- Don't hold positions overnight (close by 3:55 PM)
- Don't trade low-volume stocks with IEX (data incomplete)
- Don't ignore WebSocket disconnections

### Symbol Selection

**Best for IEX free data:**
- Large cap tech: AAPL, MSFT, GOOGL, AMZN, META
- Major ETFs: SPY, QQQ, DIA, IWM
- High volume stocks: TSLA, NVDA, AMD

**Avoid with IEX:**
- Small cap stocks (< $1B market cap)
- Low volume stocks (< 1M daily volume)
- Penny stocks
- Newly listed stocks

---

## Configuration Examples

### Conservative Day Trading (Recommended Start)

```yaml
market_data:
  provider: "alpaca"
  alpaca:
    feed_type: "iex"
  backfill:
    enabled: true
    lookback_days: 7
    timeframe: "5Min"  # 5-minute bars, more stable

trading:
  strategies:
    - id: "moving_avg_crossover"
      symbols:
        - "SPY"  # S&P 500 ETF (very liquid)
        - "QQQ"  # NASDAQ ETF (very liquid)
      params:
        short_period: 20
        long_period: 50
```

### Aggressive Day Trading

```yaml
market_data:
  provider: "alpaca"
  alpaca:
    feed_type: "iex"
  backfill:
    enabled: true
    lookback_days: 14
    timeframe: "1Min"  # 1-minute bars, faster signals

trading:
  strategies:
    - id: "moving_avg_crossover"
      symbols:
        - "AAPL"
        - "MSFT"
        - "TSLA"
        - "NVDA"
        - "AMD"
      params:
        short_period: 10
        long_period: 30
```

---

## Next Steps

Once you have real market data flowing:

1. **Paper Trade**: Test strategies with $100,000 virtual money
2. **Analyze Performance**: Track win rate, Sharpe ratio, max drawdown
3. **Optimize**: Adjust strategy parameters based on real data
4. **Scale Up**: Once profitable, consider live trading with small capital

**See also:**
- [QUICKSTART.md](QUICKSTART.md) - Basic system setup
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment
- [REQUIREMENTS.md](REQUIREMENTS.md) - System requirements

---

## Support

### Alpaca Support
- Docs: https://alpaca.markets/docs
- Community: https://forum.alpaca.markets
- Status: https://status.alpaca.markets
- Support: support@alpaca.markets

### Pi5 Trading System
- GitHub Issues: (link to your repo)
- Documentation: See `docs/` folder

---

**🎯 You're now ready for real-time day trading with free market data!**
