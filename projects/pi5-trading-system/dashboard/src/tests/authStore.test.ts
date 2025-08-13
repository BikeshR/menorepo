import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../store/authStore';
import { apiService } from '../services/api';

// Mock apiService
vi.mock('../services/api', () => ({
  apiService: {
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock console methods
global.console.error = vi.fn();

describe('Auth Store', () => {
  const mockUser = {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'trader' as const,
    is_active: true,
    created_at: '2023-01-01T00:00:00Z',
  };

  const mockLoginResponse = {
    success: true,
    access_token: 'mock_access_token',
    refresh_token: 'mock_refresh_token',
    token_type: 'bearer',
    expires_in: 3600,
    user: mockUser,
    timestamp: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Login', () => {
    it('should login successfully', async () => {
      (apiService.login as any).mockResolvedValue(mockLoginResponse);
      
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      expect(apiService.login).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123',
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle login errors', async () => {
      const errorResponse = {
        response: {
          data: {
            error: {
              message: 'Invalid credentials',
            },
          },
        },
      };

      (apiService.login as any).mockRejectedValue(errorResponse);
      
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.login('testuser', 'wrongpassword');
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Invalid credentials');
    });

    it('should handle login errors without specific message', async () => {
      const errorResponse = new Error('Network error');
      (apiService.login as any).mockRejectedValue(errorResponse);
      
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.login('testuser', 'password123');
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Login failed');
    });

    it('should set loading state during login', async () => {
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      (apiService.login as any).mockReturnValue(loginPromise);
      
      const { result } = renderHook(() => useAuthStore());

      // Start login
      act(() => {
        result.current.login('testuser', 'password123');
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();

      // Resolve login
      await act(async () => {
        resolveLogin!(mockLoginResponse);
        await loginPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Logout', () => {
    beforeEach(async () => {
      // Set up authenticated state
      const { result } = renderHook(() => useAuthStore());
      act(() => {
        result.current.setUser(mockUser);
      });
    });

    it('should logout successfully', async () => {
      (apiService.logout as any).mockResolvedValue({});
      
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.isAuthenticated).toBe(true);

      await act(async () => {
        await result.current.logout();
      });

      expect(apiService.logout).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should logout even if API call fails', async () => {
      const error = new Error('Logout API error');
      (apiService.logout as any).mockRejectedValue(error);
      
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.logout();
      });

      expect(global.console.error).toHaveBeenCalledWith('Logout error:', error);
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should set loading state during logout', async () => {
      let resolveLogout: () => void;
      const logoutPromise = new Promise<void>((resolve) => {
        resolveLogout = resolve;
      });

      (apiService.logout as any).mockReturnValue(logoutPromise);
      
      const { result } = renderHook(() => useAuthStore());

      // Start logout
      act(() => {
        result.current.logout();
      });

      expect(result.current.isLoading).toBe(true);

      // Resolve logout
      await act(async () => {
        resolveLogout!();
        await logoutPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Set User', () => {
    it('should set user and authentication state', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(mockUser);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should clear user and authentication state when setting null', () => {
      const { result } = renderHook(() => useAuthStore());

      // Set user first
      act(() => {
        result.current.setUser(mockUser);
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Clear user
      act(() => {
        result.current.setUser(null);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Check Auth', () => {
    it('should authenticate user from localStorage', () => {
      const mockToken = 'valid_token';
      const userString = JSON.stringify(mockUser);

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'access_token') return mockToken;
        if (key === 'user') return userString;
        return null;
      });

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.checkAuth();
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith('access_token');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('user');
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should not authenticate without token', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.checkAuth();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should not authenticate without user data', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'access_token') return 'valid_token';
        if (key === 'user') return null;
        return null;
      });
      
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.checkAuth();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle invalid JSON in localStorage', () => {
      const mockToken = 'valid_token';
      const invalidUserJson = 'invalid json';

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'access_token') return mockToken;
        if (key === 'user') return invalidUserJson;
        return null;
      });

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.checkAuth();
      });

      expect(global.console.error).toHaveBeenCalledWith(
        'Error parsing user data:',
        expect.any(SyntaxError)
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('access_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refresh_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Clear Error', () => {
    it('should clear error state', async () => {
      // Create an error state first
      const errorResponse = {
        response: {
          data: {
            error: {
              message: 'Test error',
            },
          },
        },
      };

      (apiService.login as any).mockRejectedValue(errorResponse);
      
      const { result } = renderHook(() => useAuthStore());

      // Generate error
      await act(async () => {
        try {
          await result.current.login('testuser', 'wrongpassword');
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Test error');

      // Clear error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Store Integration', () => {
    it('should maintain state across multiple hook instances', async () => {
      (apiService.login as any).mockResolvedValue(mockLoginResponse);
      
      const { result: result1 } = renderHook(() => useAuthStore());
      const { result: result2 } = renderHook(() => useAuthStore());

      // Login from first instance
      await act(async () => {
        await result1.current.login('testuser', 'password123');
      });

      // Both instances should have the same state
      expect(result1.current.user).toEqual(mockUser);
      expect(result2.current.user).toEqual(mockUser);
      expect(result1.current.isAuthenticated).toBe(true);
      expect(result2.current.isAuthenticated).toBe(true);
    });

    it('should handle concurrent login attempts', async () => {
      (apiService.login as any).mockResolvedValue(mockLoginResponse);
      
      const { result } = renderHook(() => useAuthStore());

      // Start multiple login attempts
      const loginPromise1 = act(async () => {
        await result.current.login('testuser1', 'password123');
      });

      const loginPromise2 = act(async () => {
        await result.current.login('testuser2', 'password456');
      });

      await Promise.all([loginPromise1, loginPromise2]);

      // Should have been called twice
      expect(apiService.login).toHaveBeenCalledTimes(2);
      // State should reflect the last successful login
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined user data gracefully', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser(undefined as any);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle empty string credentials', async () => {
      (apiService.login as any).mockRejectedValue(new Error('Validation error'));
      
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.login('', '');
        } catch (error) {
          // Expected to throw
        }
      });

      expect(apiService.login).toHaveBeenCalledWith({
        username: '',
        password: '',
      });
      expect(result.current.error).toBe('Login failed');
    });

    it('should handle special characters in credentials', async () => {
      (apiService.login as any).mockResolvedValue(mockLoginResponse);
      
      const { result } = renderHook(() => useAuthStore());
      const specialUsername = 'test@user+special';
      const specialPassword = 'p@ssw0rd!@#$%^&*()';

      await act(async () => {
        await result.current.login(specialUsername, specialPassword);
      });

      expect(apiService.login).toHaveBeenCalledWith({
        username: specialUsername,
        password: specialPassword,
      });
      expect(result.current.isAuthenticated).toBe(true);
    });
  });
});