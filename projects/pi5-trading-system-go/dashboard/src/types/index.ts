// Type definitions for Pi5 Trading System Dashboard

export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: "admin" | "trader" | "viewer";
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginResponse {
  success: boolean;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
  timestamp: string;
  message?: string;
}

// Portfolio Types
export interface PortfolioSummary {
  total_equity: number;
  total_value: number;
  cash_balance: number;
  invested_amount: number;
  total_return: number;
  total_return_percent: number;
  day_change: number;
  day_change_percent: number;
  daily_pnl: number;
  daily_pnl_percent: number;
  unrealized_pnl: number;
  realized_pnl: number;
  positions_count: number;
  total_positions: number;
  last_updated: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  average_price: number;
  avg_price: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  cost_basis: number;
  side: "long" | "short";
  first_acquired: string;
  last_updated: string;
}

export interface PortfolioPerformance {
  period_start: string;
  period_end: string;
  initial_value: number;
  final_value: number;
  total_return: number;
  annualized_return: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  volatility: number;
  calmar_ratio: number;
  win_rate: number;
  profit_factor: number;
  total_trades: number;
  daily_returns?: number[];
  benchmark_returns?: number[];
  benchmark_return?: number;
  alpha?: number;
  beta?: number;
}

export interface PortfolioAllocation {
  sectors?: {
    sector: string;
    percentage: number;
  }[];
}

export interface SystemEvent {
  id?: string;
  level: "info" | "warning" | "error";
  message: string;
  timestamp: string;
  source?: string;
}

export interface SystemStatus {
  recent_events?: SystemEvent[];
  [key: string]: unknown;
}

// Strategy Types
export interface Strategy {
  id: string;
  name: string;
  description?: string;
  class_name: string;
  strategy_type: string;
  status: "inactive" | "active" | "paused" | "error";
  parameters: Record<string, unknown>;
  symbols: string[];
  allocation?: number;
  total_pnl?: number;
  risk_level?: "low" | "medium" | "high";
  last_signal?: {
    signal_type: string;
    symbol?: string;
    timestamp: string;
  };
  created_at: string;
  started_at?: string;
  stopped_at?: string;
  error_message?: string;
}

export interface StrategyInfo {
  name: string;
  display_name: string;
  class_name: string;
  description: string;
  version: string;
  parameters: StrategyParameter[];
  supported_symbols: string[];
  timeframes: string[];
}

export interface StrategyParameter {
  name: string;
  type: string;
  default_value: unknown;
  min_value?: number;
  max_value?: number;
  description?: string;
  required: boolean;
}

export interface StrategyPerformance {
  strategy_id: string;
  strategy_name: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_return: number;
  annualized_return: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  volatility: number;
  calmar_ratio: number;
  profit_factor: number;
  avg_win: number;
  avg_loss: number;
  period_start: string;
  period_end: string;
}

// Order Types
export interface Order {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  order_type: "market" | "limit" | "stop" | "stop_limit";
  quantity: number;
  price?: number;
  stop_price?: number;
  filled_quantity: number;
  remaining_quantity: number;
  average_fill_price?: number;
  status: "pending" | "filled" | "cancelled" | "rejected" | "expired" | "partial";
  created_at: string;
  updated_at: string;
  filled_at?: string;
  cancelled_at?: string;
  strategy_id?: string;
  error_message?: string;
}

export interface Trade {
  id: string;
  order_id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  value: number;
  commission: number;
  executed_at: string;
  strategy_id?: string;
}

// System Types
export interface SystemHealth {
  status: string;
  version: string;
  uptime_seconds: number;
  uptime?: number;
  last_heartbeat?: string;
  components: Record<
    string,
    {
      status: string;
      [key: string]: unknown;
    }
  >;
  system: {
    cpu_usage: number;
    memory_usage: number;
    [key: string]: unknown;
  };
  timestamp: string;
}

export interface SystemMetrics {
  cpu_usage?: number;
  cpu_usage_percent: number;
  memory_usage?: number;
  memory_usage_percent: number;
  total_memory?: string;
  available_memory?: string;
  disk_usage?: string;
  memory_available_mb: number;
  disk_usage_percent: number;
  network_io: {
    bytes_sent: number;
    bytes_received: number;
  };
  active_connections: number;
  api_requests_per_minute?: number;
  request_rate: number;
  error_rate: number;
  response_time_avg: number;
  timestamp: string;
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp: string;
}

export interface WebSocketSubscription {
  channels: string[];
  symbols?: string[];
  strategies?: string[];
}

// Chart Data Types
export interface ChartDataPoint {
  x: string | number;
  y: number;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
    fill?: boolean;
  }[];
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
    detail?: string;
    type?: string;
  };
}

// Form Types
export interface LoginFormData {
  username: string;
  password: string;
}

export interface CreateOrderFormData {
  symbol: string;
  side: "buy" | "sell";
  order_type: "market" | "limit" | "stop" | "stop_limit";
  quantity: number;
  price?: number | undefined;
  time_in_force?: "GTC" | "IOC" | "FOK" | "DAY" | undefined;
  stop_loss?: number | undefined;
  take_profit?: number | undefined;
}

export interface CreateStrategyFormData {
  name: string;
  description?: string;
  strategy_type: string;
  symbols: string[];
  parameters: Record<string, unknown>;
  allocation: number;
  risk_level: "low" | "medium" | "high";
}

// Utility Types
export type LoadingState = "idle" | "loading" | "success" | "error";

export interface PaginationParams {
  page: number;
  page_size: number;
}

export interface FilterOptions {
  symbol?: string;
  status?: string;
  strategy_id?: string;
  start_date?: string;
  end_date?: string;
}
