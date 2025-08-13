import React, { useEffect, useState } from 'react';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ChartPieIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { useWebSocketStore } from '../../store/websocketStore';
import { apiService } from '../../services/api';
import { PortfolioSummary, Position, PortfolioPerformance } from '../../types';
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
  ArcElement
);

interface PositionCardProps {
  position: Position;
}

const PositionCard: React.FC<PositionCardProps> = ({ position }) => {
  const isPositive = Number(position.unrealized_pnl || 0) >= 0;
  const costBasis = (position.avg_price && position.quantity) ? Number(position.avg_price) * Number(position.quantity) : 0;
  const pnlPercent = (position.unrealized_pnl && costBasis > 0) ? ((Number(position.unrealized_pnl) / costBasis) * 100) : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">{position.symbol}</h4>
          <p className="text-sm text-gray-500">{position.quantity} shares</p>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${isPositive ? 'text-success-600' : 'text-danger-600'}`}>
            ${position.unrealized_pnl ? Number(position.unrealized_pnl).toLocaleString() : '0'}
          </div>
          <div className={`text-xs ${isPositive ? 'text-success-500' : 'text-danger-500'}`}>
            {isPositive ? '▲' : '▼'} {pnlPercent ? Math.abs(pnlPercent).toFixed(2) : '0.00'}%
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Avg Price:</span>
          <div className="font-medium">${position.avg_price ? Number(position.avg_price).toFixed(2) : '0.00'}</div>
        </div>
        <div>
          <span className="text-gray-500">Current:</span>
          <div className="font-medium">${position.current_price ? Number(position.current_price).toFixed(2) : '0.00'}</div>
        </div>
        <div>
          <span className="text-gray-500">Market Value:</span>
          <div className="font-medium">${position.market_value ? Number(position.market_value).toLocaleString() : '0'}</div>
        </div>
        <div>
          <span className="text-gray-500">Cost Basis:</span>
          <div className="font-medium">${(position.avg_price && position.quantity) ? Number(position.avg_price * position.quantity).toLocaleString() : '0'}</div>
        </div>
      </div>

      {position.last_updated && (
        <div className="text-xs text-gray-400 mt-2">
          Updated: {new Date(position.last_updated).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

const PortfolioPage: React.FC = () => {
  const { portfolioData, isConnected } = useWebSocketStore();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [performance, setPerformance] = useState<PortfolioPerformance | null>(null);
  const [allocation, setAllocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPortfolioData();
  }, []);

  // Update data from WebSocket
  useEffect(() => {
    if (portfolioData) {
      setSummary(portfolioData);
      if (portfolioData.positions) {
        setPositions(portfolioData.positions);
      }
    }
  }, [portfolioData]);

  const loadPortfolioData = async () => {
    try {
      setLoading(true);
      const [summaryData, positionsData, performanceData, allocationData] = await Promise.allSettled([
        apiService.getPortfolioSummary(),
        apiService.getPositions(),
        apiService.getPortfolioPerformance(),
        apiService.getPortfolioAllocation(),
      ]);

      if (summaryData.status === 'fulfilled') setSummary(summaryData.value);
      if (positionsData.status === 'fulfilled') setPositions(positionsData.value);
      if (performanceData.status === 'fulfilled') setPerformance(performanceData.value);
      if (allocationData.status === 'fulfilled') setAllocation(allocationData.value);

      // Handle errors
      [summaryData, positionsData, performanceData, allocationData].forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Portfolio data load error ${index}:`, result.reason);
        }
      });
    } catch (error) {
      console.error('Error loading portfolio data:', error);
      toast.error('Failed to load portfolio data');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadPortfolioData();
    setRefreshing(false);
    toast.success('Portfolio data refreshed');
  };

  // Chart configurations
  const allocationChartData = allocation ? {
    labels: allocation.sectors?.map((s: any) => s.sector) || [],
    datasets: [
      {
        data: allocation.sectors?.map((s: any) => s.percentage) || [],
        backgroundColor: [
          '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
          '#F97316', '#06B6D4', '#84CC16', '#EC4899', '#6B7280',
        ],
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  } : null;

  const performanceChartData = performance ? {
    labels: performance.daily_returns?.map((_, index) => `Day ${index + 1}`) || [],
    datasets: [
      {
        label: 'Portfolio',
        data: performance.daily_returns || [],
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      },
      {
        label: 'Benchmark',
        data: performance.benchmark_returns || [],
        borderColor: '#6B7280',
        backgroundColor: 'rgba(107, 114, 128, 0.1)',
        fill: false,
      },
    ],
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8"></div>
        <span className="ml-3 text-gray-600">Loading portfolio...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio</h1>
          <p className="text-gray-600 mt-1">Monitor your investments and performance</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-success-400' : 'bg-danger-400'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Live Data' : 'Offline'}
            </span>
          </div>
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-8 w-8 text-primary-600" />
            <div className="ml-4">
              <div className="text-sm text-gray-500">Total Value</div>
              <div className="text-2xl font-bold text-gray-900">
                ${summary?.total_value ? Number(summary.total_value).toLocaleString() : '0'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
              summary && summary.daily_pnl >= 0 ? 'bg-success-100' : 'bg-danger-100'
            }`}>
              {summary && summary.daily_pnl >= 0 ? 
                <ArrowTrendingUpIcon className="h-5 w-5 text-success-600" /> : 
                <ArrowTrendingDownIcon className="h-5 w-5 text-danger-600" />
              }
            </div>
            <div className="ml-4">
              <div className="text-sm text-gray-500">Today's P&L</div>
              <div className={`text-2xl font-bold ${
                summary && summary.daily_pnl >= 0 ? 'text-success-600' : 'text-danger-600'
              }`}>
                ${summary?.daily_pnl !== undefined ? Number(summary.daily_pnl).toLocaleString() : '0'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <ChartPieIcon className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <div className="text-sm text-gray-500">Positions</div>
              <div className="text-2xl font-bold text-gray-900">
                {summary?.total_positions || 0}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <div className="text-sm text-gray-500">Cash</div>
              <div className="text-2xl font-bold text-gray-900">
                ${summary?.cash_balance ? Number(summary.cash_balance).toLocaleString() : '0'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Performance vs Benchmark</h3>
          <div className="h-64">
            {performanceChartData ? (
              <Line options={chartOptions} data={performanceChartData} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No performance data available
              </div>
            )}
          </div>
        </div>

        {/* Allocation Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Sector Allocation</h3>
          <div className="h-64">
            {allocationChartData ? (
              <Doughnut 
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: {
                      position: 'right' as const,
                    },
                  },
                }} 
                data={allocationChartData} 
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No allocation data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Positions Grid */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Current Positions</h3>
        {positions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {positions.map((position) => (
              <PositionCard key={position.symbol} position={position} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <ChartPieIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No positions</h3>
            <p className="text-gray-500">You don't have any open positions yet.</p>
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      {performance && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {performance.total_return ? (performance.total_return * 100).toFixed(2) : '0.00'}%
              </div>
              <div className="text-sm text-gray-500">Total Return</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {performance.sharpe_ratio?.toFixed(2) || 'N/A'}
              </div>
              <div className="text-sm text-gray-500">Sharpe Ratio</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {(performance.volatility && !isNaN(performance.volatility)) ? (performance.volatility * 100).toFixed(2) + '%' : 'N/A'}
              </div>
              <div className="text-sm text-gray-500">Volatility</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {(performance.max_drawdown && !isNaN(performance.max_drawdown)) ? (performance.max_drawdown * 100).toFixed(2) + '%' : 'N/A'}
              </div>
              <div className="text-sm text-gray-500">Max Drawdown</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioPage;