package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// TradingMetrics holds all Prometheus metrics for the trading system
type TradingMetrics struct {
	// HTTP metrics
	HTTPRequestsTotal   *prometheus.CounterVec
	HTTPRequestDuration *prometheus.HistogramVec
	HTTPResponseSize    *prometheus.HistogramVec

	// Order execution metrics
	OrdersSubmittedTotal *prometheus.CounterVec
	OrdersFilledTotal    *prometheus.CounterVec
	OrdersRejectedTotal  *prometheus.CounterVec
	OrderVolume          *prometheus.CounterVec
	OrderFillDuration    prometheus.Histogram

	// Database metrics
	DBQueryDuration *prometheus.HistogramVec
	DBQueryTotal    *prometheus.CounterVec
	DBErrors        *prometheus.CounterVec

	// Circuit breaker metrics
	CircuitBreakerState *prometheus.GaugeVec
	CircuitBreakerTrips *prometheus.CounterVec

	// Event bus metrics
	EventsPublished *prometheus.CounterVec
	EventsDropped   *prometheus.CounterVec

	// Trading strategy metrics
	StrategySignals  *prometheus.CounterVec
	StrategyPnL      *prometheus.GaugeVec
	StrategyWinRate  *prometheus.GaugeVec

	// System metrics
	ActivePositions   prometheus.Gauge
	PortfolioValue    prometheus.Gauge
	AvailableCash     prometheus.Gauge
	DailyPnL          prometheus.Gauge
	TotalRiskExposure prometheus.Gauge
}

// NewTradingMetrics creates and registers all Prometheus metrics
func NewTradingMetrics(namespace string) *TradingMetrics {
	if namespace == "" {
		namespace = "pi5_trading"
	}

	return &TradingMetrics{
		// HTTP metrics
		HTTPRequestsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "http_requests_total",
				Help:      "Total number of HTTP requests",
			},
			[]string{"method", "path", "status"},
		),
		HTTPRequestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Name:      "http_request_duration_seconds",
				Help:      "HTTP request duration in seconds",
				Buckets:   []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5},
			},
			[]string{"method", "path"},
		),
		HTTPResponseSize: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Name:      "http_response_size_bytes",
				Help:      "HTTP response size in bytes",
				Buckets:   []float64{100, 1000, 10000, 100000, 1000000},
			},
			[]string{"method", "path"},
		),

		// Order execution metrics
		OrdersSubmittedTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "orders_submitted_total",
				Help:      "Total number of orders submitted",
			},
			[]string{"symbol", "side", "order_type"},
		),
		OrdersFilledTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "orders_filled_total",
				Help:      "Total number of orders filled",
			},
			[]string{"symbol", "side"},
		),
		OrdersRejectedTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "orders_rejected_total",
				Help:      "Total number of orders rejected",
			},
			[]string{"symbol", "reason"},
		),
		OrderVolume: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "order_volume_usd",
				Help:      "Total order volume in USD",
			},
			[]string{"symbol", "side"},
		),
		OrderFillDuration: promauto.NewHistogram(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Name:      "order_fill_duration_seconds",
				Help:      "Time taken to fill an order",
				Buckets:   []float64{.001, .005, .01, .05, .1, .5, 1, 5, 10},
			},
		),

		// Database metrics
		DBQueryDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Name:      "db_query_duration_seconds",
				Help:      "Database query duration in seconds",
				Buckets:   []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1},
			},
			[]string{"operation", "table"},
		),
		DBQueryTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "db_queries_total",
				Help:      "Total number of database queries",
			},
			[]string{"operation", "table"},
		),
		DBErrors: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "db_errors_total",
				Help:      "Total number of database errors",
			},
			[]string{"operation", "table"},
		),

		// Circuit breaker metrics
		CircuitBreakerState: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "circuit_breaker_state",
				Help:      "Circuit breaker state (0=closed, 1=open, 2=half-open)",
			},
			[]string{"breaker"},
		),
		CircuitBreakerTrips: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "circuit_breaker_trips_total",
				Help:      "Total number of circuit breaker trips",
			},
			[]string{"breaker"},
		),

		// Event bus metrics
		EventsPublished: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "events_published_total",
				Help:      "Total number of events published",
			},
			[]string{"event_type"},
		),
		EventsDropped: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "events_dropped_total",
				Help:      "Total number of events dropped",
			},
			[]string{"event_type"},
		),

		// Trading strategy metrics
		StrategySignals: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "strategy_signals_total",
				Help:      "Total number of strategy signals generated",
			},
			[]string{"strategy", "signal_type"},
		),
		StrategyPnL: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "strategy_pnl_usd",
				Help:      "Strategy profit and loss in USD",
			},
			[]string{"strategy"},
		),
		StrategyWinRate: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "strategy_win_rate",
				Help:      "Strategy win rate (0-1)",
			},
			[]string{"strategy"},
		),

		// System metrics
		ActivePositions: promauto.NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "active_positions",
				Help:      "Number of active positions",
			},
		),
		PortfolioValue: promauto.NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "portfolio_value_usd",
				Help:      "Total portfolio value in USD",
			},
		),
		AvailableCash: promauto.NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "available_cash_usd",
				Help:      "Available cash in USD",
			},
		),
		DailyPnL: promauto.NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "daily_pnl_usd",
				Help:      "Daily profit and loss in USD",
			},
		),
		TotalRiskExposure: promauto.NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "total_risk_exposure_usd",
				Help:      "Total risk exposure in USD",
			},
		),
	}
}
