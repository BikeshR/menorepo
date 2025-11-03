package types

import "time"

// MarketData represents OHLCV data for a symbol
type MarketData struct {
	Symbol    string    `json:"symbol"`
	Timestamp time.Time `json:"timestamp"`
	Open      float64   `json:"open"`
	High      float64   `json:"high"`
	Low       float64   `json:"low"`
	Close     float64   `json:"close"`
	Volume    int64     `json:"volume"`
}

// Quote represents a real-time price quote
type Quote struct {
	Symbol    string    `json:"symbol"`
	Bid       float64   `json:"bid"`
	Ask       float64   `json:"ask"`
	Last      float64   `json:"last"`
	Volume    int64     `json:"volume"`
	Timestamp time.Time `json:"timestamp"`
}
