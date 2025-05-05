import axios from 'axios';
import { RootState } from '../store';

// Create axios instance with base URL
export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    // If token exists, add it to request headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const originalRequest = error.config;
    
    // Handle expired token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Clear user data and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    // Handle server errors
    if (error.response?.status === 500) {
      console.error('Server error:', error.response.data);
    }
    
    return Promise.reject(error);
  }
);

// Auth service
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/users/login', { email, password });
    return response.data;
  },
  
  register: async (name: string, email: string, password: string) => {
    const response = await api.post('/users/register', { name, email, password });
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem('token');
  },
  
  getUserProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },
  
  updateUserProfile: async (userData: any) => {
    const response = await api.put('/users/profile', userData);
    return response.data;
  },
};

// Products service
export const productsApi = {
  getProducts: async (keyword = '', page = 1, category = '') => {
    const response = await api.get(
      `/products?keyword=${keyword}&page=${page}&category=${category}`
    );
    return response.data;
  },
  
  getProductById: async (id: string) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },
  
  getTopProducts: async (limit = 5) => {
    const response = await api.get(`/products/top?limit=${limit}`);
    return response.data;
  },
  
  getCategories: async () => {
    const response = await api.get('/products/categories');
    return response.data;
  },
  
  getProductsByCategory: async (category: string, page = 1) => {
    const response = await api.get(`/products/categories/${category}?page=${page}`);
    return response.data;
  },
};

// Orders service
export const ordersApi = {
  createOrder: async (orderData: any) => {
    const response = await api.post('/orders', orderData);
    return response.data;
  },
  
  getOrderById: async (id: string) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },
  
  updateOrderToPaid: async (id: string, paymentResult: any) => {
    const response = await api.put(`/orders/${id}/pay`, paymentResult);
    return response.data;
  },
  
  getMyOrders: async () => {
    const response = await api.get('/orders/myorders');
    return response.data;
  },
};

// Configure axios instance with token from Redux store (alternative approach)
export const configureAxiosWithStore = (store: { getState: () => RootState }) => {
  api.interceptors.request.use(
    (config) => {
      const state = store.getState();
      const token = state.user?.userInfo?.token;
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
};