import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CogIcon,
  CubeIcon,
  HomeIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useWebSocketStore } from "../../store/websocketStore";

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const navigation: NavigationItem[] = [
  { name: "Dashboard", href: "/", icon: HomeIcon },
  { name: "Portfolio", href: "/portfolio", icon: ChartBarIcon },
  {
    name: "Strategies",
    href: "/strategies",
    icon: CubeIcon,
    roles: ["admin", "trader"],
  },
  { name: "Orders", href: "/orders", icon: ClipboardDocumentListIcon },
  { name: "System", href: "/system", icon: CogIcon, roles: ["admin"] },
];

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { isConnected, error: wsError, systemData } = useWebSocketStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Filter navigation based on user role
  const filteredNavigation = navigation.filter(
    (item) => !item.roles || (user?.role && item.roles.includes(user.role))
  );

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Show WebSocket connection status
  useEffect(() => {
    if (wsError) {
      toast.error(`Connection error: ${wsError}`);
    }
  }, [wsError]);

  const Sidebar = ({ className }: { className?: string }) => (
    <div className={className}>
      <div className="flex flex-col h-0 flex-1">
        {/* Logo */}
        <div className="flex items-center h-16 flex-shrink-0 px-4 bg-primary-700">
          <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center mr-3">
            <svg
              className="h-5 w-5 text-primary-600"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-label="Pi5 Trading System Logo"
            >
              <title>Pi5 Trading System Logo</title>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="text-white">
            <div className="text-lg font-bold">Pi5 Trading</div>
            <div className="text-xs text-primary-200">System</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-5 flex-1 px-2 bg-primary-800 space-y-1">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? "bg-primary-900 text-white"
                    : "text-primary-200 hover:bg-primary-700 hover:text-white"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon
                  className={`mr-3 flex-shrink-0 h-5 w-5 ${
                    isActive ? "text-white" : "text-primary-300 group-hover:text-white"
                  }`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User info and logout */}
        <div className="flex-shrink-0 bg-primary-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <UserCircleIcon className="h-8 w-8 text-primary-200" />
              <div className="ml-3">
                <div className="text-sm font-medium text-white">
                  {user?.full_name || user?.username}
                </div>
                <div className="text-xs text-primary-200 capitalize">{user?.role}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-primary-200 hover:text-white transition-colors"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Connection Status */}
          <div className="mt-2 flex items-center">
            <div
              className={`h-2 w-2 rounded-full mr-2 ${isConnected ? "bg-success-400" : "bg-danger-400"}`}
            />
            <span className="text-xs text-primary-200">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 flex z-40 md:hidden">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setSidebarOpen(false)}
          />

          {/* Sidebar */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-primary-800">
            {/* Close button */}
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <XMarkIcon className="h-6 w-6 text-white" />
              </button>
            </div>
            <Sidebar />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar className="flex flex-col w-64 bg-primary-800" />
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow">
          {/* Mobile menu button */}
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          {/* Top bar content */}
          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex-1 flex">
              <h1 className="text-2xl font-semibold text-gray-900 capitalize">
                {location.pathname === "/" ? "Dashboard" : location.pathname.slice(1)}
              </h1>
            </div>

            {/* Right side of top bar */}
            <div className="ml-4 flex items-center space-x-4">
              {/* System alerts */}
              {systemData?.status === "error" && (
                <div className="flex items-center text-danger-600">
                  <BellIcon className="h-5 w-5 mr-1" />
                  <span className="text-sm font-medium">System Alert</span>
                </div>
              )}

              {/* Connection status indicator */}
              <div className="flex items-center">
                <div
                  className={`h-3 w-3 rounded-full mr-2 ${isConnected ? "bg-success-400" : "bg-danger-400"}`}
                />
                <span className="text-sm text-gray-600 hidden sm:block">
                  {isConnected ? "Live" : "Offline"}
                </span>
              </div>

              {/* User info - mobile */}
              <div className="md:hidden">
                <UserCircleIcon className="h-8 w-8 text-gray-400" />
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
