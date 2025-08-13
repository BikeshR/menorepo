import React, { useEffect, useState } from 'react';
import {
  CpuChipIcon,
  ServerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ClockIcon,
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
} from 'chart.js';
import { useWebSocketStore } from '../../store/websocketStore';
import { useAuthStore } from '../../store/authStore';
import { apiService } from '../../services/api';
import { SystemHealth, SystemMetrics } from '../../types';
import { toast } from 'react-hot-toast';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface MetricCardProps {
  title: string;
  value: string | number;
  status?: 'healthy' | 'warning' | 'error';
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, status, icon: Icon, description }) => {
  const statusColors = {
    healthy: 'bg-success-50 border-success-200',
    warning: 'bg-warning-50 border-warning-200',
    error: 'bg-danger-50 border-danger-200',
  };

  const iconColors = {
    healthy: 'text-success-600',
    warning: 'text-warning-600',
    error: 'text-danger-600',
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${status ? statusColors[status] : 'border-gray-200'}`}>
      <div className="flex items-center">
        <Icon className={`h-8 w-8 ${status ? iconColors[status] : 'text-gray-600'}`} />
        <div className="ml-4 flex-1">
          <div className="text-sm font-medium text-gray-500">{title}</div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          {description && (
            <div className="text-xs text-gray-500 mt-1">{description}</div>
          )}
        </div>
      </div>
    </div>
  );
};

interface ServiceStatusProps {
  name: string;
  status: 'running' | 'stopped' | 'error';
  uptime?: string;
  lastCheck?: string;
}

const ServiceStatus: React.FC<ServiceStatusProps> = ({ name, status, uptime, lastCheck }) => {
  const statusIcons = {
    running: <CheckCircleIcon className="h-5 w-5 text-success-500" />,
    stopped: <XCircleIcon className="h-5 w-5 text-gray-500" />,
    error: <ExclamationTriangleIcon className="h-5 w-5 text-danger-500" />,
  };

  const statusColors = {
    running: 'bg-success-100 text-success-800',
    stopped: 'bg-gray-100 text-gray-800',
    error: 'bg-danger-100 text-danger-800',
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center space-x-3">
        {statusIcons[status]}
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          {lastCheck && (
            <div className="text-xs text-gray-500">
              Last check: {new Date(lastCheck).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-3">
        {uptime && (
          <div className="text-sm text-gray-600">
            Uptime: {uptime}
          </div>
        )}
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}>
          {status}
        </span>
      </div>
    </div>
  );
};

const SystemPage: React.FC = () => {
  const { user } = useAuthStore();
  const { systemData, isConnected } = useWebSocketStore();
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // Check if user has admin access
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      loadSystemData();
    }
  }, [isAdmin]);

  // Update data from WebSocket
  useEffect(() => {
    if (systemData) {
      // Update relevant system data from WebSocket
      setSystemStatus((prevStatus: any) => ({
        ...prevStatus,
        ...systemData,
      }));
    }
  }, [systemData]);

  const loadSystemData = async () => {
    try {
      setLoading(true);
      const [healthResult, metricsResult, statusResult] = await Promise.allSettled([
        apiService.getSystemHealth(),
        apiService.getSystemMetrics(),
        apiService.getSystemStatus(),
      ]);

      if (healthResult.status === 'fulfilled') {
        setSystemHealth(healthResult.value);
      }
      if (metricsResult.status === 'fulfilled') {
        setSystemMetrics(metricsResult.value);
      }
      if (statusResult.status === 'fulfilled') {
        setSystemStatus(statusResult.value);
      }

      // Handle errors
      [healthResult, metricsResult, statusResult].forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`System data load error ${index}:`, result.reason);
        }
      });
    } catch (error) {
      console.error('Error loading system data:', error);
      toast.error('Failed to load system data');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadSystemData();
    setRefreshing(false);
    toast.success('System data refreshed');
  };

  const handleRestartSystem = async () => {
    if (!window.confirm('Are you sure you want to restart the system? This may cause temporary downtime.')) {
      return;
    }

    try {
      setRestarting(true);
      await apiService.restartSystem();
      // Wait a bit before refreshing data
      setTimeout(() => {
        loadSystemData();
        setRestarting(false);
      }, 5000);
    } catch (error) {
      console.error('Error restarting system:', error);
      setRestarting(false);
    }
  };

  // Chart configuration
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
      },
    },
  };

  const generateChartData = () => {
    const now = new Date();
    const labels = [];
    const cpuData = [];
    const memoryData = [];

    // Generate sample data for the last 24 hours
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      labels.push(time.getHours() + ':00');
      cpuData.push(Math.random() * 100);
      memoryData.push(Math.random() * 100);
    }

    return {
      labels,
      datasets: [
        {
          label: 'CPU Usage (%)',
          data: cpuData,
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
        },
        {
          label: 'Memory Usage (%)',
          data: memoryData,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
        },
      ],
    };
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <ServerIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
        <p className="text-gray-500">You don't have permission to access system management.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8"></div>
        <span className="ml-3 text-gray-600">Loading system data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Monitor</h1>
          <p className="text-gray-600 mt-1">Monitor system health and performance</p>
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
          <button
            onClick={handleRestartSystem}
            disabled={restarting}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-danger-600 hover:bg-danger-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-danger-500 disabled:opacity-50"
          >
            {restarting ? (
              <>
                <div className="loading-spinner w-4 h-4 mr-2"></div>
                Restarting...
              </>
            ) : (
              <>
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Restart System
              </>
            )}
          </button>
        </div>
      </div>

      {/* System Health Alert */}
      {systemHealth && systemHealth.status !== 'healthy' && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-danger-400 mr-3 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-danger-800">System Issues Detected</h3>
              <p className="text-sm text-danger-700 mt-1">
                System status: {systemHealth.status}. Please check the details below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="System Status"
          value={systemHealth?.status || 'Unknown'}
          status={systemHealth?.status === 'healthy' ? 'healthy' : 'error'}
          icon={systemHealth?.status === 'healthy' ? CheckCircleIcon : ExclamationTriangleIcon}
        />
        
        <MetricCard
          title="Uptime"
          value={
            systemHealth?.uptime 
              ? `${Math.floor(systemHealth.uptime / 3600)}h ${Math.floor((systemHealth.uptime % 3600) / 60)}m`
              : 'Unknown'
          }
          icon={ClockIcon}
        />

        <MetricCard
          title="CPU Usage"
          value={systemMetrics?.cpu_usage ? `${systemMetrics.cpu_usage.toFixed(1)}%` : 'N/A'}
          status={
            systemMetrics?.cpu_usage 
              ? systemMetrics.cpu_usage > 80 ? 'error' 
                : systemMetrics.cpu_usage > 60 ? 'warning' 
                : 'healthy'
              : undefined
          }
          icon={CpuChipIcon}
        />

        <MetricCard
          title="Memory Usage"
          value={systemMetrics?.memory_usage ? `${systemMetrics.memory_usage.toFixed(1)}%` : 'N/A'}
          status={
            systemMetrics?.memory_usage 
              ? systemMetrics.memory_usage > 85 ? 'error' 
                : systemMetrics.memory_usage > 70 ? 'warning' 
                : 'healthy'
              : undefined
          }
          icon={ServerIcon}
        />
      </div>

      {/* Performance Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Performance (24h)</h3>
        <div className="h-64">
          <Line options={chartOptions} data={generateChartData()} />
        </div>
      </div>

      {/* Service Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Core Services</h3>
          <div className="space-y-1">
            <ServiceStatus
              name="Trading Engine"
              status={systemStatus?.trading_engine_status || 'running'}
              uptime={systemStatus?.trading_engine_uptime}
              lastCheck={systemStatus?.last_health_check}
            />
            <ServiceStatus
              name="Market Data Feed"
              status={systemStatus?.market_data_status || 'running'}
              uptime={systemStatus?.market_data_uptime}
              lastCheck={systemStatus?.last_health_check}
            />
            <ServiceStatus
              name="Risk Manager"
              status={systemStatus?.risk_manager_status || 'running'}
              uptime={systemStatus?.risk_manager_uptime}
              lastCheck={systemStatus?.last_health_check}
            />
            <ServiceStatus
              name="Portfolio Manager"
              status={systemStatus?.portfolio_manager_status || 'running'}
              uptime={systemStatus?.portfolio_manager_uptime}
              lastCheck={systemStatus?.last_health_check}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">External Services</h3>
          <div className="space-y-1">
            <ServiceStatus
              name="Database Connection"
              status={systemStatus?.database_status || 'running'}
              lastCheck={systemStatus?.last_health_check}
            />
            <ServiceStatus
              name="Broker API"
              status={systemStatus?.broker_api_status || 'running'}
              lastCheck={systemStatus?.last_health_check}
            />
            <ServiceStatus
              name="WebSocket Server"
              status={isConnected ? 'running' : 'error'}
              lastCheck={new Date().toISOString()}
            />
            <ServiceStatus
              name="Notification Service"
              status={systemStatus?.notification_status || 'running'}
              lastCheck={systemStatus?.last_health_check}
            />
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Version Info</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>System Version: {systemStatus?.version || '1.0.0'}</div>
              <div>Build: {systemStatus?.build || 'stable'}</div>
              <div>Environment: {systemStatus?.environment || 'production'}</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Resources</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Total Memory: {systemMetrics?.total_memory || 'Unknown'}</div>
              <div>Available Memory: {systemMetrics?.available_memory || 'Unknown'}</div>
              <div>Disk Usage: {systemMetrics?.disk_usage || 'Unknown'}</div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Network</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Active Connections: {systemMetrics?.active_connections || 'Unknown'}</div>
              <div>Network I/O: {systemMetrics?.network_io ? JSON.stringify(systemMetrics.network_io) : 'Unknown'}</div>
              <div>API Requests/min: {systemMetrics?.api_requests_per_minute || 'Unknown'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent System Logs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent System Events</h3>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {systemStatus?.recent_events?.map((event: any, index: number) => (
            <div key={index} className="flex items-start space-x-3 text-sm">
              <div className="flex-shrink-0 mt-1">
                <div className={`h-2 w-2 rounded-full ${
                  event.level === 'error' ? 'bg-danger-400' :
                  event.level === 'warning' ? 'bg-warning-400' :
                  'bg-success-400'
                }`}></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-gray-900">{event.message}</div>
                <div className="text-gray-500 text-xs mt-1">
                  {event.timestamp ? new Date(event.timestamp).toLocaleString() : 'N/A'}
                </div>
              </div>
            </div>
          )) || (
            <div className="text-center py-4 text-gray-500">
              No recent events
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemPage;