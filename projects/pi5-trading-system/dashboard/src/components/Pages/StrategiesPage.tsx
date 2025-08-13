import React, { useEffect, useState } from 'react';
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  PlusIcon,
  CogIcon,
  TrashIcon,
  ChartBarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useWebSocketStore } from '../../store/websocketStore';
import { useAuthStore } from '../../store/authStore';
import { apiService } from '../../services/api';
import { Strategy, StrategyInfo, CreateStrategyFormData } from '../../types';
import { toast } from 'react-hot-toast';

interface StrategyCardProps {
  strategy: Strategy;
  onControl: (id: string, action: string) => void;
  onEdit: (strategy: Strategy) => void;
  onDelete: (id: string) => void;
  onViewPerformance: (id: string) => void;
}

const StrategyCard: React.FC<StrategyCardProps> = ({ 
  strategy, 
  onControl, 
  onEdit, 
  onDelete, 
  onViewPerformance 
}) => {
  const statusColors: Record<string, string> = {
    active: 'bg-success-100 text-success-800',
    inactive: 'bg-gray-100 text-gray-800',
    paused: 'bg-warning-100 text-warning-800',
    stopped: 'bg-gray-100 text-gray-800',
    error: 'bg-danger-100 text-danger-800',
  };

  const isRunning = strategy.status === 'active';
  const isPaused = strategy.status === 'paused';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{strategy.name}</h3>
          <p className="text-sm text-gray-500 mt-1">{strategy.description}</p>
          <div className="flex items-center space-x-4 mt-3">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              statusColors[strategy.status] || statusColors.stopped
            }`}>
              {strategy.status}
            </span>
            <span className="text-sm text-gray-500">
              Type: {strategy.strategy_type}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!isRunning && !isPaused && (
            <button
              onClick={() => onControl(strategy.id, 'start')}
              className="p-2 text-success-600 hover:bg-success-50 rounded-md transition-colors"
              title="Start Strategy"
            >
              <PlayIcon className="h-5 w-5" />
            </button>
          )}
          
          {isRunning && (
            <button
              onClick={() => onControl(strategy.id, 'pause')}
              className="p-2 text-warning-600 hover:bg-warning-50 rounded-md transition-colors"
              title="Pause Strategy"
            >
              <PauseIcon className="h-5 w-5" />
            </button>
          )}

          {isPaused && (
            <button
              onClick={() => onControl(strategy.id, 'resume')}
              className="p-2 text-success-600 hover:bg-success-50 rounded-md transition-colors"
              title="Resume Strategy"
            >
              <PlayIcon className="h-5 w-5" />
            </button>
          )}

          {(isRunning || isPaused) && (
            <button
              onClick={() => onControl(strategy.id, 'stop')}
              className="p-2 text-danger-600 hover:bg-danger-50 rounded-md transition-colors"
              title="Stop Strategy"
            >
              <StopIcon className="h-5 w-5" />
            </button>
          )}

          <button
            onClick={() => onViewPerformance(strategy.id)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="View Performance"
          >
            <ChartBarIcon className="h-5 w-5" />
          </button>

          <button
            onClick={() => onEdit(strategy)}
            className="p-2 text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
            title="Edit Strategy"
          >
            <CogIcon className="h-5 w-5" />
          </button>

          <button
            onClick={() => onDelete(strategy.id)}
            className="p-2 text-danger-600 hover:bg-danger-50 rounded-md transition-colors"
            title="Delete Strategy"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Symbols:</span>
          <div className="font-medium">
            {Array.isArray(strategy.symbols) ? strategy.symbols.join(', ') : strategy.symbols || 'N/A'}
          </div>
        </div>
        <div>
          <span className="text-gray-500">Allocation:</span>
          <div className="font-medium">${strategy.allocation?.toLocaleString() || '0'}</div>
        </div>
        <div>
          <span className="text-gray-500">P&L:</span>
          <div className={`font-medium ${
            strategy.total_pnl && strategy.total_pnl >= 0 ? 'text-success-600' : 'text-danger-600'
          }`}>
            ${strategy.total_pnl?.toLocaleString() || '0'}
          </div>
        </div>
        <div>
          <span className="text-gray-500">Risk Level:</span>
          <div className="font-medium capitalize">{strategy.risk_level || 'N/A'}</div>
        </div>
      </div>

      {strategy.last_signal && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <div className="text-sm">
            <span className="text-gray-500">Last Signal:</span>
            <div className="mt-1">
              <span className="font-medium">{strategy.last_signal.signal_type}</span>
              {strategy.last_signal.symbol && (
                <span className="ml-2 text-gray-600">({strategy.last_signal.symbol})</span>
              )}
              <div className="text-xs text-gray-500 mt-1">
                {new Date(strategy.last_signal.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface CreateStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateStrategyFormData) => void;
  availableStrategies: StrategyInfo[];
  editingStrategy?: Strategy | null;
}

const CreateStrategyModal: React.FC<CreateStrategyModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  availableStrategies,
  editingStrategy,
}) => {
  const [formData, setFormData] = useState<CreateStrategyFormData>({
    name: '',
    description: '',
    strategy_type: '',
    symbols: [],
    parameters: {},
    allocation: 10000,
    risk_level: 'medium',
  });

  useEffect(() => {
    if (editingStrategy) {
      setFormData({
        name: editingStrategy.name,
        description: editingStrategy.description || '',
        strategy_type: editingStrategy.strategy_type,
        symbols: Array.isArray(editingStrategy.symbols) ? editingStrategy.symbols : [editingStrategy.symbols].filter(Boolean),
        parameters: editingStrategy.parameters || {},
        allocation: editingStrategy.allocation || 10000,
        risk_level: editingStrategy.risk_level || 'medium',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        strategy_type: '',
        symbols: [],
        parameters: {},
        allocation: 10000,
        risk_level: 'medium',
      });
    }
  }, [editingStrategy]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {editingStrategy ? 'Edit Strategy' : 'Create New Strategy'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Strategy Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Strategy Type
                </label>
                <select
                  value={formData.strategy_type}
                  onChange={(e) => setFormData({ ...formData, strategy_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Select a strategy type</option>
                  {availableStrategies.map((strategy) => (
                    <option key={strategy.name} value={strategy.name}>
                      {strategy.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Symbols (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.symbols.join(', ')}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    symbols: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                  placeholder="AAPL, GOOGL, MSFT"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Allocation ($)
                </label>
                <input
                  type="number"
                  value={formData.allocation}
                  onChange={(e) => setFormData({ ...formData, allocation: Number(e.target.value) })}
                  min="1000"
                  step="1000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Risk Level
              </label>
              <select
                value={formData.risk_level}
                onChange={(e) => setFormData({ ...formData, risk_level: e.target.value as 'low' | 'medium' | 'high' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
              >
                {editingStrategy ? 'Update Strategy' : 'Create Strategy'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const StrategiesPage: React.FC = () => {
  const { user } = useAuthStore();
  const { strategiesData, isConnected } = useWebSocketStore();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [availableStrategies, setAvailableStrategies] = useState<StrategyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);

  // Check if user has permission to manage strategies
  const canManageStrategies = user?.role === 'admin' || user?.role === 'trader';

  useEffect(() => {
    loadStrategiesData();
  }, []);

  // Update data from WebSocket
  useEffect(() => {
    if (strategiesData && strategiesData.length > 0) {
      setStrategies(strategiesData);
    }
  }, [strategiesData]);

  const loadStrategiesData = async () => {
    try {
      setLoading(true);
      const [activeStrategies, availableStrategiesData] = await Promise.allSettled([
        apiService.getActiveStrategies(),
        apiService.getAvailableStrategies(),
      ]);

      if (activeStrategies.status === 'fulfilled') {
        setStrategies(activeStrategies.value);
      }
      if (availableStrategiesData.status === 'fulfilled') {
        setAvailableStrategies(availableStrategiesData.value);
      }

      // Handle errors
      [activeStrategies, availableStrategiesData].forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Strategies data load error ${index}:`, result.reason);
        }
      });
    } catch (error) {
      console.error('Error loading strategies data:', error);
      toast.error('Failed to load strategies data');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadStrategiesData();
    setRefreshing(false);
    toast.success('Strategies data refreshed');
  };

  const handleControlStrategy = async (id: string, action: string) => {
    try {
      await apiService.controlStrategy(id, action);
      await loadStrategiesData(); // Refresh data
    } catch (error) {
      console.error('Error controlling strategy:', error);
    }
  };

  const handleCreateStrategy = async (data: CreateStrategyFormData) => {
    try {
      await apiService.createStrategy(data);
      await loadStrategiesData(); // Refresh data
    } catch (error) {
      console.error('Error creating strategy:', error);
    }
  };

  const handleEditStrategy = async (data: CreateStrategyFormData) => {
    if (!editingStrategy) return;
    try {
      await apiService.updateStrategy(editingStrategy.id, data);
      await loadStrategiesData(); // Refresh data
      setEditingStrategy(null);
    } catch (error) {
      console.error('Error updating strategy:', error);
    }
  };

  const handleDeleteStrategy = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this strategy?')) return;
    try {
      await apiService.deleteStrategy(id);
      await loadStrategiesData(); // Refresh data
    } catch (error) {
      console.error('Error deleting strategy:', error);
    }
  };

  const handleViewPerformance = (id: string) => {
    // This would typically open a modal or navigate to a detailed performance page
    toast('Performance view coming soon!');
  };

  if (!canManageStrategies) {
    return (
      <div className="text-center py-12">
        <CogIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
        <p className="text-gray-500">You don't have permission to manage strategies.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8"></div>
        <span className="ml-3 text-gray-600">Loading strategies...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Strategies</h1>
          <p className="text-gray-600 mt-1">Manage and monitor your trading strategies</p>
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
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            New Strategy
          </button>
        </div>
      </div>

      {/* Strategies Grid */}
      {strategies.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {strategies.map((strategy) => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              onControl={handleControlStrategy}
              onEdit={(strategy) => {
                setEditingStrategy(strategy);
                setShowCreateModal(true);
              }}
              onDelete={handleDeleteStrategy}
              onViewPerformance={handleViewPerformance}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <CogIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No strategies</h3>
          <p className="text-gray-500 mb-6">Get started by creating your first trading strategy.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Strategy
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      <CreateStrategyModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingStrategy(null);
        }}
        onSubmit={editingStrategy ? handleEditStrategy : handleCreateStrategy}
        availableStrategies={availableStrategies}
        editingStrategy={editingStrategy}
      />
    </div>
  );
};

export default StrategiesPage;