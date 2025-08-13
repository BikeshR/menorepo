import React, { useEffect, useState } from 'react';
import {
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useWebSocketStore } from '../../store/websocketStore';
import { useAuthStore } from '../../store/authStore';
import { apiService } from '../../services/api';
import { Order, Trade, CreateOrderFormData } from '../../types';
import { toast } from 'react-hot-toast';

interface OrderRowProps {
  order: Order;
  onCancel: (id: string) => void;
}

const OrderRow: React.FC<OrderRowProps> = ({ order, onCancel }) => {
  const statusIcons: Record<string, React.ReactElement> = {
    pending: <ClockIcon className="h-4 w-4 text-warning-500" />,
    filled: <CheckCircleIcon className="h-4 w-4 text-success-500" />,
    cancelled: <XCircleIcon className="h-4 w-4 text-danger-500" />,
    rejected: <XCircleIcon className="h-4 w-4 text-danger-500" />,
    expired: <XCircleIcon className="h-4 w-4 text-gray-500" />,
    partial: <ClockIcon className="h-4 w-4 text-blue-500" />,
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-warning-100 text-warning-800',
    filled: 'bg-success-100 text-success-800',
    cancelled: 'bg-gray-100 text-gray-800',
    rejected: 'bg-danger-100 text-danger-800',
    expired: 'bg-gray-100 text-gray-800',
    partial: 'bg-blue-100 text-blue-800',
  };

  const canCancel = order.status === 'pending' || order.status === 'partial';

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          {statusIcons[order.status] || statusIcons.pending}
          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            statusColors[order.status] || statusColors.pending
          }`}>
            {order.status}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {order.symbol}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        <span className={`font-medium ${
          order.side === 'buy' ? 'text-success-600' : 'text-danger-600'
        }`}>
          {order.side.toUpperCase()}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {order.quantity ? Number(order.quantity).toLocaleString() : '0'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {order.order_type}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        ${order.price ? Number(order.price).toFixed(2) : 'Market'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {order.filled_quantity?.toLocaleString() || 0}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {new Date(order.created_at).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <div className="flex items-center space-x-2">
          {canCancel && (
            <button
              onClick={() => onCancel(order.id)}
              className="text-danger-600 hover:text-danger-900 transition-colors"
              title="Cancel Order"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

interface TradeRowProps {
  trade: Trade;
}

const TradeRow: React.FC<TradeRowProps> = ({ trade }) => {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {trade.symbol}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        <span className={`font-medium ${
          trade.side === 'buy' ? 'text-success-600' : 'text-danger-600'
        }`}>
          {trade.side.toUpperCase()}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {trade.quantity ? Number(trade.quantity).toLocaleString() : '0'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        ${trade.price ? Number(trade.price).toFixed(2) : '0.00'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        ${(trade.quantity && trade.price) ? Number(trade.quantity * trade.price).toLocaleString() : '0'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {trade.executed_at ? new Date(trade.executed_at).toLocaleString() : 'N/A'}
      </td>
    </tr>
  );
};

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateOrderFormData) => void;
}

const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<CreateOrderFormData>({
    symbol: '',
    side: 'buy',
    quantity: 100,
    order_type: 'market',
    price: undefined,
    time_in_force: 'DAY',
    stop_loss: undefined,
    take_profit: undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
    // Reset form
    setFormData({
      symbol: '',
      side: 'buy',
      quantity: 100,
      order_type: 'market',
      price: undefined,
      time_in_force: 'DAY',
      stop_loss: undefined,
      take_profit: undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Create New Order</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Symbol
                </label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  placeholder="AAPL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Side
                </label>
                <select
                  value={formData.side}
                  onChange={(e) => setFormData({ ...formData, side: e.target.value as 'buy' | 'sell' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Type
                </label>
                <select
                  value={formData.order_type}
                  onChange={(e) => setFormData({ ...formData, order_type: e.target.value as 'market' | 'limit' | 'stop' | 'stop_limit' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                  <option value="stop">Stop</option>
                  <option value="stop_limit">Stop Limit</option>
                </select>
              </div>
            </div>

            {(formData.order_type === 'limit' || formData.order_type === 'stop_limit') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price ($)
                </label>
                <input
                  type="number"
                  value={formData.price || ''}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time in Force
              </label>
              <select
                value={formData.time_in_force}
                onChange={(e) => setFormData({ ...formData, time_in_force: e.target.value as 'DAY' | 'GTC' | 'IOC' | 'FOK' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="DAY">Day</option>
                <option value="GTC">Good Till Cancelled</option>
                <option value="IOC">Immediate or Cancel</option>
                <option value="FOK">Fill or Kill</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stop Loss ($)
                </label>
                <input
                  type="number"
                  value={formData.stop_loss || ''}
                  onChange={(e) => setFormData({ ...formData, stop_loss: e.target.value ? Number(e.target.value) : undefined })}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Take Profit ($)
                </label>
                <input
                  type="number"
                  value={formData.take_profit || ''}
                  onChange={(e) => setFormData({ ...formData, take_profit: e.target.value ? Number(e.target.value) : undefined })}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
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
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                  formData.side === 'buy' 
                    ? 'bg-success-600 hover:bg-success-700' 
                    : 'bg-danger-600 hover:bg-danger-700'
                }`}
              >
                Place {formData.side === 'buy' ? 'Buy' : 'Sell'} Order
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const OrdersPage: React.FC = () => {
  const { user } = useAuthStore();
  const { ordersData, isConnected } = useWebSocketStore();
  const [activeTab, setActiveTab] = useState<'orders' | 'trades'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Check if user can create orders
  const canCreateOrders = user?.role === 'admin' || user?.role === 'trader';

  useEffect(() => {
    loadOrdersData();
  }, []);

  // Update orders from WebSocket
  useEffect(() => {
    if (ordersData && ordersData.length > 0) {
      setOrders(ordersData);
    }
  }, [ordersData]);

  const loadOrdersData = async () => {
    try {
      setLoading(true);
      const [ordersResult, tradesResult] = await Promise.allSettled([
        apiService.getOrders({ limit: 100 }),
        apiService.getTrades({ limit: 100 }),
      ]);

      if (ordersResult.status === 'fulfilled') {
        setOrders(ordersResult.value);
      }
      if (tradesResult.status === 'fulfilled') {
        setTrades(tradesResult.value);
      }

      // Handle errors
      [ordersResult, tradesResult].forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Orders data load error ${index}:`, result.reason);
        }
      });
    } catch (error) {
      console.error('Error loading orders data:', error);
      toast.error('Failed to load orders data');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadOrdersData();
    setRefreshing(false);
    toast.success('Orders data refreshed');
  };

  const handleCreateOrder = async (data: CreateOrderFormData) => {
    try {
      await apiService.createOrder(data);
      await loadOrdersData(); // Refresh data
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    try {
      await apiService.cancelOrder(orderId);
      await loadOrdersData(); // Refresh data
    } catch (error) {
      console.error('Error cancelling order:', error);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filter trades
  const filteredTrades = trades.filter(trade => 
    trade.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8"></div>
        <span className="ml-3 text-gray-600">Loading orders...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders & Trades</h1>
          <p className="text-gray-600 mt-1">Manage your orders and view trading history</p>
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
          {canCreateOrders && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              New Order
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'orders'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Orders ({filteredOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'trades'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Trades ({filteredTrades.length})
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
            />
          </div>
          
          {activeTab === 'orders' && (
            <div className="flex items-center space-x-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="filled">Filled</option>
                <option value="cancelled">Cancelled</option>
                <option value="rejected">Rejected</option>
                <option value="partial">Partial</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Orders Table */}
      {activeTab === 'orders' && (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Symbol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Side
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Filled
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <OrderRow 
                    key={order.id} 
                    order={order} 
                    onCancel={handleCancelOrder}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Trades Table */}
      {activeTab === 'trades' && (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Symbol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Side
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Executed At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTrades.length > 0 ? (
                filteredTrades.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} />
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No trades found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateOrder}
      />
    </div>
  );
};

export default OrdersPage;