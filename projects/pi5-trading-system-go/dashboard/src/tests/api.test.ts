import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateOrderFormData, CreateStrategyFormData, LoginFormData } from "../types";

// Create mock axios instance
const mockAxiosInstance = {
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
};

// Mock axios
vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
  },
}));

// Mock api service
vi.mock("../services/api", () => ({
  apiService: {
    login: vi.fn(),
    logout: vi.fn(),
    getProfile: vi.fn(),
    getPortfolio: vi.fn(),
    getOrders: vi.fn(),
    createOrder: vi.fn(),
    getStrategies: vi.fn(),
    createStrategy: vi.fn(),
    getSystemHealth: vi.fn(),
    createWebSocket: vi.fn(),
  },
}));

import { apiService } from "../services/api";

const mockedAxios = vi.mocked(axios);

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("API Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockedAxios.create as ReturnType<typeof vi.fn>).mockReturnValue(mockAxiosInstance);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Authentication", () => {
    it("should login successfully", async () => {
      const loginData: LoginFormData = {
        username: "testuser",
        password: "testpass",
      };

      const mockResponse = {
        data: {
          access_token: "mock_access_token",
          refresh_token: "mock_refresh_token",
          user: {
            id: "1",
            username: "testuser",
            email: "test@example.com",
            role: "trader",
            is_active: true,
            created_at: "2023-01-01T00:00:00Z",
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await apiService.login(loginData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/auth/login", loginData);
      expect(localStorageMock.setItem).toHaveBeenCalledWith("access_token", "mock_access_token");
      expect(localStorageMock.setItem).toHaveBeenCalledWith("refresh_token", "mock_refresh_token");
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "user",
        JSON.stringify(mockResponse.data.user)
      );
      expect(result).toEqual(mockResponse.data);
    });

    it("should logout successfully", async () => {
      mockAxiosInstance.post.mockResolvedValue({});

      await apiService.logout();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/auth/logout");
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("access_token");
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("refresh_token");
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("user");
    });

    it("should get current user", async () => {
      const mockUser = {
        id: "1",
        username: "testuser",
        email: "test@example.com",
        role: "trader",
        is_active: true,
        created_at: "2023-01-01T00:00:00Z",
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockUser });

      const result = await apiService.getCurrentUser();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/auth/me");
      expect(result).toEqual(mockUser);
    });
  });

  describe("Portfolio", () => {
    it("should get portfolio summary", async () => {
      const mockSummary = {
        total_equity: 100000,
        total_value: 100000,
        cash_balance: 20000,
        invested_amount: 80000,
        total_return: 5000,
        total_return_percent: 6.25,
        day_change: 1000,
        day_change_percent: 1.0,
        daily_pnl: 1000,
        daily_pnl_percent: 1.0,
        unrealized_pnl: 5000,
        realized_pnl: 2000,
        positions_count: 5,
        total_positions: 5,
        last_updated: "2023-01-01T00:00:00Z",
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockSummary });

      const result = await apiService.getPortfolioSummary();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/v1/portfolio/summary");
      expect(result).toEqual(mockSummary);
    });

    it("should get positions", async () => {
      const mockPositions = [
        {
          symbol: "AAPL",
          quantity: 100,
          average_price: 150.0,
          avg_price: 150.0,
          current_price: 155.0,
          market_value: 15500,
          unrealized_pnl: 500,
          unrealized_pnl_percent: 3.33,
          cost_basis: 15000,
          side: "long",
          first_acquired: "2023-01-01T00:00:00Z",
          last_updated: "2023-01-02T00:00:00Z",
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockPositions });

      const result = await apiService.getPositions();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/v1/portfolio/positions");
      expect(result).toEqual(mockPositions);
    });

    it("should get portfolio performance", async () => {
      const mockPerformance = {
        period_start: "2023-01-01",
        period_end: "2023-12-31",
        initial_value: 100000,
        final_value: 110000,
        total_return: 0.1,
        annualized_return: 0.12,
        sharpe_ratio: 1.5,
        sortino_ratio: 2.0,
        max_drawdown: -0.05,
        volatility: 0.15,
        calmar_ratio: 2.4,
        win_rate: 0.65,
        profit_factor: 1.8,
        total_trades: 100,
        daily_returns: [0.01, 0.02, -0.01],
        benchmark_returns: [0.008, 0.015, -0.005],
        benchmark_return: 0.08,
        alpha: 0.02,
        beta: 0.9,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockPerformance });

      const result = await apiService.getPortfolioPerformance();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/v1/portfolio/performance?");
      expect(result).toEqual(mockPerformance);
    });
  });

  describe("Orders", () => {
    it("should create order successfully", async () => {
      const orderData: CreateOrderFormData = {
        symbol: "AAPL",
        side: "buy",
        order_type: "market",
        quantity: 100,
        time_in_force: "DAY",
      };

      const mockOrder = {
        id: "order-123",
        symbol: "AAPL",
        side: "buy",
        order_type: "market",
        quantity: 100,
        price: undefined,
        stop_price: undefined,
        filled_quantity: 0,
        remaining_quantity: 100,
        status: "pending",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-01-01T00:00:00Z",
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockOrder });

      const result = await apiService.createOrder(orderData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/api/v1/orders/", orderData);
      expect(result).toEqual(mockOrder);
    });

    it("should get orders with filters", async () => {
      const mockOrders = [
        {
          id: "order-123",
          symbol: "AAPL",
          side: "buy",
          order_type: "market",
          quantity: 100,
          filled_quantity: 100,
          remaining_quantity: 0,
          status: "filled",
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z",
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockOrders });

      const result = await apiService.getOrders({ status: "filled", limit: 10 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/api/v1/orders/?status_filter=filled&limit=10"
      );
      expect(result).toEqual(mockOrders);
    });

    it("should cancel order", async () => {
      const orderId = "order-123";
      const reason = "User requested cancellation";

      mockAxiosInstance.delete.mockResolvedValue({});

      await apiService.cancelOrder(orderId, reason);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/api/v1/orders/${orderId}`, {
        data: { reason },
      });
    });
  });

  describe("Strategies", () => {
    it("should create strategy successfully", async () => {
      const strategyData: CreateStrategyFormData = {
        name: "Test Strategy",
        description: "A test trading strategy",
        strategy_type: "momentum",
        symbols: ["AAPL", "GOOGL"],
        parameters: { period: 20, threshold: 0.02 },
        allocation: 50000,
        risk_level: "medium",
      };

      const mockStrategy = {
        id: "strategy-123",
        name: "Test Strategy",
        description: "A test trading strategy",
        class_name: "MomentumStrategy",
        strategy_type: "momentum",
        status: "inactive",
        parameters: { period: 20, threshold: 0.02 },
        symbols: ["AAPL", "GOOGL"],
        allocation: 50000,
        total_pnl: 0,
        risk_level: "medium",
        created_at: "2023-01-01T00:00:00Z",
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockStrategy });

      const result = await apiService.createStrategy(strategyData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/api/v1/strategies/", strategyData);
      expect(result).toEqual(mockStrategy);
    });

    it("should get active strategies", async () => {
      const mockStrategies = [
        {
          id: "strategy-123",
          name: "Active Strategy",
          class_name: "MomentumStrategy",
          strategy_type: "momentum",
          status: "active",
          parameters: {},
          symbols: ["AAPL"],
          created_at: "2023-01-01T00:00:00Z",
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockStrategies });

      const result = await apiService.getActiveStrategies();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/v1/strategies/active");
      expect(result).toEqual(mockStrategies);
    });

    it("should control strategy", async () => {
      const strategyId = "strategy-123";
      const action = "start";
      const reason = "Ready to begin trading";

      mockAxiosInstance.post.mockResolvedValue({});

      await apiService.controlStrategy(strategyId, action, reason);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/api/v1/strategies/${strategyId}/action`,
        {
          action,
          reason,
        }
      );
    });
  });

  describe("System", () => {
    it("should get system health", async () => {
      const mockHealth = {
        status: "healthy",
        version: "1.0.0",
        uptime_seconds: 3600,
        uptime: 3600,
        last_heartbeat: "2023-01-01T01:00:00Z",
        components: {
          database: { status: "healthy" },
          broker: { status: "healthy" },
        },
        system: {
          cpu_usage: 45.2,
          memory_usage: 67.8,
        },
        timestamp: "2023-01-01T01:00:00Z",
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockHealth });

      const result = await apiService.getSystemHealth();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/v1/system/health");
      expect(result).toEqual(mockHealth);
    });

    it("should get system metrics", async () => {
      const mockMetrics = {
        cpu_usage: 45.2,
        cpu_usage_percent: 45.2,
        memory_usage: 67.8,
        memory_usage_percent: 67.8,
        total_memory: "8GB",
        available_memory: "2.5GB",
        disk_usage: "125GB",
        memory_available_mb: 2560,
        disk_usage_percent: 78.5,
        network_io: {
          bytes_sent: 1048576,
          bytes_received: 2097152,
        },
        active_connections: 25,
        api_requests_per_minute: 120,
        request_rate: 2.0,
        error_rate: 0.05,
        response_time_avg: 150.5,
        timestamp: "2023-01-01T01:00:00Z",
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockMetrics });

      const result = await apiService.getSystemMetrics();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/v1/system/metrics");
      expect(result).toEqual(mockMetrics);
    });
  });

  describe("WebSocket", () => {
    it("should create WebSocket with correct URL", () => {
      // Mock WebSocket
      const mockWebSocket = vi.fn();
      global.WebSocket = mockWebSocket as unknown as typeof WebSocket;

      const clientId = "test-client-123";
      apiService.createWebSocket(clientId);

      expect(mockWebSocket).toHaveBeenCalledWith(`http://localhost:8000/ws/?client_id=${clientId}`);
    });
  });

  describe("Utility Methods", () => {
    it("should check if user is authenticated", () => {
      localStorageMock.getItem.mockReturnValue("mock_token");

      const result = apiService.isAuthenticated();

      expect(localStorageMock.getItem).toHaveBeenCalledWith("access_token");
      expect(result).toBe(true);
    });

    it("should return false if no token", () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = apiService.isAuthenticated();

      expect(result).toBe(false);
    });

    it("should get current user from storage", () => {
      const mockUser = {
        id: "1",
        username: "testuser",
        email: "test@example.com",
        role: "trader",
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));

      const result = apiService.getCurrentUserFromStorage();

      expect(localStorageMock.getItem).toHaveBeenCalledWith("user");
      expect(result).toEqual(mockUser);
    });

    it("should return null if no user in storage", () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = apiService.getCurrentUserFromStorage();

      expect(result).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should handle API error responses", async () => {
      const errorResponse = {
        response: {
          status: 400,
          data: {
            error: {
              message: "Invalid request data",
            },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(errorResponse);

      await expect(apiService.login({ username: "test", password: "test" })).rejects.toThrow();
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network Error");
      mockAxiosInstance.get.mockRejectedValue(networkError);

      await expect(apiService.getPortfolioSummary()).rejects.toThrow("Network Error");
    });
  });
});
