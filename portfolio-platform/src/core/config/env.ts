/**
 * Environment Variable Validation
 *
 * Validates all required environment variables at startup.
 * Provides type-safe access to env vars throughout the application.
 *
 * Benefits:
 * - Catch configuration errors early (at startup, not at runtime)
 * - Type-safe access to environment variables
 * - Single source of truth for env var names
 * - Clear documentation of what env vars are needed
 */

import { z } from 'zod'

/**
 * Environment Variable Schema
 *
 * Add all environment variables here with validation rules.
 * The app will fail to start if any required vars are missing or invalid.
 */
const envSchema = z.object({
  // ============================================
  // Next.js
  // ============================================
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // ============================================
  // Supabase
  // ============================================
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required').optional(), // Optional in development (can use anon key)

  // ============================================
  // Authentication
  // ============================================
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters for security'),
  ADMIN_USERNAME: z.string().min(1, 'ADMIN_USERNAME is required'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'),

  // ============================================
  // Trading212 API (Optional - for portfolio module)
  // ============================================
  TRADING212_API_KEY: z.string().optional(),
  TRADING212_BASE_URL: z.string().url().optional(),

  // ============================================
  // Kraken API (Optional - for crypto portfolio)
  // ============================================
  KRAKEN_API_KEY: z.string().optional(),
  KRAKEN_PRIVATE_KEY: z.string().optional(),
  KRAKEN_BASE_URL: z.string().url().optional(),

  // ============================================
  // Alpha Vantage API (Optional - for stock data)
  // ============================================
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  ALPHA_VANTAGE_BASE_URL: z.string().url().optional(),

  // ============================================
  // Appwrite (Optional - for file storage)
  // ============================================
  NEXT_PUBLIC_APPWRITE_ENDPOINT: z.string().url().optional(),
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: z.string().optional(),
  APPWRITE_API_KEY: z.string().optional(),

  // ============================================
  // NewsAPI (Optional - for portfolio news)
  // ============================================
  NEWS_API_KEY: z.string().optional(),

  // ============================================
  // Polygon.io API (Optional - for stock fundamentals)
  // ============================================
  POLYGON_API_KEY: z.string().optional(),
})

/**
 * Parse and validate environment variables
 *
 * This runs automatically when the module is imported.
 * The app will crash with a clear error message if validation fails.
 */
function validateEnv() {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:')
    console.error(JSON.stringify(parsed.error.format(), null, 2))
    throw new Error('Invalid environment variables. Check the errors above.')
  }

  return parsed.data
}

/**
 * Validated and type-safe environment variables
 *
 * Usage:
 * ```typescript
 * import { env } from '@/core/config/env'
 *
 * const url = env.NEXT_PUBLIC_SUPABASE_URL  // Type-safe!
 * ```
 */
export const env = validateEnv()

/**
 * Type for environment variables (for TypeScript autocomplete)
 */
export type Env = z.infer<typeof envSchema>

/**
 * Check if a specific API integration is configured
 *
 * Useful for conditionally enabling features based on what APIs are available.
 */
export const isConfigured = {
  trading212: Boolean(env.TRADING212_API_KEY && env.TRADING212_BASE_URL),
  kraken: Boolean(env.KRAKEN_API_KEY && env.KRAKEN_PRIVATE_KEY),
  alphaVantage: Boolean(env.ALPHA_VANTAGE_API_KEY),
  appwrite: Boolean(
    env.NEXT_PUBLIC_APPWRITE_ENDPOINT && env.NEXT_PUBLIC_APPWRITE_PROJECT_ID && env.APPWRITE_API_KEY
  ),
  newsApi: Boolean(env.NEWS_API_KEY),
  polygon: Boolean(env.POLYGON_API_KEY),
}

/**
 * Get configuration status for debugging
 */
export function getConfigStatus() {
  return {
    environment: env.NODE_ENV,
    configured: isConfigured,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
  }
}
