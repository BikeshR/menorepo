import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}));

// Mock WebSocket
global.WebSocket = vi.fn();

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Chart.js
vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn(),
  },
  CategoryScale: vi.fn(),
  LinearScale: vi.fn(),
  PointElement: vi.fn(),
  LineElement: vi.fn(),
  Title: vi.fn(),
  Tooltip: vi.fn(),
  Legend: vi.fn(),
  Filler: vi.fn(),
  ArcElement: vi.fn(),
}));

// Mock react-chartjs-2
vi.mock('react-chartjs-2', () => ({
  Line: vi.fn(() => ({ type: 'div', props: { 'data-testid': 'line-chart', children: 'Line Chart' } })),
  Doughnut: vi.fn(() => ({ type: 'div', props: { 'data-testid': 'doughnut-chart', children: 'Doughnut Chart' } })),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
}));

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => {
  const MockIcon = ({ className, ...props }: any) => ({
    type: 'svg',
    props: { className, ...props, 'data-testid': 'heroicon', children: { type: 'path', props: {} } }
  });

  return {
    CurrencyDollarIcon: MockIcon,
    ArrowTrendingUpIcon: MockIcon,
    ArrowTrendingDownIcon: MockIcon,
    ChartBarIcon: MockIcon,
    ClockIcon: MockIcon,
    ExclamationTriangleIcon: MockIcon,
    CheckCircleIcon: MockIcon,
    XCircleIcon: MockIcon,
    ArrowPathIcon: MockIcon,
    ChartPieIcon: MockIcon,
    Bars3Icon: MockIcon,
    XMarkIcon: MockIcon,
    BellIcon: MockIcon,
    UserCircleIcon: MockIcon,
    ArrowRightOnRectangleIcon: MockIcon,
    HomeIcon: MockIcon,
    CubeIcon: MockIcon,
    ClipboardDocumentListIcon: MockIcon,
    CogIcon: MockIcon,
    PlayIcon: MockIcon,
    PauseIcon: MockIcon,
    StopIcon: MockIcon,
    PlusIcon: MockIcon,
    TrashIcon: MockIcon,
    FunnelIcon: MockIcon,
    MagnifyingGlassIcon: MockIcon,
    CpuChipIcon: MockIcon,
    ServerIcon: MockIcon,
    EyeIcon: MockIcon,
    EyeSlashIcon: MockIcon,
  };
});

// Setup global fetch mock
global.fetch = vi.fn();

// Suppress specific console warnings during tests
const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  const warningMessage = args[0];
  
  // Suppress React Router warnings in tests
  if (typeof warningMessage === 'string' && 
      (warningMessage.includes('React Router') || 
       warningMessage.includes('useNavigate') ||
       warningMessage.includes('useLocation'))) {
    return;
  }
  
  // Suppress Chart.js warnings in tests
  if (typeof warningMessage === 'string' && 
      warningMessage.includes('Chart.js')) {
    return;
  }
  
  originalConsoleWarn.apply(console, args);
};