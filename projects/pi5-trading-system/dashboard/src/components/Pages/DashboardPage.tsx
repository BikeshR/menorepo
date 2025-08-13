import React, { useEffect, useState } from 'react';
import {
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { useAuthStore } from '../../store/authStore';
import { useWebSocketStore } from '../../store/websocketStore';
import { apiService } from '../../services/api';
import { PortfolioSummary, SystemHealth, Order } from '../../types';
import { toast } from 'react-hot-toast';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'green' | 'red' | 'blue' | 'yellow';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon: Icon, color = 'blue' }) => {
  const colorClasses = {
    green: 'bg-success-50 text-success-600 border-success-200',
    red: 'bg-danger-50 text-danger-600 border-danger-200',
    blue: 'bg-primary-50 text-primary-600 border-primary-200',
    yellow: 'bg-warning-50 text-warning-600 border-warning-200',
  };

  const changeColor = change && change >= 0 ? 'text-success-600' : 'text-danger-600';
  const ChangeIcon = change && change >= 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;

  return (
    <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900">{value}</div>
                {change !== undefined && (
                  <div className={`ml-2 flex items-baseline text-sm font-semibold ${changeColor}`}>
                    <ChangeIcon className="self-center flex-shrink-0 h-4 w-4 mr-1" />
                    {Math.abs(change).toFixed(2)}%
                  </div>
                )}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { portfolioData, ordersData, isConnected } = useWebSocketStore();
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [portfolioHistory, setPortfolioHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Update data from WebSocket
  useEffect(() => {
    if (portfolioData) {
      setPortfolioSummary(portfolioData);
    }
  }, [portfolioData]);

  useEffect(() => {
    if (ordersData && ordersData.length > 0) {
      setRecentOrders(ordersData.slice(0, 5));
    }
  }, [ordersData]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [summary, health, orders, history] = await Promise.allSettled([
        apiService.getPortfolioSummary(),
        apiService.getSystemHealth(),
        apiService.getOrders({ limit: 5 }),
        apiService.getPortfolioHistory(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
          new Date().toISOString(),
          '1d'
        ),
      ]);

      if (summary.status === 'fulfilled') setPortfolioSummary(summary.value);
      if (health.status === 'fulfilled') setSystemHealth(health.value);
      if (orders.status === 'fulfilled') setRecentOrders(orders.value);
      if (history.status === 'fulfilled') setPortfolioHistory(history.value);
      
      // Handle any errors
      [summary, health, orders, history].forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Dashboard data load error ${index}:`, result.reason);
        }
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Chart configuration
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false,
        },
      },
      y: {
        display: true,
        grid: {
          color: 'rgba(0,0,0,0.1)',
        },
      },
    },
    elements: {
      line: {
        tension: 0.3,
      },
      point: {
        radius: 0,
      },
    },
  };

  const chartData = {
    labels: portfolioHistory.map(h => new Date(h.timestamp).toLocaleDateString()),
    datasets: [
      {
        label: 'Portfolio Value',
        data: portfolioHistory.map(h => h.total_value),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      },
    ],
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8"></div>
        <span className="ml-3 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.full_name || user?.username}!
            </h1>
            <p className="text-gray-600 mt-1">
              Here's your trading system overview for {new Date().toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-success-400' : 'bg-danger-400'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Live Data' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* System Health Alert */}
      {systemHealth && systemHealth.status !== 'healthy' && (
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-warning-400 mr-3 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-warning-800">System Alert</h3>
              <p className="text-sm text-warning-700 mt-1">
                System status: {systemHealth.status}. Check the System page for more details.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Portfolio Value"
          value={portfolioSummary?.total_value ? `$${Number(portfolioSummary.total_value).toLocaleString()}` : 'Loading...'}
          change={portfolioSummary?.daily_pnl_percent}
          icon={CurrencyDollarIcon}
          color={portfolioSummary && portfolioSummary.daily_pnl >= 0 ? 'green' : 'red'}
        />
        
        <StatCard
          title="Today's P&L"
          value={portfolioSummary?.daily_pnl !== undefined ? `$${Number(portfolioSummary.daily_pnl).toLocaleString()}` : 'Loading...'}
          change={portfolioSummary?.daily_pnl_percent}
          icon={portfolioSummary && portfolioSummary.daily_pnl >= 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon}
          color={portfolioSummary && portfolioSummary.daily_pnl >= 0 ? 'green' : 'red'}
        />

        <StatCard
          title="Active Positions"
          value={portfolioSummary ? portfolioSummary.total_positions : 'Loading...'}
          icon={ChartBarIcon}
          color="blue"
        />

        <StatCard
          title="Recent Orders"
          value={recentOrders.length}
          icon={ClockIcon}
          color="yellow"
        />
      </div>

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Performance Chart */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Portfolio Performance (30d)</h3>
          </div>
          <div className="h-64">
            {portfolioHistory.length > 0 ? (
              <Line options={chartOptions} data={chartData} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No historical data available
              </div>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Orders</h3>
          <div className="space-y-3">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      order.status === 'filled' ? 'bg-success-400' :
                      order.status === 'cancelled' ? 'bg-danger-400' :
                      order.status === 'pending' ? 'bg-warning-400' :
                      'bg-gray-400'
                    }`}></div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {order.side.toUpperCase()} {order.symbol}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.quantity} shares @ ${order.price}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-900 capitalize">{order.status}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No recent orders
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Status */}
      {systemHealth && (
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                systemHealth.status === 'healthy' 
                  ? 'bg-success-100 text-success-800' 
                  : 'bg-danger-100 text-danger-800'
              }`}>
                {systemHealth.status === 'healthy' ? '✓ Healthy' : '⚠ Issues Detected'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Overall Status</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {systemHealth.uptime ? `${Math.floor(systemHealth.uptime / 3600)}h ${Math.floor((systemHealth.uptime % 3600) / 60)}m` : 'N/A'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Uptime</div>
            </div>

            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {systemHealth.last_heartbeat ? new Date(systemHealth.last_heartbeat).toLocaleTimeString() : 'N/A'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Last Heartbeat</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;