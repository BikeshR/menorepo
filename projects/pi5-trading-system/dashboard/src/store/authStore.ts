import { create } from "zustand";
import { apiService } from "../services/api";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  checkAuth: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiService.login({ username, password });
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      let errorMessage = "Login failed";
      
      // Type guard for axios error
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as { 
          response?: { data?: { error?: { message?: string } } } 
        };
        if (axiosError.response?.data?.error?.message) {
          errorMessage = axiosError.response.data.error.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });

    try {
      await apiService.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  setUser: (user: User | null) => {
    set({
      user,
      isAuthenticated: !!user,
      error: null,
    });
  },

  checkAuth: () => {
    const token = localStorage.getItem("access_token");
    const userStr = localStorage.getItem("user");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({
          user,
          isAuthenticated: true,
        });
      } catch (error) {
        console.error("Error parsing user data:", error);
        // Clear invalid data
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        set({
          user: null,
          isAuthenticated: false,
        });
      }
    } else {
      set({
        user: null,
        isAuthenticated: false,
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
