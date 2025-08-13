import { create } from 'zustand';
import { apiService } from '../services/api';
import { WebSocketMessage } from '../types';

interface WebSocketState {
  socket: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
  subscriptions: Set<string>;
  
  // Real-time data
  portfolioData: any;
  ordersData: any[];
  strategiesData: any[];
  systemData: any;
  
  // Actions
  connect: (clientId: string) => void;
  disconnect: () => void;
  subscribe: (channels: string[]) => void;
  unsubscribe: (channels: string[]) => void;
  sendMessage: (message: any) => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  lastMessage: null,
  subscriptions: new Set(),
  
  // Real-time data
  portfolioData: null,
  ordersData: [],
  strategiesData: [],
  systemData: null,

  connect: (clientId: string) => {
    const { socket, isConnecting } = get();
    
    // Don't create multiple connections
    if (socket || isConnecting) return;
    
    set({ isConnecting: true, error: null });
    
    try {
      const newSocket = apiService.createWebSocket(clientId);
      
      newSocket.onopen = () => {
        console.log('WebSocket connected');
        set({
          socket: newSocket,
          isConnected: true,
          isConnecting: false,
          error: null,
        });
      };
      
      newSocket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        set({
          socket: null,
          isConnected: false,
          isConnecting: false,
          error: event.reason || 'Connection closed',
          subscriptions: new Set(),
        });
        
        // Auto-reconnect after 5 seconds if not manually closed
        if (event.code !== 1000) {
          setTimeout(() => {
            const currentState = get();
            if (!currentState.socket && !currentState.isConnecting) {
              currentState.connect(clientId);
            }
          }, 5000);
        }
      };
      
      newSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        set({
          error: 'Connection error',
          isConnecting: false,
        });
      };
      
      newSocket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          set({ lastMessage: message });
          
          // Handle different message types
          switch (message.type) {
            case 'connection':
              console.log('WebSocket connection confirmed:', message.data);
              break;
              
            case 'portfolio_update':
              set({ portfolioData: message.data });
              break;
              
            case 'position_update':
              // Update specific position in portfolio data
              const { portfolioData } = get();
              if (portfolioData) {
                set({
                  portfolioData: {
                    ...portfolioData,
                    positions: portfolioData.positions?.map((pos: any) =>
                      pos.symbol === message.data.symbol ? { ...pos, ...message.data } : pos
                    ) || [],
                  },
                });
              }
              break;
              
            case 'order_update':
              const currentOrders = get().ordersData;
              const existingOrderIndex = currentOrders.findIndex(
                (order) => order.id === message.data.id
              );
              
              if (existingOrderIndex >= 0) {
                // Update existing order
                const updatedOrders = [...currentOrders];
                updatedOrders[existingOrderIndex] = { ...updatedOrders[existingOrderIndex], ...message.data };
                set({ ordersData: updatedOrders });
              } else {
                // Add new order
                set({ ordersData: [message.data, ...currentOrders] });
              }
              break;
              
            case 'strategy_update':
            case 'strategy_signal':
              const currentStrategies = get().strategiesData;
              const existingStrategyIndex = currentStrategies.findIndex(
                (strategy) => strategy.id === message.data.id || strategy.id === message.data.strategy_id
              );
              
              if (existingStrategyIndex >= 0) {
                // Update existing strategy
                const updatedStrategies = [...currentStrategies];
                updatedStrategies[existingStrategyIndex] = {
                  ...updatedStrategies[existingStrategyIndex],
                  ...message.data,
                };
                set({ strategiesData: updatedStrategies });
              } else if (message.data.id) {
                // Add new strategy
                set({ strategiesData: [message.data, ...currentStrategies] });
              }
              break;
              
            case 'system_update':
            case 'system_alert':
            case 'system_status':
              set({ systemData: message.data });
              break;
              
            case 'subscription_confirmed':
              console.log('Subscription confirmed:', message.data);
              break;
              
            case 'pong':
              // Handle keepalive response
              break;
              
            default:
              console.log('Unknown WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      // Keep connection alive with ping
      const pingInterval = setInterval(() => {
        const currentSocket = get().socket;
        if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
          currentSocket.send(JSON.stringify({
            type: 'ping',
            timestamp: new Date().toISOString(),
          }));
        } else {
          clearInterval(pingInterval);
        }
      }, 30000); // Ping every 30 seconds
      
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      set({
        isConnecting: false,
        error: 'Failed to create WebSocket connection',
      });
    }
  },

  disconnect: () => {
    const { socket } = get();
    
    if (socket) {
      socket.close(1000, 'Manual disconnect');
    }
    
    set({
      socket: null,
      isConnected: false,
      isConnecting: false,
      subscriptions: new Set(),
      portfolioData: null,
      ordersData: [],
      strategiesData: [],
      systemData: null,
    });
  },

  subscribe: (channels: string[]) => {
    const { socket, isConnected, subscriptions } = get();
    
    if (!socket || !isConnected) {
      console.warn('Cannot subscribe: WebSocket not connected');
      return;
    }
    
    const newSubscriptions = new Set([...Array.from(subscriptions), ...channels]);
    
    socket.send(JSON.stringify({
      type: 'subscribe',
      channels,
      timestamp: new Date().toISOString(),
    }));
    
    set({ subscriptions: newSubscriptions });
  },

  unsubscribe: (channels: string[]) => {
    const { socket, isConnected, subscriptions } = get();
    
    if (!socket || !isConnected) {
      console.warn('Cannot unsubscribe: WebSocket not connected');
      return;
    }
    
    const newSubscriptions = new Set(subscriptions);
    channels.forEach(channel => newSubscriptions.delete(channel));
    
    socket.send(JSON.stringify({
      type: 'unsubscribe',
      channels,
      timestamp: new Date().toISOString(),
    }));
    
    set({ subscriptions: newSubscriptions });
  },

  sendMessage: (message: any) => {
    const { socket, isConnected } = get();
    
    if (!socket || !isConnected) {
      console.warn('Cannot send message: WebSocket not connected');
      return;
    }
    
    socket.send(JSON.stringify({
      ...message,
      timestamp: new Date().toISOString(),
    }));
  },
}));