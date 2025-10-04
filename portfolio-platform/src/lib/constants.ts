// Application constants

export const APP_NAME = 'Portfolio Platform'
export const APP_DESCRIPTION = 'Showcase your projects and manage your portfolio'

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  ADMIN: '/admin',
  ADMIN_PROFILE: '/admin/profile',
  ADMIN_PROJECTS: '/admin/projects',
  ADMIN_INVESTMENTS: '/admin/investments',
} as const

// API Routes
export const API_ROUTES = {
  AUTH_SIGNOUT: '/api/auth/signout',
} as const

// Environment
export const IS_PRODUCTION = process.env.NODE_ENV === 'production'
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'

// Supabase
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

// Site
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Project Status
export const PROJECT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const

// Investment Types
export const INVESTMENT_TYPES = {
  STOCK: 'stock',
  CRYPTO: 'crypto',
  ETF: 'etf',
  BOND: 'bond',
  REAL_ESTATE: 'real_estate',
  OTHER: 'other',
} as const

// Transaction Types
export const TRANSACTION_TYPES = {
  BUY: 'buy',
  SELL: 'sell',
  DIVIDEND: 'dividend',
  FEE: 'fee',
} as const

// Pagination
export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 100

// Form validation
export const PASSWORD_MIN_LENGTH = 6
export const BIO_MAX_LENGTH = 500
