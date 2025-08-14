import type React from "react";
import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import LoginPage from "./components/Auth/LoginPage";
import ErrorBoundary from "./components/ErrorBoundary";

// Layout Components
import DashboardLayout from "./components/Layout/DashboardLayout";
// Page Components
import DashboardPage from "./components/Pages/DashboardPage";
import OrdersPage from "./components/Pages/OrdersPage";
import PortfolioPage from "./components/Pages/PortfolioPage";
import StrategiesPage from "./components/Pages/StrategiesPage";
import SystemPage from "./components/Pages/SystemPage";
import { useAuthStore } from "./store/authStore";
import { useWebSocketStore } from "./store/websocketStore";

// Loading Component (currently unused but kept for future use)
// const LoadingSpinner = () => (
//   <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//     <div className="text-center">
//       <div className="loading-spinner w-8 h-8 mx-auto mb-4"></div>
//       <p className="text-gray-600">Loading Pi5 Trading System...</p>
//     </div>
//   </div>
// );

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirect to dashboard if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (isAuthenticated) {
    const from = location.state?.from?.pathname || "/";
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
};

function App() {
  const { checkAuth, isAuthenticated, user } = useAuthStore();
  const { connect, disconnect, subscribe } = useWebSocketStore();

  useEffect(() => {
    // Check authentication status on app start
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // Setup WebSocket connection when authenticated
    if (isAuthenticated && user) {
      const clientId = `dashboard_${user.id}_${Date.now()}`;
      connect(clientId);

      // Subscribe to relevant channels based on user role
      const channels = ["portfolio", "orders", "system"];
      if (user.role === "admin" || user.role === "trader") {
        channels.push("strategies");
      }

      // Small delay to ensure connection is established
      setTimeout(() => {
        subscribe(channels);
      }, 1000);

      return () => {
        disconnect();
      };
    }
    
    // Return undefined explicitly when not authenticated
    return undefined;
  }, [isAuthenticated, user, connect, disconnect, subscribe]);

  return (
    <div className="App">
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/* Protected Routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Routes>
                  <Route
                    index
                    element={
                      <ErrorBoundary>
                        <DashboardPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="portfolio"
                    element={
                      <ErrorBoundary>
                        <PortfolioPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="strategies"
                    element={
                      <ErrorBoundary>
                        <StrategiesPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="orders"
                    element={
                      <ErrorBoundary>
                        <OrdersPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="system"
                    element={
                      <ErrorBoundary>
                        <SystemPage />
                      </ErrorBoundary>
                    }
                  />

                  {/* Catch all route */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
