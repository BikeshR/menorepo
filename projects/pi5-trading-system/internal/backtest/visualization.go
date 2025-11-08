package backtest

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// EquityCurvePoint represents a point on the equity curve
type EquityCurvePoint struct {
	Timestamp      time.Time `json:"timestamp"`
	Equity         float64   `json:"equity"`
	Cash           float64   `json:"cash"`
	Drawdown       float64   `json:"drawdown"`
	DrawdownPct    float64   `json:"drawdown_pct"`
	CumulativeReturn float64 `json:"cumulative_return"`
}

// DrawdownPeriod represents a drawdown period
type DrawdownPeriod struct {
	StartTime    time.Time `json:"start_time"`
	EndTime      time.Time `json:"end_time"`
	RecoveryTime time.Time `json:"recovery_time,omitempty"`
	PeakEquity   float64   `json:"peak_equity"`
	TroughEquity float64   `json:"trough_equity"`
	MaxDrawdown  float64   `json:"max_drawdown"`
	MaxDrawdownPct float64 `json:"max_drawdown_pct"`
	Duration     string    `json:"duration"`
	Recovered    bool      `json:"recovered"`
}

// VisualizationData holds all data needed for visualization
type VisualizationData struct {
	// Equity curve
	EquityCurve []EquityCurvePoint `json:"equity_curve"`

	// Drawdown periods
	DrawdownPeriods []DrawdownPeriod `json:"drawdown_periods"`

	// Trade distribution
	WinDistribution  []float64 `json:"win_distribution"`
	LossDistribution []float64 `json:"loss_distribution"`

	// Monthly returns
	MonthlyReturns map[string]float64 `json:"monthly_returns"`

	// Metadata
	Symbol         string    `json:"symbol"`
	InitialCapital float64   `json:"initial_capital"`
	FinalCapital   float64   `json:"final_capital"`
	StartDate      time.Time `json:"start_date"`
	EndDate        time.Time `json:"end_date"`
}

// GenerateVisualizationData creates visualization data from backtest results
func GenerateVisualizationData(result *BacktestResult) *VisualizationData {
	viz := &VisualizationData{
		Symbol:         result.Config.Symbol,
		InitialCapital: result.InitialCapital,
		FinalCapital:   result.FinalCapital,
		StartDate:      result.StartDate,
		EndDate:        result.EndDate,
		MonthlyReturns: make(map[string]float64),
	}

	// Generate equity curve with drawdown
	viz.EquityCurve = generateEquityCurveData(result)

	// Identify drawdown periods
	viz.DrawdownPeriods = identifyDrawdownPeriods(viz.EquityCurve)

	// Extract win/loss distributions
	viz.WinDistribution, viz.LossDistribution = extractTradeDistributions(result.Trades)

	// Calculate monthly returns
	viz.MonthlyReturns = calculateMonthlyReturns(result.DailyStats)

	return viz
}

// generateEquityCurveData creates equity curve points with drawdown calculations
func generateEquityCurveData(result *BacktestResult) []EquityCurvePoint {
	points := make([]EquityCurvePoint, len(result.EquityCurve))

	peak := result.InitialCapital
	for i, ep := range result.EquityCurve {
		if ep.Equity > peak {
			peak = ep.Equity
		}

		drawdown := peak - ep.Equity
		drawdownPct := 0.0
		if peak > 0 {
			drawdownPct = (drawdown / peak) * 100
		}

		cumulativeReturn := ((ep.Equity - result.InitialCapital) / result.InitialCapital) * 100

		points[i] = EquityCurvePoint{
			Timestamp:        ep.Timestamp,
			Equity:           ep.Equity,
			Cash:             ep.Cash,
			Drawdown:         drawdown,
			DrawdownPct:      drawdownPct,
			CumulativeReturn: cumulativeReturn,
		}
	}

	return points
}

// identifyDrawdownPeriods identifies significant drawdown periods
func identifyDrawdownPeriods(curve []EquityCurvePoint) []DrawdownPeriod {
	if len(curve) == 0 {
		return nil
	}

	periods := make([]DrawdownPeriod, 0)
	var currentPeriod *DrawdownPeriod
	peak := curve[0].Equity
	peakTime := curve[0].Timestamp

	for _, point := range curve {
		if point.Equity > peak {
			// New peak - end current drawdown if any
			if currentPeriod != nil {
				currentPeriod.RecoveryTime = point.Timestamp
				currentPeriod.Recovered = true
				currentPeriod.Duration = currentPeriod.RecoveryTime.Sub(currentPeriod.StartTime).String()
				periods = append(periods, *currentPeriod)
				currentPeriod = nil
			}
			peak = point.Equity
			peakTime = point.Timestamp
		} else if point.Equity < peak {
			// In drawdown
			if currentPeriod == nil {
				// Start new drawdown period
				currentPeriod = &DrawdownPeriod{
					StartTime:  peakTime,
					PeakEquity: peak,
				}
			}

			// Update trough if this is a new low
			if point.Equity < currentPeriod.TroughEquity || currentPeriod.TroughEquity == 0 {
				currentPeriod.TroughEquity = point.Equity
				currentPeriod.EndTime = point.Timestamp
				drawdown := peak - point.Equity
				currentPeriod.MaxDrawdown = drawdown
				currentPeriod.MaxDrawdownPct = (drawdown / peak) * 100
			}
		}
	}

	// Handle unclosed drawdown
	if currentPeriod != nil {
		currentPeriod.Recovered = false
		currentPeriod.Duration = curve[len(curve)-1].Timestamp.Sub(currentPeriod.StartTime).String()
		periods = append(periods, *currentPeriod)
	}

	return periods
}

// extractTradeDistributions separates wins and losses for distribution analysis
func extractTradeDistributions(trades []Trade) ([]float64, []float64) {
	wins := make([]float64, 0)
	losses := make([]float64, 0)

	for _, trade := range trades {
		if trade.IsWinningTrade() {
			wins = append(wins, trade.NetProfit)
		} else {
			losses = append(losses, trade.NetProfit)
		}
	}

	return wins, losses
}

// calculateMonthlyReturns calculates returns by month
func calculateMonthlyReturns(dailyStats []DailyStats) map[string]float64 {
	monthlyReturns := make(map[string]float64)

	for _, day := range dailyStats {
		monthKey := day.Date.Format("2006-01")
		monthlyReturns[monthKey] += day.PnL
	}

	return monthlyReturns
}

// ExportToJSON exports visualization data to JSON file
func (viz *VisualizationData) ExportToJSON(filepath string) error {
	data, err := json.MarshalIndent(viz, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	if err := os.WriteFile(filepath, data, 0644); err != nil {
		return fmt.Errorf("failed to write JSON file: %w", err)
	}

	return nil
}

// ExportEquityCurveToCSV exports equity curve to CSV file
func (viz *VisualizationData) ExportEquityCurveToCSV(filepath string) error {
	file, err := os.Create(filepath)
	if err != nil {
		return fmt.Errorf("failed to create CSV file: %w", err)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write header
	header := []string{"Timestamp", "Equity", "Cash", "Drawdown", "DrawdownPct", "CumulativeReturn"}
	if err := writer.Write(header); err != nil {
		return err
	}

	// Write data
	for _, point := range viz.EquityCurve {
		row := []string{
			point.Timestamp.Format(time.RFC3339),
			fmt.Sprintf("%.2f", point.Equity),
			fmt.Sprintf("%.2f", point.Cash),
			fmt.Sprintf("%.2f", point.Drawdown),
			fmt.Sprintf("%.2f", point.DrawdownPct),
			fmt.Sprintf("%.2f", point.CumulativeReturn),
		}
		if err := writer.Write(row); err != nil {
			return err
		}
	}

	return nil
}

// ExportTradesToCSV exports trades to CSV file
func ExportTradesToCSV(trades []Trade, filepath string) error {
	file, err := os.Create(filepath)
	if err != nil {
		return fmt.Errorf("failed to create CSV file: %w", err)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write header
	header := []string{
		"TradeID", "Symbol", "Side",
		"EntryTime", "EntryPrice", "EntryQty",
		"ExitTime", "ExitPrice", "ExitQty",
		"GrossProfit", "NetProfit", "Commission", "Slippage",
		"ReturnPct", "Duration", "EntryReason", "ExitReason",
	}
	if err := writer.Write(header); err != nil {
		return err
	}

	// Write trades
	for _, trade := range trades {
		row := []string{
			fmt.Sprintf("%d", trade.TradeID),
			trade.Symbol,
			trade.Side,
			trade.EntryTime.Format(time.RFC3339),
			fmt.Sprintf("%.2f", trade.EntryPrice),
			fmt.Sprintf("%d", trade.EntryQty),
			trade.ExitTime.Format(time.RFC3339),
			fmt.Sprintf("%.2f", trade.ExitPrice),
			fmt.Sprintf("%d", trade.ExitQty),
			fmt.Sprintf("%.2f", trade.GrossProfit),
			fmt.Sprintf("%.2f", trade.NetProfit),
			fmt.Sprintf("%.2f", trade.Commission),
			fmt.Sprintf("%.2f", trade.Slippage),
			fmt.Sprintf("%.2f", trade.ReturnPct),
			trade.Duration.String(),
			trade.EntryReason,
			trade.ExitReason,
		}
		if err := writer.Write(row); err != nil {
			return err
		}
	}

	return nil
}

// ExportMonthlyReturnsToCSV exports monthly returns to CSV
func (viz *VisualizationData) ExportMonthlyReturnsToCSV(filepath string) error {
	file, err := os.Create(filepath)
	if err != nil {
		return fmt.Errorf("failed to create CSV file: %w", err)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write header
	header := []string{"Month", "Return"}
	if err := writer.Write(header); err != nil {
		return err
	}

	// Write data
	for month, returns := range viz.MonthlyReturns {
		row := []string{month, fmt.Sprintf("%.2f", returns)}
		if err := writer.Write(row); err != nil {
			return err
		}
	}

	return nil
}

// ExportAllVisualizationData exports all visualization data to files
func ExportAllVisualizationData(result *BacktestResult, outputDir string) error {
	// Create output directory
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Generate visualization data
	viz := GenerateVisualizationData(result)

	// Export to JSON
	jsonPath := filepath.Join(outputDir, "visualization_data.json")
	if err := viz.ExportToJSON(jsonPath); err != nil {
		return fmt.Errorf("failed to export JSON: %w", err)
	}

	// Export equity curve to CSV
	equityPath := filepath.Join(outputDir, "equity_curve.csv")
	if err := viz.ExportEquityCurveToCSV(equityPath); err != nil {
		return fmt.Errorf("failed to export equity curve: %w", err)
	}

	// Export trades to CSV
	tradesPath := filepath.Join(outputDir, "trades.csv")
	if err := ExportTradesToCSV(result.Trades, tradesPath); err != nil {
		return fmt.Errorf("failed to export trades: %w", err)
	}

	// Export monthly returns to CSV
	monthlyPath := filepath.Join(outputDir, "monthly_returns.csv")
	if err := viz.ExportMonthlyReturnsToCSV(monthlyPath); err != nil {
		return fmt.Errorf("failed to export monthly returns: %w", err)
	}

	return nil
}

// GeneratePythonPlotScript generates a Python script for plotting
func GeneratePythonPlotScript(outputDir string) error {
	script := `#!/usr/bin/env python3
"""
Backtesting Visualization Script
Plots equity curve, drawdown, and trade distributions
Requires: pandas, matplotlib, seaborn

Usage: python plot_backtest.py
"""

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

# Set style
sns.set_style("darkgrid")
plt.rcParams['figure.figsize'] = (14, 10)

# Load data
equity_df = pd.read_csv('equity_curve.csv', parse_dates=['Timestamp'])
trades_df = pd.read_csv('trades.csv', parse_dates=['EntryTime', 'ExitTime'])

# Create subplots
fig, axes = plt.subplots(3, 2, figsize=(16, 12))
fig.suptitle('Backtest Results Visualization', fontsize=16, fontweight='bold')

# 1. Equity Curve
ax = axes[0, 0]
ax.plot(equity_df['Timestamp'], equity_df['Equity'], linewidth=2, color='#2E86AB')
ax.set_title('Equity Curve')
ax.set_xlabel('Date')
ax.set_ylabel('Equity ($)')
ax.grid(True, alpha=0.3)

# 2. Cumulative Returns
ax = axes[0, 1]
ax.plot(equity_df['Timestamp'], equity_df['CumulativeReturn'], linewidth=2, color='#06A77D')
ax.axhline(y=0, color='red', linestyle='--', alpha=0.5)
ax.set_title('Cumulative Returns')
ax.set_xlabel('Date')
ax.set_ylabel('Return (%)')
ax.grid(True, alpha=0.3)

# 3. Drawdown
ax = axes[1, 0]
ax.fill_between(equity_df['Timestamp'], 0, -equity_df['DrawdownPct'],
                color='#D64933', alpha=0.6)
ax.set_title('Drawdown')
ax.set_xlabel('Date')
ax.set_ylabel('Drawdown (%)')
ax.grid(True, alpha=0.3)

# 4. Trade P&L Distribution
ax = axes[1, 1]
trades_df['NetProfit'].hist(bins=30, ax=ax, color='#2E86AB', alpha=0.7, edgecolor='black')
ax.axvline(x=0, color='red', linestyle='--', linewidth=2)
ax.set_title('Trade P&L Distribution')
ax.set_xlabel('Net Profit ($)')
ax.set_ylabel('Frequency')
ax.grid(True, alpha=0.3)

# 5. Trade Returns %
ax = axes[2, 0]
trades_df['ReturnPct'].hist(bins=30, ax=ax, color='#06A77D', alpha=0.7, edgecolor='black')
ax.axvline(x=0, color='red', linestyle='--', linewidth=2)
ax.set_title('Trade Returns Distribution')
ax.set_xlabel('Return (%)')
ax.set_ylabel('Frequency')
ax.grid(True, alpha=0.3)

# 6. Win/Loss by Month
ax = axes[2, 1]
trades_df['Month'] = pd.to_datetime(trades_df['EntryTime']).dt.to_period('M')
monthly_pnl = trades_df.groupby('Month')['NetProfit'].sum()
monthly_pnl.plot(kind='bar', ax=ax, color=['#06A77D' if x > 0 else '#D64933' for x in monthly_pnl])
ax.set_title('Monthly P&L')
ax.set_xlabel('Month')
ax.set_ylabel('Net Profit ($)')
ax.grid(True, alpha=0.3)
plt.xticks(rotation=45)

plt.tight_layout()
plt.savefig('backtest_visualization.png', dpi=300, bbox_inches='tight')
print("Visualization saved to backtest_visualization.png")
plt.show()
`

	scriptPath := filepath.Join(outputDir, "plot_backtest.py")
	if err := os.WriteFile(scriptPath, []byte(script), 0755); err != nil {
		return fmt.Errorf("failed to write plot script: %w", err)
	}

	return nil
}
