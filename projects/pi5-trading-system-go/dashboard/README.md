# Pi5 Trading System - React Dashboard

React-based dashboard for the Pi5 Trading System Go implementation.

## Tech Stack

- **React 19** with TypeScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Chart.js** - Data visualization
- **React Query** - Server state management
- **Zustand** - Client state management
- **React Router** - Navigation
- **React Hook Form + Zod** - Form handling and validation
- **Axios** - HTTP client

## Features

### Dashboard Pages
- 🏠 **Dashboard** - Overview with key metrics and charts
- 📊 **Portfolio** - Portfolio tracking, positions, and P&L
- 🎯 **Strategies** - Strategy management and performance
- 📝 **Orders** - Order history and execution details
- ⚙️ **System** - System health and monitoring

### UI Features
- 🌓 Dark/Light theme toggle
- 📱 Responsive design
- ⚡ Real-time updates
- 📊 Interactive charts
- 🔐 Authentication with JWT
- 🍞 Toast notifications
- ✨ Modern UI components

## Development

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Installation

```bash
cd dashboard
npm install
```

### Run Development Server

```bash
npm run dev
```

The dashboard will be available at `http://localhost:5173` and will proxy API requests to the Go backend on `http://localhost:8081`.

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, which the Go server will serve.

### Linting and Formatting

```bash
# Check code quality
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run type-check
```

## Configuration

### API Endpoint

The API endpoint is configured in `src/services/api.ts`:

```typescript
this.baseURL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === "production"
    ? window.location.origin
    : "http://localhost:8081");
```

**Development**: API requests go to `http://localhost:8081`
**Production**: API requests go to the same origin (served by Go backend)

You can override with environment variable:
```bash
REACT_APP_API_URL=http://custom-api:8081 npm run dev
```

## Project Structure

```
dashboard/
├── public/              # Static assets
├── src/
│   ├── components/      # React components
│   │   ├── Auth/        # Authentication components
│   │   ├── Layout/      # Layout components
│   │   ├── Pages/       # Page components
│   │   └── ui/          # Reusable UI components
│   ├── contexts/        # React contexts (theme, etc.)
│   ├── services/        # API service layer
│   ├── types/           # TypeScript type definitions
│   ├── App.tsx          # Root component
│   └── index.tsx        # Entry point
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── tailwind.config.js   # Tailwind CSS configuration
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
└── vitest.config.ts     # Test configuration
```

## API Integration

The dashboard expects the following API endpoints:

### Authentication
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh token
- `GET /auth/me` - Get current user

### Portfolio
- `GET /api/v1/portfolio/summary` - Portfolio overview
- `GET /api/v1/portfolio/positions` - All positions
- `GET /api/v1/portfolio/positions/{symbol}` - Specific position
- `GET /api/v1/portfolio/performance` - Performance metrics
- `GET /api/v1/portfolio/history` - Historical data
- `GET /api/v1/portfolio/allocation` - Allocation breakdown

### Strategies
- `GET /api/v1/strategies/` - Available strategies
- `GET /api/v1/strategies/active` - Active strategies
- `POST /api/v1/strategies/` - Create strategy
- `GET /api/v1/strategies/{id}` - Get strategy
- `PUT /api/v1/strategies/{id}` - Update strategy
- `DELETE /api/v1/strategies/{id}` - Delete strategy
- `POST /api/v1/strategies/{id}/action` - Control strategy (start/stop)
- `GET /api/v1/strategies/{id}/performance` - Strategy performance

### Orders
- `GET /api/v1/orders/` - List orders
- `POST /api/v1/orders/` - Create order
- `GET /api/v1/orders/{id}` - Get order
- `DELETE /api/v1/orders/{id}` - Cancel order
- `GET /api/v1/orders/trades/history` - Trade history

### System
- `GET /api/v1/system/health` - System health
- `GET /api/v1/system/metrics` - System metrics
- `GET /api/v1/system/status` - System status
- `POST /api/v1/system/restart` - Restart system

## Authentication

The dashboard uses JWT authentication:

1. Login with credentials
2. Receive `access_token` and `refresh_token`
3. Store tokens in localStorage
4. Include `Authorization: Bearer <token>` in API requests
5. Auto-refresh expired tokens

## Development Tips

### Hot Module Replacement
Vite provides instant HMR - changes appear without full page reload.

### Browser DevTools
- React DevTools extension recommended
- Network tab to debug API calls
- Console for logging

### Common Issues

**CORS errors**: Make sure the Go backend has CORS enabled for development.

**API connection refused**: Ensure the Go backend is running on port 8081.

**Build errors**: Run `npm install` to ensure all dependencies are installed.

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

## Production Deployment

The dashboard is automatically built and served by the Go backend when using Docker:

```bash
# Build Docker image (includes frontend build)
docker build -t pi5-trading-go .

# Or use docker-compose
cd deployments
docker compose up -d
```

Access the dashboard at `http://localhost:8081/`

## License

Same as parent project - for educational purposes.
