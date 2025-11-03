package events

import "time"

// EventType represents the type of event
type EventType string

const (
	// EventTypeMarketData represents incoming market data
	EventTypeMarketData EventType = "market_data"

	// EventTypeSignal represents a trading signal from a strategy
	EventTypeSignal EventType = "signal"

	// EventTypeOrder represents an order event
	EventTypeOrder EventType = "order"

	// EventTypeOrderFilled represents a filled order
	EventTypeOrderFilled EventType = "order_filled"

	// EventTypePortfolioUpdate represents a portfolio state change
	EventTypePortfolioUpdate EventType = "portfolio_update"

	// EventTypeSystemStatus represents system status changes
	EventTypeSystemStatus EventType = "system_status"
)

// Event is the base interface for all events
type Event interface {
	Type() EventType
	Timestamp() time.Time
}

// BaseEvent provides common fields for all events
type BaseEvent struct {
	EventType EventType
	EventTime time.Time
}

func (e BaseEvent) Type() EventType {
	return e.EventType
}

func (e BaseEvent) Timestamp() time.Time {
	return e.EventTime
}

// MarketDataEvent represents market data updates
type MarketDataEvent struct {
	BaseEvent
	Symbol    string
	Open      float64
	High      float64
	Low       float64
	Close     float64
	Volume    int64
	Timestamp time.Time
}

func NewMarketDataEvent(symbol string, open, high, low, close float64, volume int64, timestamp time.Time) *MarketDataEvent {
	return &MarketDataEvent{
		BaseEvent: BaseEvent{
			EventType: EventTypeMarketData,
			EventTime: time.Now(),
		},
		Symbol:    symbol,
		Open:      open,
		High:      high,
		Low:       low,
		Close:     close,
		Volume:    volume,
		Timestamp: timestamp,
	}
}

// SignalEvent represents a trading signal from a strategy
type SignalEvent struct {
	BaseEvent
	StrategyID string
	Symbol     string
	Action     string  // "BUY", "SELL", "HOLD"
	Confidence float64 // 0.0 to 1.0
	Price      float64
	Quantity   int
	Reason     string
}

func NewSignalEvent(strategyID, symbol, action string, confidence, price float64, quantity int, reason string) *SignalEvent {
	return &SignalEvent{
		BaseEvent: BaseEvent{
			EventType: EventTypeSignal,
			EventTime: time.Now(),
		},
		StrategyID: strategyID,
		Symbol:     symbol,
		Action:     action,
		Confidence: confidence,
		Price:      price,
		Quantity:   quantity,
		Reason:     reason,
	}
}

// OrderEvent represents an order being placed
type OrderEvent struct {
	BaseEvent
	OrderID    string
	StrategyID string
	Symbol     string
	Action     string // "BUY", "SELL"
	Quantity   int
	Price      float64
	OrderType  string // "MARKET", "LIMIT"
	Status     string // "PENDING", "SUBMITTED", "FILLED", "CANCELLED"
}

func NewOrderEvent(orderID, strategyID, symbol, action string, quantity int, price float64, orderType, status string) *OrderEvent {
	return &OrderEvent{
		BaseEvent: BaseEvent{
			EventType: EventTypeOrder,
			EventTime: time.Now(),
		},
		OrderID:    orderID,
		StrategyID: strategyID,
		Symbol:     symbol,
		Action:     action,
		Quantity:   quantity,
		Price:      price,
		OrderType:  orderType,
		Status:     status,
	}
}

// OrderFilledEvent represents a filled order
type OrderFilledEvent struct {
	BaseEvent
	OrderID      string
	StrategyID   string
	Symbol       string
	Action       string
	Quantity     int
	FilledPrice  float64
	Commission   float64
	FillTime     time.Time
}

func NewOrderFilledEvent(orderID, strategyID, symbol, action string, quantity int, filledPrice, commission float64, fillTime time.Time) *OrderFilledEvent {
	return &OrderFilledEvent{
		BaseEvent: BaseEvent{
			EventType: EventTypeOrderFilled,
			EventTime: time.Now(),
		},
		OrderID:     orderID,
		StrategyID:  strategyID,
		Symbol:      symbol,
		Action:      action,
		Quantity:    quantity,
		FilledPrice: filledPrice,
		Commission:  commission,
		FillTime:    fillTime,
	}
}

// SystemStatusEvent represents system status changes
type SystemStatusEvent struct {
	BaseEvent
	Component string
	Status    string // "STARTING", "RUNNING", "STOPPED", "ERROR"
	Message   string
}

func NewSystemStatusEvent(component, status, message string) *SystemStatusEvent {
	return &SystemStatusEvent{
		BaseEvent: BaseEvent{
			EventType: EventTypeSystemStatus,
			EventTime: time.Now(),
		},
		Component: component,
		Status:    status,
		Message:   message,
	}
}
