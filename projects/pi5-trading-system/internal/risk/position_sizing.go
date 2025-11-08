package risk

import (
	"fmt"
	"math"
)

// PositionSizer interface for different position sizing methods
type PositionSizer interface {
	// CalculateSize returns the number of shares to trade
	CalculateSize(accountValue, entryPrice, stopLoss float64) (int, error)

	// GetName returns the name of the sizing method
	GetName() string
}

// FixedDollarRiskSizer sizes positions based on fixed dollar risk per trade
type FixedDollarRiskSizer struct {
	RiskPerTrade float64 // Fixed dollar amount to risk per trade
}

// NewFixedDollarRiskSizer creates a new fixed dollar risk sizer
func NewFixedDollarRiskSizer(riskPerTrade float64) *FixedDollarRiskSizer {
	return &FixedDollarRiskSizer{
		RiskPerTrade: riskPerTrade,
	}
}

// CalculateSize calculates position size based on fixed dollar risk
func (f *FixedDollarRiskSizer) CalculateSize(accountValue, entryPrice, stopLoss float64) (int, error) {
	if stopLoss <= 0 {
		return 0, fmt.Errorf("stop loss must be positive")
	}
	if entryPrice <= 0 {
		return 0, fmt.Errorf("entry price must be positive")
	}

	// Risk per share
	riskPerShare := math.Abs(entryPrice - stopLoss)
	if riskPerShare == 0 {
		return 0, fmt.Errorf("risk per share is zero")
	}

	// Position size = Risk per trade / Risk per share
	size := int(f.RiskPerTrade / riskPerShare)

	if size < 1 {
		return 0, fmt.Errorf("position size too small (< 1 share)")
	}

	return size, nil
}

// GetName returns the sizer name
func (f *FixedDollarRiskSizer) GetName() string {
	return fmt.Sprintf("FixedDollarRisk($%.2f)", f.RiskPerTrade)
}

// PercentRiskSizer sizes positions based on percentage of account value
type PercentRiskSizer struct {
	RiskPercentage float64 // Percentage of account to risk (e.g., 0.01 = 1%)
	MaxPositionPct float64 // Maximum % of account in single position (e.g., 0.2 = 20%)
}

// NewPercentRiskSizer creates a new percentage risk sizer
func NewPercentRiskSizer(riskPct, maxPositionPct float64) *PercentRiskSizer {
	return &PercentRiskSizer{
		RiskPercentage: riskPct,
		MaxPositionPct: maxPositionPct,
	}
}

// CalculateSize calculates position size based on percentage risk
func (p *PercentRiskSizer) CalculateSize(accountValue, entryPrice, stopLoss float64) (int, error) {
	if stopLoss <= 0 {
		return 0, fmt.Errorf("stop loss must be positive")
	}
	if entryPrice <= 0 {
		return 0, fmt.Errorf("entry price must be positive")
	}
	if accountValue <= 0 {
		return 0, fmt.Errorf("account value must be positive")
	}

	// Risk in dollars
	riskAmount := accountValue * p.RiskPercentage

	// Risk per share
	riskPerShare := math.Abs(entryPrice - stopLoss)
	if riskPerShare == 0 {
		return 0, fmt.Errorf("risk per share is zero")
	}

	// Position size = Risk amount / Risk per share
	size := int(riskAmount / riskPerShare)

	if size < 1 {
		return 0, fmt.Errorf("position size too small (< 1 share)")
	}

	// Apply maximum position size constraint
	if p.MaxPositionPct > 0 {
		maxShares := int((accountValue * p.MaxPositionPct) / entryPrice)
		if size > maxShares {
			size = maxShares
		}
	}

	return size, nil
}

// GetName returns the sizer name
func (p *PercentRiskSizer) GetName() string {
	return fmt.Sprintf("PercentRisk(%.2f%%, max %.0f%%)", p.RiskPercentage*100, p.MaxPositionPct*100)
}

// KellyCriterionSizer sizes positions using Kelly Criterion
type KellyCriterionSizer struct {
	WinRate        float64 // Historical win rate (0.0 to 1.0)
	AvgWin         float64 // Average win amount
	AvgLoss        float64 // Average loss amount (positive number)
	FractionOfKelly float64 // Fraction of Kelly to use (e.g., 0.5 = half Kelly)
	MaxPositionPct  float64 // Maximum % of account in single position
}

// NewKellyCriterionSizer creates a new Kelly Criterion sizer
func NewKellyCriterionSizer(winRate, avgWin, avgLoss, fractionOfKelly, maxPositionPct float64) *KellyCriterionSizer {
	return &KellyCriterionSizer{
		WinRate:        winRate,
		AvgWin:         avgWin,
		AvgLoss:        avgLoss,
		FractionOfKelly: fractionOfKelly,
		MaxPositionPct:  maxPositionPct,
	}
}

// CalculateSize calculates position size using Kelly Criterion
// Kelly % = (W * (B + 1) - 1) / B
// Where: W = win probability, B = win/loss ratio
func (k *KellyCriterionSizer) CalculateSize(accountValue, entryPrice, stopLoss float64) (int, error) {
	if entryPrice <= 0 {
		return 0, fmt.Errorf("entry price must be positive")
	}
	if accountValue <= 0 {
		return 0, fmt.Errorf("account value must be positive")
	}

	// Calculate win/loss ratio
	if k.AvgLoss == 0 {
		return 0, fmt.Errorf("average loss is zero")
	}
	winLossRatio := k.AvgWin / k.AvgLoss

	// Kelly formula: (W * (B + 1) - 1) / B
	// Simplified: W - ((1 - W) / B)
	kellyPercent := k.WinRate - ((1 - k.WinRate) / winLossRatio)

	// Apply fraction of Kelly (for safety)
	kellyPercent *= k.FractionOfKelly

	// Kelly can be negative (don't trade) or > 1 (bet more than account)
	if kellyPercent <= 0 {
		return 0, fmt.Errorf("Kelly criterion suggests no position (%.4f)", kellyPercent)
	}

	// Cap at max position size
	if kellyPercent > k.MaxPositionPct {
		kellyPercent = k.MaxPositionPct
	}

	// Calculate shares
	positionValue := accountValue * kellyPercent
	shares := int(positionValue / entryPrice)

	if shares < 1 {
		return 0, fmt.Errorf("position size too small (< 1 share)")
	}

	return shares, nil
}

// GetName returns the sizer name
func (k *KellyCriterionSizer) GetName() string {
	return fmt.Sprintf("KellyCriterion(%.0f%% of Kelly)", k.FractionOfKelly*100)
}

// FixedFractionalSizer sizes positions as a fixed fraction of account
type FixedFractionalSizer struct {
	Fraction float64 // Fraction of account to allocate (e.g., 0.05 = 5%)
}

// NewFixedFractionalSizer creates a new fixed fractional sizer
func NewFixedFractionalSizer(fraction float64) *FixedFractionalSizer {
	return &FixedFractionalSizer{
		Fraction: fraction,
	}
}

// CalculateSize calculates position size as fixed fraction of account
func (f *FixedFractionalSizer) CalculateSize(accountValue, entryPrice, stopLoss float64) (int, error) {
	if entryPrice <= 0 {
		return 0, fmt.Errorf("entry price must be positive")
	}
	if accountValue <= 0 {
		return 0, fmt.Errorf("account value must be positive")
	}

	positionValue := accountValue * f.Fraction
	shares := int(positionValue / entryPrice)

	if shares < 1 {
		return 0, fmt.Errorf("position size too small (< 1 share)")
	}

	return shares, nil
}

// GetName returns the sizer name
func (f *FixedFractionalSizer) GetName() string {
	return fmt.Sprintf("FixedFractional(%.1f%%)", f.Fraction*100)
}

// VolatilityAdjustedSizer adjusts position size based on volatility (ATR)
type VolatilityAdjustedSizer struct {
	RiskPercentage float64 // Percentage of account to risk
	ATRMultiplier  float64 // Multiplier for ATR stop loss
	MaxPositionPct float64 // Maximum position size
}

// NewVolatilityAdjustedSizer creates a volatility-adjusted sizer
func NewVolatilityAdjustedSizer(riskPct, atrMultiplier, maxPositionPct float64) *VolatilityAdjustedSizer {
	return &VolatilityAdjustedSizer{
		RiskPercentage: riskPct,
		ATRMultiplier:  atrMultiplier,
		MaxPositionPct: maxPositionPct,
	}
}

// CalculateSize calculates position size based on volatility
// stopLoss parameter is interpreted as ATR value
func (v *VolatilityAdjustedSizer) CalculateSize(accountValue, entryPrice, atr float64) (int, error) {
	if entryPrice <= 0 {
		return 0, fmt.Errorf("entry price must be positive")
	}
	if accountValue <= 0 {
		return 0, fmt.Errorf("account value must be positive")
	}
	if atr <= 0 {
		return 0, fmt.Errorf("ATR must be positive")
	}

	// Stop loss distance = ATR * multiplier
	stopDistance := atr * v.ATRMultiplier

	// Risk amount in dollars
	riskAmount := accountValue * v.RiskPercentage

	// Position size = Risk amount / Stop distance
	size := int(riskAmount / stopDistance)

	if size < 1 {
		return 0, fmt.Errorf("position size too small (< 1 share)")
	}

	// Apply maximum position size constraint
	if v.MaxPositionPct > 0 {
		maxShares := int((accountValue * v.MaxPositionPct) / entryPrice)
		if size > maxShares {
			size = maxShares
		}
	}

	return size, nil
}

// GetName returns the sizer name
func (v *VolatilityAdjustedSizer) GetName() string {
	return fmt.Sprintf("VolatilityAdjusted(risk %.2f%%, ATR×%.1f)", v.RiskPercentage*100, v.ATRMultiplier)
}

// PositionSizingStrategy determines which sizer to use
type PositionSizingStrategy struct {
	Sizer PositionSizer
}

// NewPositionSizingStrategy creates a new position sizing strategy
func NewPositionSizingStrategy(sizer PositionSizer) *PositionSizingStrategy {
	return &PositionSizingStrategy{
		Sizer: sizer,
	}
}

// CalculateShares calculates the number of shares to trade
func (p *PositionSizingStrategy) CalculateShares(accountValue, entryPrice, stopLoss float64) (int, error) {
	return p.Sizer.CalculateSize(accountValue, entryPrice, stopLoss)
}

// GetDescription returns a description of the strategy
func (p *PositionSizingStrategy) GetDescription() string {
	return fmt.Sprintf("Position Sizing: %s", p.Sizer.GetName())
}

// ComparePositionSizers compares different position sizing methods
func ComparePositionSizers(accountValue, entryPrice, stopLoss float64, sizers []PositionSizer) map[string]int {
	results := make(map[string]int)

	for _, sizer := range sizers {
		size, err := sizer.CalculateSize(accountValue, entryPrice, stopLoss)
		if err != nil {
			results[sizer.GetName()] = 0
		} else {
			results[sizer.GetName()] = size
		}
	}

	return results
}
