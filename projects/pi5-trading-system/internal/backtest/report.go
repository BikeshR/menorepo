package backtest

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ReportGenerator generates backtest reports
type ReportGenerator struct {
	result *BacktestResult
}

// NewReportGenerator creates a new report generator
func NewReportGenerator(result *BacktestResult) *ReportGenerator {
	return &ReportGenerator{
		result: result,
	}
}

// GenerateConsoleReport prints a formatted report to console
func (r *ReportGenerator) GenerateConsoleReport() string {
	var sb strings.Builder

	sb.WriteString("\n")
	sb.WriteString("═══════════════════════════════════════════════════════════════════════════════\n")
	sb.WriteString("                           BACKTEST RESULTS                                     \n")
	sb.WriteString("═══════════════════════════════════════════════════════════════════════════════\n")
	sb.WriteString("\n")

	// Configuration
	sb.WriteString("CONFIGURATION\n")
	sb.WriteString("─────────────────────────────────────────────────────────────────────────────\n")
	sb.WriteString(fmt.Sprintf("Symbol:           %s\n", r.result.Config.Symbol))
	sb.WriteString(fmt.Sprintf("Timeframe:        %s\n", r.result.Config.Timeframe))
	sb.WriteString(fmt.Sprintf("Start Date:       %s\n", r.result.StartDate.Format("2006-01-02")))
	sb.WriteString(fmt.Sprintf("End Date:         %s\n", r.result.EndDate.Format("2006-01-02")))
	sb.WriteString(fmt.Sprintf("Duration:         %d days\n", int(r.result.Duration.Hours()/24)))
	sb.WriteString(fmt.Sprintf("Initial Capital:  $%.2f\n", r.result.InitialCapital))
	sb.WriteString("\n")

	// Overall Performance
	sb.WriteString("OVERALL PERFORMANCE\n")
	sb.WriteString("─────────────────────────────────────────────────────────────────────────────\n")
	sb.WriteString(fmt.Sprintf("Final Capital:    $%.2f\n", r.result.FinalCapital))
	sb.WriteString(fmt.Sprintf("Total Return:     $%.2f (%.2f%%)\n", r.result.TotalReturn, r.result.TotalReturnPct))
	sb.WriteString(fmt.Sprintf("Net Profit:       $%.2f\n", r.result.NetProfit))
	sb.WriteString("\n")

	// Trade Statistics
	sb.WriteString("TRADE STATISTICS\n")
	sb.WriteString("─────────────────────────────────────────────────────────────────────────────\n")
	sb.WriteString(fmt.Sprintf("Total Trades:     %d\n", r.result.TotalTrades))
	sb.WriteString(fmt.Sprintf("Winning Trades:   %d (%.1f%%)\n", r.result.WinningTrades, r.result.WinRate))
	sb.WriteString(fmt.Sprintf("Losing Trades:    %d (%.1f%%)\n", r.result.LosingTrades, 100-r.result.WinRate))
	sb.WriteString(fmt.Sprintf("Avg Trade:        $%.2f\n", r.result.AverageTrade))
	sb.WriteString(fmt.Sprintf("Avg Win:          $%.2f\n", r.result.AverageWin))
	sb.WriteString(fmt.Sprintf("Avg Loss:         $%.2f\n", r.result.AverageLoss))
	sb.WriteString(fmt.Sprintf("Largest Win:      $%.2f\n", r.result.LargestWin))
	sb.WriteString(fmt.Sprintf("Largest Loss:     $%.2f\n", r.result.LargestLoss))
	sb.WriteString(fmt.Sprintf("Avg Duration:     %s\n", r.formatDuration(r.result.AvgTradeDuration)))
	sb.WriteString("\n")

	// Profit Metrics
	sb.WriteString("PROFIT METRICS\n")
	sb.WriteString("─────────────────────────────────────────────────────────────────────────────\n")
	sb.WriteString(fmt.Sprintf("Gross Profit:     $%.2f\n", r.result.GrossProfit))
	sb.WriteString(fmt.Sprintf("Gross Loss:       $%.2f\n", r.result.GrossLoss))
	sb.WriteString(fmt.Sprintf("Profit Factor:    %.2f\n", r.result.ProfitFactor))
	sb.WriteString(fmt.Sprintf("Total Commission: $%.2f\n", r.result.TotalCommission))
	sb.WriteString(fmt.Sprintf("Total Slippage:   $%.2f\n", r.result.TotalSlippage))
	sb.WriteString("\n")

	// Risk Metrics
	sb.WriteString("RISK METRICS\n")
	sb.WriteString("─────────────────────────────────────────────────────────────────────────────\n")
	sb.WriteString(fmt.Sprintf("Max Drawdown:     $%.2f (%.2f%%)\n", r.result.MaxDrawdown, r.result.MaxDrawdownPct))
	sb.WriteString(fmt.Sprintf("Sharpe Ratio:     %.2f\n", r.result.SharpeRatio))
	sb.WriteString(fmt.Sprintf("Sortino Ratio:    %.2f\n", r.result.SortinoRatio))
	sb.WriteString(fmt.Sprintf("Calmar Ratio:     %.2f\n", r.result.CalmarRatio))
	sb.WriteString(fmt.Sprintf("Max Consecutive Wins:   %d\n", r.result.MaxConsecutiveWins))
	sb.WriteString(fmt.Sprintf("Max Consecutive Losses: %d\n", r.result.MaxConsecutiveLosses))
	sb.WriteString("\n")

	// Performance Summary
	sb.WriteString("PERFORMANCE SUMMARY\n")
	sb.WriteString("─────────────────────────────────────────────────────────────────────────────\n")
	sb.WriteString(r.getPerformanceGrade())
	sb.WriteString("\n")

	sb.WriteString("═══════════════════════════════════════════════════════════════════════════════\n")
	sb.WriteString(fmt.Sprintf("Backtest completed in %s\n", r.result.BacktestDuration.Round(time.Millisecond)))
	sb.WriteString("═══════════════════════════════════════════════════════════════════════════════\n")

	return sb.String()
}

// GenerateTradeLog creates a detailed trade-by-trade log
func (r *ReportGenerator) GenerateTradeLog() string {
	var sb strings.Builder

	sb.WriteString("\n")
	sb.WriteString("DETAILED TRADE LOG\n")
	sb.WriteString("═══════════════════════════════════════════════════════════════════════════════\n")
	sb.WriteString("\n")

	if len(r.result.Trades) == 0 {
		sb.WriteString("No trades executed\n")
		return sb.String()
	}

	for i, trade := range r.result.Trades {
		sb.WriteString(fmt.Sprintf("Trade #%d\n", i+1))
		sb.WriteString("─────────────────────────────────────────────────────────────────────────────\n")
		sb.WriteString(fmt.Sprintf("Symbol:      %s\n", trade.Symbol))
		sb.WriteString(fmt.Sprintf("Side:        %s\n", trade.Side))
		sb.WriteString(fmt.Sprintf("Entry:       %s @ $%.2f (qty: %d)\n",
			trade.EntryTime.Format("2006-01-02 15:04:05"),
			trade.EntryPrice,
			trade.EntryQty))
		sb.WriteString(fmt.Sprintf("Exit:        %s @ $%.2f (qty: %d)\n",
			trade.ExitTime.Format("2006-01-02 15:04:05"),
			trade.ExitPrice,
			trade.ExitQty))
		sb.WriteString(fmt.Sprintf("Duration:    %s\n", r.formatDuration(trade.Duration)))
		sb.WriteString(fmt.Sprintf("Net P&L:     $%.2f (%.2f%%)\n", trade.NetProfit, trade.ReturnPct))
		sb.WriteString(fmt.Sprintf("Commission:  $%.2f\n", trade.Commission))
		sb.WriteString(fmt.Sprintf("Entry Reason: %s\n", trade.EntryReason))
		sb.WriteString(fmt.Sprintf("Exit Reason:  %s\n", trade.ExitReason))

		// Add win/loss indicator
		if trade.IsWinningTrade() {
			sb.WriteString("Result:      ✓ WIN\n")
		} else {
			sb.WriteString("Result:      ✗ LOSS\n")
		}

		sb.WriteString("\n")
	}

	return sb.String()
}

// GenerateDailyStats creates a daily performance summary
func (r *ReportGenerator) GenerateDailyStats() string {
	var sb strings.Builder

	sb.WriteString("\n")
	sb.WriteString("DAILY PERFORMANCE\n")
	sb.WriteString("═══════════════════════════════════════════════════════════════════════════════\n")
	sb.WriteString("\n")

	if len(r.result.DailyStats) == 0 {
		sb.WriteString("No daily statistics available\n")
		return sb.String()
	}

	sb.WriteString(fmt.Sprintf("%-12s %12s %12s %12s %7s %5s %5s\n",
		"Date", "Starting", "Ending", "P&L", "P&L%", "Trades", "W/L"))
	sb.WriteString("─────────────────────────────────────────────────────────────────────────────\n")

	for _, day := range r.result.DailyStats {
		sb.WriteString(fmt.Sprintf("%-12s $%11.2f $%11.2f $%11.2f %6.2f%% %5d %2d/%2d\n",
			day.Date.Format("2006-01-02"),
			day.StartingCash,
			day.EndingCash,
			day.PnL,
			day.PnLPct,
			day.Trades,
			day.Wins,
			day.Losses))
	}

	sb.WriteString("\n")
	return sb.String()
}

// SaveToFile saves the report to a file
func (r *ReportGenerator) SaveToFile(outputDir string) error {
	// Create output directory if it doesn't exist
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Generate filename with timestamp
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("backtest_%s_%s.txt", r.result.Config.Symbol, timestamp)
	filepath := filepath.Join(outputDir, filename)

	// Generate full report
	var report strings.Builder
	report.WriteString(r.GenerateConsoleReport())
	report.WriteString("\n")
	report.WriteString(r.GenerateDailyStats())
	report.WriteString("\n")
	report.WriteString(r.GenerateTradeLog())

	// Write to file
	if err := os.WriteFile(filepath, []byte(report.String()), 0644); err != nil {
		return fmt.Errorf("failed to write report file: %w", err)
	}

	return nil
}

// getPerformanceGrade provides a qualitative assessment
func (r *ReportGenerator) getPerformanceGrade() string {
	var sb strings.Builder

	// Profit Factor
	if r.result.ProfitFactor >= 2.0 {
		sb.WriteString("✓ Profit Factor: EXCELLENT (>= 2.0)\n")
	} else if r.result.ProfitFactor >= 1.5 {
		sb.WriteString("✓ Profit Factor: GOOD (>= 1.5)\n")
	} else if r.result.ProfitFactor >= 1.0 {
		sb.WriteString("⚠ Profit Factor: BREAK-EVEN (>= 1.0)\n")
	} else {
		sb.WriteString("✗ Profit Factor: POOR (< 1.0)\n")
	}

	// Win Rate
	if r.result.WinRate >= 60 {
		sb.WriteString("✓ Win Rate: EXCELLENT (>= 60%)\n")
	} else if r.result.WinRate >= 50 {
		sb.WriteString("✓ Win Rate: GOOD (>= 50%)\n")
	} else if r.result.WinRate >= 40 {
		sb.WriteString("⚠ Win Rate: FAIR (>= 40%)\n")
	} else {
		sb.WriteString("✗ Win Rate: POOR (< 40%)\n")
	}

	// Sharpe Ratio
	if r.result.SharpeRatio >= 2.0 {
		sb.WriteString("✓ Sharpe Ratio: EXCELLENT (>= 2.0)\n")
	} else if r.result.SharpeRatio >= 1.0 {
		sb.WriteString("✓ Sharpe Ratio: GOOD (>= 1.0)\n")
	} else if r.result.SharpeRatio >= 0.5 {
		sb.WriteString("⚠ Sharpe Ratio: FAIR (>= 0.5)\n")
	} else {
		sb.WriteString("✗ Sharpe Ratio: POOR (< 0.5)\n")
	}

	// Max Drawdown
	if r.result.MaxDrawdownPct <= 10 {
		sb.WriteString("✓ Max Drawdown: EXCELLENT (<= 10%)\n")
	} else if r.result.MaxDrawdownPct <= 20 {
		sb.WriteString("✓ Max Drawdown: GOOD (<= 20%)\n")
	} else if r.result.MaxDrawdownPct <= 30 {
		sb.WriteString("⚠ Max Drawdown: FAIR (<= 30%)\n")
	} else {
		sb.WriteString("✗ Max Drawdown: POOR (> 30%)\n")
	}

	// Total Return
	if r.result.TotalReturnPct >= 20 {
		sb.WriteString("✓ Total Return: EXCELLENT (>= 20%)\n")
	} else if r.result.TotalReturnPct >= 10 {
		sb.WriteString("✓ Total Return: GOOD (>= 10%)\n")
	} else if r.result.TotalReturnPct >= 0 {
		sb.WriteString("⚠ Total Return: FAIR (>= 0%)\n")
	} else {
		sb.WriteString("✗ Total Return: LOSS (< 0%)\n")
	}

	return sb.String()
}

// formatDuration formats a duration in a human-readable way
func (r *ReportGenerator) formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm %ds", int(d.Minutes()), int(d.Seconds())%60)
	}
	hours := int(d.Hours())
	minutes := int(d.Minutes()) % 60
	if hours < 24 {
		return fmt.Sprintf("%dh %dm", hours, minutes)
	}
	days := hours / 24
	hours = hours % 24
	return fmt.Sprintf("%dd %dh", days, hours)
}
