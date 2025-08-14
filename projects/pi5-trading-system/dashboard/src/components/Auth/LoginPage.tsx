import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import type React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useAuthStore } from "../../store/authStore";
import type { LoginFormData } from "../../types";

const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    try {
      clearError();
      await login(data.username, data.password);
      toast.success("Welcome to Pi5 Trading System!");
    } catch (_error) {
      // Error is handled by the store
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          {/* Logo */}
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-xl flex items-center justify-center">
            <svg
              className="h-10 w-10 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-label="Pi5 Trading System Logo"
            >
              <title>Pi5 Trading System Logo</title>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>

          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">Pi5 Trading System</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to access your trading dashboard
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="rounded-md shadow-sm -space-y-px">
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                {...register("username", {
                  required: "Username is required",
                  minLength: {
                    value: 3,
                    message: "Username must be at least 3 characters",
                  },
                })}
                type="text"
                autoComplete="username"
                className={`appearance-none rounded-none relative block w-full px-3 py-3 border ${
                  errors.username ? "border-danger-300" : "border-gray-300"
                } placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm`}
                placeholder="Username"
                disabled={isLoading}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-danger-600">{errors.username.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters",
                  },
                })}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className={`appearance-none rounded-none relative block w-full px-3 py-3 pr-10 border ${
                  errors.password ? "border-danger-300" : "border-gray-300"
                } placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm`}
                placeholder="Password"
                disabled={isLoading}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <EyeIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
              {errors.password && (
                <p className="mt-1 text-sm text-danger-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-danger-50 p-4">
              <div className="text-sm text-danger-700">{error}</div>
            </div>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="loading-spinner w-4 h-4 mr-2"></div>
                  Signing in...
                </div>
              ) : (
                "Sign in"
              )}
            </button>
          </div>

          {/* Demo Credentials */}
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Demo Credentials:</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span className="font-medium">Admin:</span>
                <span>admin / admin123</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Trader:</span>
                <span>trader / trader123</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Viewer:</span>
                <span>viewer / viewer123</span>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">Pi5 Trading System v1.0.0</p>
          <p className="text-xs text-gray-400 mt-1">Professional Algorithmic Trading Platform</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
