package risk

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"github.com/bikeshrana/pi5-trading-system-go/internal/data"
)

// RiskLimits defines risk management limits
type RiskLimits struct {
	// Position limits
	MaxPositionSize      int     // Maximum quantity for a single position
	MaxPositionValue     float64 // Maximum dollar value for a single position
	MaxConcentration     float64 // Maximum % of portfolio in one symbol (0.0-1.0)

	// Portfolio limits
	MaxTotalExposure     float64 // Maximum total portfolio exposure
	MaxDailyLoss         float64 // Maximum allowed loss in a day
	MaxDrawdown          float64 // Maximum allowed drawdown from peak

	// Trading limits
	MaxOrdersPerDay      int     // Maximum number of orders per day
	MaxOrderSize         int     // Maximum size for a single order
	MaxOrderValue        float64 // Maximum dollar value for a single order

	// Margin requirements
	MinCashBalance       float64 // Minimum cash balance required
	MarginRequirement    float64 // Margin requirement (e.g., 0.5 = 50%)

	// Trading hours
	AllowAfterHours      bool
	TradingStartHour     int // 0-23
	TradingEndHour       int // 0-23
}

// RiskManager handles risk management and order validation
type RiskManager struct {
	logger          zerolog.Logger
	limits          RiskLimits
	portfolioRepo   *data.PortfolioRepository
	ordersRepo      *data.OrdersRepository

	// Tracking
	metricsLock     sync.RWMutex
	ordersToday     int
	dailyPnL        float64
	peakPortfolio   float64
	lastResetDate   time.Time
}

// OrderRequest represents an order to be validated
type OrderRequest struct {
	Symbol    string
	Action    string  // "BUY" or "SELL"
	Quantity  int
	Price     float64
	OrderType string  // "MARKET" or "LIMIT"
}

// RiskCheckResult represents the result of a risk check
type RiskCheckResult struct {
	Approved      bool
	Reason        string
	RiskScore     float64 // 0.0-1.0, higher is riskier
	Warnings      []string
	Rejections    []string
}

// NewRiskManager creates a new risk manager
func NewRiskManager(
	limits RiskLimits,
	portfolioRepo *data.PortfolioRepository,
	ordersRepo *data.OrdersRepository,
	logger zerolog.Logger,
) *RiskManager {
	return &RiskManager{
		logger:        logger,
		limits:        limits,
		portfolioRepo: portfolioRepo,
		ordersRepo:    ordersRepo,
		lastResetDate: time.Now(),
	}
}

// ValidateOrder validates an order against risk limits
func (rm *RiskManager) ValidateOrder(ctx context.Context, order *OrderRequest) (*RiskCheckResult, error) {
	result := &RiskCheckResult{
		Approved:   true,
		Warnings:   make([]string, 0),
		Rejections: make([]string, 0),
	}

	// Reset daily metrics if needed
	rm.resetDailyMetricsIfNeeded()

	// Check trading hours
	if err := rm.checkTradingHours(result); err != nil {
		return result, err
	}

	// Check order size limits
	if err := rm.checkOrderSize(order, result); err != nil {
		return result, err
	}

	// Check position limits
	if err := rm.checkPositionLimits(ctx, order, result); err != nil {
		return result, err
	}

	// Check portfolio limits
	if err := rm.checkPortfolioLimits(ctx, order, result); err != nil {
		return result, err
	}

	// Check daily trading limits
	if err := rm.checkDailyLimits(result); err != nil {
		return result, err
	}

	// Check margin requirements
	if err := rm.checkMarginRequirements(ctx, order, result); err != nil {
		return result, err
	}

	// Calculate risk score
	result.RiskScore = rm.calculateRiskScore(order, result)

	// Determine final approval
	result.Approved = len(result.Rejections) == 0

	if !result.Approved {
		rm.logger.Warn().
			Str("symbol", order.Symbol).
			Str("action", order.Action).
			Int("quantity", order.Quantity).
			Strs("rejections", result.Rejections).
			Msg("Order rejected by risk management")
	} else if len(result.Warnings) > 0 {
		rm.logger.Info().
			Str("symbol", order.Symbol).
			Str("action", order.Action).
			Int("quantity", order.Quantity).
			Strs("warnings", result.Warnings).
			Msg("Order approved with warnings")
	}

	return result, nil
}

// checkTradingHours validates trading hours
func (rm *RiskManager) checkTradingHours(result *RiskCheckResult) error {
	if !rm.limits.AllowAfterHours {
		now := time.Now()
		hour := now.Hour()

		if hour < rm.limits.TradingStartHour || hour >= rm.limits.TradingEndHour {
			result.Rejections = append(result.Rejections,
				fmt.Sprintf("Trading not allowed outside hours %d:00-%d:00",
					rm.limits.TradingStartHour, rm.limits.TradingEndHour))
		}
	}
	return nil
}

// checkOrderSize validates order size limits
func (rm *RiskManager) checkOrderSize(order *OrderRequest, result *RiskCheckResult) error {
	// Check quantity limit
	if rm.limits.MaxOrderSize > 0 && order.Quantity > rm.limits.MaxOrderSize {
		result.Rejections = append(result.Rejections,
			fmt.Sprintf("Order size %d exceeds maximum %d", order.Quantity, rm.limits.MaxOrderSize))
	}

	// Check order value limit
	orderValue := float64(order.Quantity) * order.Price
	if rm.limits.MaxOrderValue > 0 && orderValue > rm.limits.MaxOrderValue {
		result.Rejections = append(result.Rejections,
			fmt.Sprintf("Order value $%.2f exceeds maximum $%.2f", orderValue, rm.limits.MaxOrderValue))
	}

	return nil
}

// checkPositionLimits validates position size and concentration limits
func (rm *RiskManager) checkPositionLimits(ctx context.Context, order *OrderRequest, result *RiskCheckResult) error {
	// Get current position
	position, err := rm.portfolioRepo.GetPosition(ctx, order.Symbol)
	if err != nil {
		// No existing position is fine for new positions
		position = &data.Position{
			Symbol:   order.Symbol,
			Quantity: 0,
		}
	}

	// Calculate new position after order
	var newQuantity float64
	if order.Action == "BUY" {
		newQuantity = position.Quantity + float64(order.Quantity)
	} else {
		newQuantity = position.Quantity - float64(order.Quantity)
	}

	// Check max position size
	if rm.limits.MaxPositionSize > 0 && int(newQuantity) > rm.limits.MaxPositionSize {
		result.Rejections = append(result.Rejections,
			fmt.Sprintf("New position size %d exceeds maximum %d", int(newQuantity), rm.limits.MaxPositionSize))
	}

	// Check max position value
	newValue := newQuantity * order.Price
	if rm.limits.MaxPositionValue > 0 && newValue > rm.limits.MaxPositionValue {
		result.Rejections = append(result.Rejections,
			fmt.Sprintf("New position value $%.2f exceeds maximum $%.2f", newValue, rm.limits.MaxPositionValue))
	}

	// Check concentration limit
	if rm.limits.MaxConcentration > 0 && order.Action == "BUY" {
		summary, err := rm.portfolioRepo.GetSummary(ctx)
		if err == nil && summary.TotalValue > 0 {
			concentration := newValue / summary.TotalValue
			if concentration > rm.limits.MaxConcentration {
				result.Warnings = append(result.Warnings,
					fmt.Sprintf("Position concentration %.1f%% exceeds recommended %.1f%%",
						concentration*100, rm.limits.MaxConcentration*100))
			}
		}
	}

	return nil
}

// checkPortfolioLimits validates portfolio-level limits
func (rm *RiskManager) checkPortfolioLimits(ctx context.Context, order *OrderRequest, result *RiskCheckResult) error {
	summary, err := rm.portfolioRepo.GetSummary(ctx)
	if err != nil {
		rm.logger.Warn().Err(err).Msg("Failed to get portfolio summary for risk check")
		return nil
	}

	// Check daily loss limit
	if rm.limits.MaxDailyLoss > 0 {
		if rm.dailyPnL < -rm.limits.MaxDailyLoss {
			result.Rejections = append(result.Rejections,
				fmt.Sprintf("Daily loss limit exceeded: $%.2f", rm.dailyPnL))
		}
	}

	// Check drawdown limit
	if rm.limits.MaxDrawdown > 0 {
		if summary.TotalValue > rm.peakPortfolio {
			rm.peakPortfolio = summary.TotalValue
		}
		drawdown := (rm.peakPortfolio - summary.TotalValue) / rm.peakPortfolio
		if drawdown > rm.limits.MaxDrawdown {
			result.Rejections = append(result.Rejections,
				fmt.Sprintf("Drawdown %.1f%% exceeds maximum %.1f%%",
					drawdown*100, rm.limits.MaxDrawdown*100))
		}
	}

	// Check total exposure
	if rm.limits.MaxTotalExposure > 0 {
		orderValue := float64(order.Quantity) * order.Price
		var newExposure float64
		if order.Action == "BUY" {
			newExposure = summary.TotalValue + orderValue
		} else {
			newExposure = summary.TotalValue
		}

		if newExposure > rm.limits.MaxTotalExposure {
			result.Rejections = append(result.Rejections,
				fmt.Sprintf("Total exposure $%.2f exceeds maximum $%.2f",
					newExposure, rm.limits.MaxTotalExposure))
		}
	}

	return nil
}

// checkDailyLimits validates daily trading limits
func (rm *RiskManager) checkDailyLimits(result *RiskCheckResult) error {
	rm.metricsLock.RLock()
	defer rm.metricsLock.RUnlock()

	// Check max orders per day
	if rm.limits.MaxOrdersPerDay > 0 && rm.ordersToday >= rm.limits.MaxOrdersPerDay {
		result.Rejections = append(result.Rejections,
			fmt.Sprintf("Daily order limit reached: %d orders", rm.ordersToday))
	}

	return nil
}

// checkMarginRequirements validates margin and cash requirements
func (rm *RiskManager) checkMarginRequirements(ctx context.Context, order *OrderRequest, result *RiskCheckResult) error {
	summary, err := rm.portfolioRepo.GetSummary(ctx)
	if err != nil {
		rm.logger.Warn().Err(err).Msg("Failed to get portfolio summary for margin check")
		return nil
	}

	// Check minimum cash balance
	orderValue := float64(order.Quantity) * order.Price
	if order.Action == "BUY" {
		requiredCash := orderValue
		if rm.limits.MarginRequirement > 0 {
			requiredCash = orderValue * rm.limits.MarginRequirement
		}

		if summary.Cash < requiredCash {
			result.Rejections = append(result.Rejections,
				fmt.Sprintf("Insufficient cash: $%.2f required, $%.2f available",
					requiredCash, summary.Cash))
		}

		if summary.Cash-requiredCash < rm.limits.MinCashBalance {
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("Order would leave cash balance below minimum: $%.2f",
					rm.limits.MinCashBalance))
		}
	}

	return nil
}

// calculateRiskScore calculates a risk score for the order
func (rm *RiskManager) calculateRiskScore(order *OrderRequest, result *RiskCheckResult) float64 {
	score := 0.0

	// Base risk from rejections and warnings
	score += float64(len(result.Rejections)) * 0.5
	score += float64(len(result.Warnings)) * 0.1

	// Order size risk (0.0-0.3)
	if rm.limits.MaxOrderSize > 0 {
		sizeRatio := float64(order.Quantity) / float64(rm.limits.MaxOrderSize)
		score += sizeRatio * 0.3
	}

	// Normalize to 0.0-1.0
	if score > 1.0 {
		score = 1.0
	}

	return score
}

// RecordOrder records an order for daily tracking
func (rm *RiskManager) RecordOrder(order *OrderRequest) {
	rm.metricsLock.Lock()
	defer rm.metricsLock.Unlock()

	rm.ordersToday++
}

// UpdateDailyPnL updates the daily P&L tracking
func (rm *RiskManager) UpdateDailyPnL(pnl float64) {
	rm.metricsLock.Lock()
	defer rm.metricsLock.Unlock()

	rm.dailyPnL += pnl
}

// resetDailyMetricsIfNeeded resets daily metrics at the start of a new day
func (rm *RiskManager) resetDailyMetricsIfNeeded() {
	now := time.Now()
	if now.Day() != rm.lastResetDate.Day() {
		rm.metricsLock.Lock()
		defer rm.metricsLock.Unlock()

		rm.ordersToday = 0
		rm.dailyPnL = 0
		rm.lastResetDate = now

		rm.logger.Info().Msg("Daily risk metrics reset")
	}
}

// GetMetrics returns current risk metrics
func (rm *RiskManager) GetMetrics() map[string]interface{} {
	rm.metricsLock.RLock()
	defer rm.metricsLock.RUnlock()

	return map[string]interface{}{
		"orders_today":      rm.ordersToday,
		"daily_pnl":         rm.dailyPnL,
		"peak_portfolio":    rm.peakPortfolio,
		"max_orders_limit":  rm.limits.MaxOrdersPerDay,
		"max_daily_loss":    rm.limits.MaxDailyLoss,
	}
}

// GetDefaultLimits returns sensible default risk limits
func GetDefaultLimits() RiskLimits {
	return RiskLimits{
		// Position limits
		MaxPositionSize:   1000,
		MaxPositionValue:  50000,
		MaxConcentration:  0.20, // 20% max in one position

		// Portfolio limits
		MaxTotalExposure:  500000,
		MaxDailyLoss:      5000,
		MaxDrawdown:       0.15, // 15% max drawdown

		// Trading limits
		MaxOrdersPerDay:   100,
		MaxOrderSize:      500,
		MaxOrderValue:     25000,

		// Margin requirements
		MinCashBalance:    10000,
		MarginRequirement: 0.5, // 50% margin

		// Trading hours (9:30 AM - 4:00 PM EST)
		AllowAfterHours:  false,
		TradingStartHour: 9,
		TradingEndHour:   16,
	}
}
