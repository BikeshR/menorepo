package backtest

import (
	"math"
	"time"
)

// MetricsCalculator computes performance metrics from backtest results
type MetricsCalculator struct {
	trades      []Trade
	dailyStats  []DailyStats
	equityCurve []EquityPoint
	initialCash float64
}

// NewMetricsCalculator creates a new metrics calculator
func NewMetricsCalculator(trades []Trade, dailyStats []DailyStats, equityCurve []EquityPoint, initialCash float64) *MetricsCalculator {
	return &MetricsCalculator{
		trades:      trades,
		dailyStats:  dailyStats,
		equityCurve: equityCurve,
		initialCash: initialCash,
	}
}

// CalculateAllMetrics computes all performance metrics
func (m *MetricsCalculator) CalculateAllMetrics() map[string]float64 {
	metrics := make(map[string]float64)

	// Basic metrics
	metrics["total_trades"] = float64(len(m.trades))
	metrics["winning_trades"] = float64(m.countWinningTrades())
	metrics["losing_trades"] = float64(m.countLosingTrades())
	metrics["win_rate"] = m.calculateWinRate()

	// Profit metrics
	metrics["gross_profit"] = m.calculateGrossProfit()
	metrics["gross_loss"] = m.calculateGrossLoss()
	metrics["net_profit"] = m.calculateNetProfit()
	metrics["profit_factor"] = m.calculateProfitFactor()
	metrics["average_trade"] = m.calculateAverageTrade()
	metrics["average_win"] = m.calculateAverageWin()
	metrics["average_loss"] = m.calculateAverageLoss()
	metrics["largest_win"] = m.findLargestWin()
	metrics["largest_loss"] = m.findLargestLoss()

	// Risk metrics
	metrics["max_drawdown"] = m.calculateMaxDrawdown()
	metrics["max_drawdown_pct"] = m.calculateMaxDrawdownPct()
	metrics["sharpe_ratio"] = m.calculateSharpeRatio()
	metrics["sortino_ratio"] = m.calculateSortinoRatio()
	metrics["calmar_ratio"] = m.calculateCalmarRatio()

	// Trading metrics
	metrics["avg_trade_duration_minutes"] = m.calculateAvgTradeDuration().Minutes()
	metrics["max_consecutive_wins"] = float64(m.calculateMaxConsecutiveWins())
	metrics["max_consecutive_losses"] = float64(m.calculateMaxConsecutiveLosses())

	// Costs
	metrics["total_commission"] = m.calculateTotalCommission()
	metrics["total_slippage"] = m.calculateTotalSlippage()

	return metrics
}

// countWinningTrades counts number of winning trades
func (m *MetricsCalculator) countWinningTrades() int {
	count := 0
	for _, trade := range m.trades {
		if trade.IsWinningTrade() {
			count++
		}
	}
	return count
}

// countLosingTrades counts number of losing trades
func (m *MetricsCalculator) countLosingTrades() int {
	count := 0
	for _, trade := range m.trades {
		if !trade.IsWinningTrade() {
			count++
		}
	}
	return count
}

// calculateWinRate calculates percentage of winning trades
func (m *MetricsCalculator) calculateWinRate() float64 {
	if len(m.trades) == 0 {
		return 0
	}
	return (float64(m.countWinningTrades()) / float64(len(m.trades))) * 100
}

// calculateGrossProfit calculates total profit from winning trades
func (m *MetricsCalculator) calculateGrossProfit() float64 {
	profit := 0.0
	for _, trade := range m.trades {
		if trade.NetProfit > 0 {
			profit += trade.NetProfit
		}
	}
	return profit
}

// calculateGrossLoss calculates total loss from losing trades
func (m *MetricsCalculator) calculateGrossLoss() float64 {
	loss := 0.0
	for _, trade := range m.trades {
		if trade.NetProfit < 0 {
			loss += math.Abs(trade.NetProfit)
		}
	}
	return loss
}

// calculateNetProfit calculates total net profit (wins - losses)
func (m *MetricsCalculator) calculateNetProfit() float64 {
	profit := 0.0
	for _, trade := range m.trades {
		profit += trade.NetProfit
	}
	return profit
}

// calculateProfitFactor calculates profit factor (gross profit / gross loss)
func (m *MetricsCalculator) calculateProfitFactor() float64 {
	grossProfit := m.calculateGrossProfit()
	grossLoss := m.calculateGrossLoss()

	if grossLoss == 0 {
		if grossProfit > 0 {
			return 999.99 // Infinite profit factor (no losses)
		}
		return 0
	}

	return grossProfit / grossLoss
}

// calculateAverageTrade calculates average profit per trade
func (m *MetricsCalculator) calculateAverageTrade() float64 {
	if len(m.trades) == 0 {
		return 0
	}
	return m.calculateNetProfit() / float64(len(m.trades))
}

// calculateAverageWin calculates average profit of winning trades
func (m *MetricsCalculator) calculateAverageWin() float64 {
	winCount := m.countWinningTrades()
	if winCount == 0 {
		return 0
	}
	return m.calculateGrossProfit() / float64(winCount)
}

// calculateAverageLoss calculates average loss of losing trades
func (m *MetricsCalculator) calculateAverageLoss() float64 {
	lossCount := m.countLosingTrades()
	if lossCount == 0 {
		return 0
	}
	return -m.calculateGrossLoss() / float64(lossCount)
}

// findLargestWin finds the largest winning trade
func (m *MetricsCalculator) findLargestWin() float64 {
	maxWin := 0.0
	for _, trade := range m.trades {
		if trade.NetProfit > maxWin {
			maxWin = trade.NetProfit
		}
	}
	return maxWin
}

// findLargestLoss finds the largest losing trade
func (m *MetricsCalculator) findLargestLoss() float64 {
	maxLoss := 0.0
	for _, trade := range m.trades {
		if trade.NetProfit < maxLoss {
			maxLoss = trade.NetProfit
		}
	}
	return maxLoss
}

// calculateMaxDrawdown calculates maximum drawdown in dollars
func (m *MetricsCalculator) calculateMaxDrawdown() float64 {
	if len(m.equityCurve) == 0 {
		return 0
	}

	maxDrawdown := 0.0
	peak := m.equityCurve[0].Equity

	for _, point := range m.equityCurve {
		if point.Equity > peak {
			peak = point.Equity
		}
		drawdown := peak - point.Equity
		if drawdown > maxDrawdown {
			maxDrawdown = drawdown
		}
	}

	return maxDrawdown
}

// calculateMaxDrawdownPct calculates maximum drawdown as percentage
func (m *MetricsCalculator) calculateMaxDrawdownPct() float64 {
	if len(m.equityCurve) == 0 {
		return 0
	}

	maxDrawdownPct := 0.0
	peak := m.equityCurve[0].Equity

	for _, point := range m.equityCurve {
		if point.Equity > peak {
			peak = point.Equity
		}
		if peak > 0 {
			drawdownPct := ((peak - point.Equity) / peak) * 100
			if drawdownPct > maxDrawdownPct {
				maxDrawdownPct = drawdownPct
			}
		}
	}

	return maxDrawdownPct
}

// calculateSharpeRatio calculates Sharpe ratio (risk-free rate = 0)
// Sharpe = (Average Return - Risk Free Rate) / Std Dev of Returns
func (m *MetricsCalculator) calculateSharpeRatio() float64 {
	if len(m.dailyStats) < 2 {
		return 0
	}

	// Calculate daily returns
	returns := make([]float64, 0, len(m.dailyStats))
	for _, day := range m.dailyStats {
		if day.StartingCash > 0 {
			dailyReturn := (day.PnL / day.StartingCash) * 100
			returns = append(returns, dailyReturn)
		}
	}

	if len(returns) < 2 {
		return 0
	}

	// Calculate average return
	avgReturn := 0.0
	for _, ret := range returns {
		avgReturn += ret
	}
	avgReturn /= float64(len(returns))

	// Calculate standard deviation
	variance := 0.0
	for _, ret := range returns {
		diff := ret - avgReturn
		variance += diff * diff
	}
	variance /= float64(len(returns) - 1)
	stdDev := math.Sqrt(variance)

	if stdDev == 0 {
		return 0
	}

	// Annualize (assuming 252 trading days)
	sharpe := (avgReturn / stdDev) * math.Sqrt(252)

	return sharpe
}

// calculateSortinoRatio calculates Sortino ratio (only penalizes downside volatility)
func (m *MetricsCalculator) calculateSortinoRatio() float64 {
	if len(m.dailyStats) < 2 {
		return 0
	}

	// Calculate daily returns
	returns := make([]float64, 0, len(m.dailyStats))
	for _, day := range m.dailyStats {
		if day.StartingCash > 0 {
			dailyReturn := (day.PnL / day.StartingCash) * 100
			returns = append(returns, dailyReturn)
		}
	}

	if len(returns) < 2 {
		return 0
	}

	// Calculate average return
	avgReturn := 0.0
	for _, ret := range returns {
		avgReturn += ret
	}
	avgReturn /= float64(len(returns))

	// Calculate downside deviation (only negative returns)
	downsideVariance := 0.0
	downsideCount := 0
	for _, ret := range returns {
		if ret < 0 {
			downsideVariance += ret * ret
			downsideCount++
		}
	}

	if downsideCount == 0 {
		return 999.99 // No downside
	}

	downsideVariance /= float64(downsideCount)
	downsideDev := math.Sqrt(downsideVariance)

	if downsideDev == 0 {
		return 0
	}

	// Annualize
	sortino := (avgReturn / downsideDev) * math.Sqrt(252)

	return sortino
}

// calculateCalmarRatio calculates Calmar ratio (return / max drawdown)
func (m *MetricsCalculator) calculateCalmarRatio() float64 {
	maxDD := m.calculateMaxDrawdownPct()
	if maxDD == 0 {
		return 0
	}

	// Calculate annualized return
	if len(m.equityCurve) < 2 {
		return 0
	}

	startEquity := m.equityCurve[0].Equity
	endEquity := m.equityCurve[len(m.equityCurve)-1].Equity
	totalReturn := ((endEquity - startEquity) / startEquity) * 100

	// Simple annualization (assumes full year)
	annualizedReturn := totalReturn

	return annualizedReturn / maxDD
}

// calculateAvgTradeDuration calculates average time trades are held
func (m *MetricsCalculator) calculateAvgTradeDuration() time.Duration {
	if len(m.trades) == 0 {
		return 0
	}

	totalDuration := time.Duration(0)
	for _, trade := range m.trades {
		totalDuration += trade.Duration
	}

	return totalDuration / time.Duration(len(m.trades))
}

// calculateMaxConsecutiveWins finds maximum consecutive winning trades
func (m *MetricsCalculator) calculateMaxConsecutiveWins() int {
	maxWins := 0
	currentWins := 0

	for _, trade := range m.trades {
		if trade.IsWinningTrade() {
			currentWins++
			if currentWins > maxWins {
				maxWins = currentWins
			}
		} else {
			currentWins = 0
		}
	}

	return maxWins
}

// calculateMaxConsecutiveLosses finds maximum consecutive losing trades
func (m *MetricsCalculator) calculateMaxConsecutiveLosses() int {
	maxLosses := 0
	currentLosses := 0

	for _, trade := range m.trades {
		if !trade.IsWinningTrade() {
			currentLosses++
			if currentLosses > maxLosses {
				maxLosses = currentLosses
			}
		} else {
			currentLosses = 0
		}
	}

	return maxLosses
}

// calculateTotalCommission sums all commission paid
func (m *MetricsCalculator) calculateTotalCommission() float64 {
	total := 0.0
	for _, trade := range m.trades {
		total += trade.Commission
	}
	return total
}

// calculateTotalSlippage sums all slippage incurred
func (m *MetricsCalculator) calculateTotalSlippage() float64 {
	total := 0.0
	for _, trade := range m.trades {
		total += trade.Slippage
	}
	return total
}
