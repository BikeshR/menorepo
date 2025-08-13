import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';
import {
  LoginFormData,
  LoginResponse,
  User,
  PortfolioSummary,
  Position,
  PortfolioPerformance,
  Strategy,
  StrategyInfo,
  StrategyPerformance,
  Order,
  Trade,
  SystemHealth,
  SystemMetrics,
  CreateOrderFormData,
  CreateStrategyFormData,
  ApiResponse,
} from '../types';

class ApiService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    // In production, use the same host/port as the current page
    // In development, use the dev server proxy or env variable
    this.baseURL = process.env.REACT_APP_API_URL || 
      (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:8080');
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const response = await this.client.post('/auth/refresh', {
                refresh_token: refreshToken,
              });

              const { access_token, refresh_token: newRefreshToken } = response.data;
              localStorage.setItem('access_token', access_token);
              localStorage.setItem('refresh_token', newRefreshToken);

              // Retry original request with new token
              originalRequest.headers.Authorization = `Bearer ${access_token}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        // Handle other errors
        this.handleApiError(error);
        return Promise.reject(error);
      }
    );
  }

  private handleApiError(error: any) {
    let message = 'An unexpected error occurred';

    if (error.response?.data?.error?.message) {
      message = error.response.data.error.message;
    } else if (error.response?.data?.detail) {
      message = error.response.data.detail;
    } else if (error.message) {
      message = error.message;
    }

    // Don't show toast for 401 errors (handled by interceptor)
    if (error.response?.status !== 401) {
      toast.error(message);
    }
  }

  // Authentication
  async login(credentials: LoginFormData): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/login', credentials);
    const { access_token, refresh_token, user } = response.data;
    
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('user', JSON.stringify(user));
    
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<User>('/auth/me');
    return response.data;
  }

  // Portfolio
  async getPortfolioSummary(): Promise<PortfolioSummary> {
    const response = await this.client.get<PortfolioSummary>('/api/v1/portfolio/summary');
    return response.data;
  }

  async getPositions(): Promise<Position[]> {
    const response = await this.client.get<Position[]>('/api/v1/portfolio/positions');
    return response.data;
  }

  async getPosition(symbol: string): Promise<Position> {
    const response = await this.client.get<Position>(`/api/v1/portfolio/positions/${symbol}`);
    return response.data;
  }

  async getPortfolioPerformance(
    startDate?: string,
    endDate?: string,
    benchmark?: string
  ): Promise<PortfolioPerformance> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (benchmark) params.append('benchmark', benchmark);

    const response = await this.client.get<PortfolioPerformance>(
      `/api/v1/portfolio/performance?${params.toString()}`
    );
    return response.data;
  }

  async getPortfolioHistory(
    startDate?: string,
    endDate?: string,
    interval = '1d'
  ): Promise<any[]> {
    const params = new URLSearchParams({ interval });
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await this.client.get<any[]>(
      `/api/v1/portfolio/history?${params.toString()}`
    );
    return response.data;
  }

  async getPortfolioAllocation(): Promise<any> {
    const response = await this.client.get('/api/v1/portfolio/allocation');
    return response.data;
  }

  // Strategies
  async getAvailableStrategies(): Promise<StrategyInfo[]> {
    const response = await this.client.get<StrategyInfo[]>('/api/v1/strategies/');
    return response.data;
  }

  async getActiveStrategies(): Promise<Strategy[]> {
    const response = await this.client.get<Strategy[]>('/api/v1/strategies/active');
    return response.data;
  }

  async getStrategy(strategyId: string): Promise<Strategy> {
    const response = await this.client.get<Strategy>(`/api/v1/strategies/${strategyId}`);
    return response.data;
  }

  async createStrategy(strategy: CreateStrategyFormData): Promise<Strategy> {
    const response = await this.client.post<Strategy>('/api/v1/strategies/', strategy);
    toast.success('Strategy created successfully');
    return response.data;
  }

  async updateStrategy(strategyId: string, updates: Partial<CreateStrategyFormData>): Promise<Strategy> {
    const response = await this.client.put<Strategy>(`/api/v1/strategies/${strategyId}`, updates);
    toast.success('Strategy updated successfully');
    return response.data;
  }

  async controlStrategy(strategyId: string, action: string, reason?: string): Promise<void> {
    await this.client.post(`/api/v1/strategies/${strategyId}/action`, {
      action,
      reason,
    });
    toast.success(`Strategy ${action} successful`);
  }

  async deleteStrategy(strategyId: string): Promise<void> {
    await this.client.delete(`/api/v1/strategies/${strategyId}`);
    toast.success('Strategy deleted successfully');
  }

  async getStrategyPerformance(
    strategyId: string,
    startDate?: string,
    endDate?: string
  ): Promise<StrategyPerformance> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await this.client.get<StrategyPerformance>(
      `/api/v1/strategies/${strategyId}/performance?${params.toString()}`
    );
    return response.data;
  }

  // Orders
  async getOrders(filters?: {
    status?: string;
    symbol?: string;
    limit?: number;
  }): Promise<Order[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status_filter', filters.status);
    if (filters?.symbol) params.append('symbol', filters.symbol);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await this.client.get<Order[]>(`/api/v1/orders/?${params.toString()}`);
    return response.data;
  }

  async createOrder(order: CreateOrderFormData): Promise<Order> {
    const response = await this.client.post<Order>('/api/v1/orders/', order);
    toast.success('Order created successfully');
    return response.data;
  }

  async getOrder(orderId: string): Promise<Order> {
    const response = await this.client.get<Order>(`/api/v1/orders/${orderId}`);
    return response.data;
  }

  async cancelOrder(orderId: string, reason?: string): Promise<void> {
    await this.client.delete(`/api/v1/orders/${orderId}`, {
      data: { reason },
    });
    toast.success('Order cancelled successfully');
  }

  async getTrades(filters?: {
    symbol?: string;
    limit?: number;
  }): Promise<Trade[]> {
    const params = new URLSearchParams();
    if (filters?.symbol) params.append('symbol', filters.symbol);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await this.client.get<Trade[]>(
      `/api/v1/orders/trades/history?${params.toString()}`
    );
    return response.data;
  }

  // System
  async getSystemHealth(): Promise<SystemHealth> {
    const response = await this.client.get<SystemHealth>('/api/v1/system/health');
    return response.data;
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const response = await this.client.get<SystemMetrics>('/api/v1/system/metrics');
    return response.data;
  }

  async getSystemStatus(): Promise<any> {
    const response = await this.client.get('/api/v1/system/status');
    return response.data;
  }

  async restartSystem(): Promise<void> {
    await this.client.post('/api/v1/system/restart');
    toast.success('System restart initiated');
  }

  // WebSocket connection
  createWebSocket(clientId: string): WebSocket {
    const wsUrl = this.baseURL.replace('http', 'ws') + `/ws/?client_id=${clientId}`;
    return new WebSocket(wsUrl);
  }

  // Utility methods
  isAuthenticated(): boolean {
    const token = localStorage.getItem('access_token');
    return !!token;
  }

  getCurrentUserFromStorage(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
}

export const apiService = new ApiService();
export default apiService;