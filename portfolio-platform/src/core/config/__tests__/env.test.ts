import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Environment Validation', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    // Restore original env
    process.env = originalEnv
    // Clear module cache to re-run validation
    vi.resetModules()
  })

  describe('Required Variables', () => {
    it('should pass validation with all required variables', async () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        SESSION_SECRET: 'this-is-a-very-long-secret-key-123456789',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'password123',
      }

      // Dynamic import to re-run validation
      const { env } = await import('../env')

      expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co')
      expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('test-anon-key')
      expect(env.SESSION_SECRET).toBe('this-is-a-very-long-secret-key-123456789')
      expect(env.ADMIN_USERNAME).toBe('admin')
      expect(env.ADMIN_PASSWORD).toBe('password123')
    })

    it('should fail if Supabase URL is missing', async () => {
      process.env = {
        ...originalEnv,
        NEXT_PUBLIC_SUPABASE_URL: '', // Missing!
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
        SESSION_SECRET: 'this-is-a-very-long-secret-key-123456789',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'password123',
      }

      await expect(async () => {
        await import('../env')
      }).rejects.toThrow('Invalid environment variables')
    })

    it('should fail if Supabase URL is invalid', async () => {
      process.env = {
        ...originalEnv,
        NEXT_PUBLIC_SUPABASE_URL: 'not-a-url', // Invalid!
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
        SESSION_SECRET: 'this-is-a-very-long-secret-key-123456789',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'password123',
      }

      await expect(async () => {
        await import('../env')
      }).rejects.toThrow()
    })

    it('should fail if SESSION_SECRET is too short', async () => {
      process.env = {
        ...originalEnv,
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
        SESSION_SECRET: 'short', // Too short! (less than 32 chars)
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'password123',
      }

      await expect(async () => {
        await import('../env')
      }).rejects.toThrow()
    })

    it('should fail if ADMIN_PASSWORD is too short', async () => {
      process.env = {
        ...originalEnv,
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
        SESSION_SECRET: 'this-is-a-very-long-secret-key-123456789',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'short', // Too short! (less than 8 chars)
      }

      await expect(async () => {
        await import('../env')
      }).rejects.toThrow()
    })
  })

  describe('Optional Variables', () => {
    it('should work without optional Trading212 vars', async () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
        SESSION_SECRET: 'this-is-a-very-long-secret-key-123456789',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'password123',
        // Trading212 vars not provided - should be fine
      }

      const { env, isConfigured } = await import('../env')

      expect(env.TRADING212_API_KEY).toBeUndefined()
      expect(isConfigured.trading212).toBe(false)
    })

    it('should detect Trading212 is configured when vars are present', async () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
        SESSION_SECRET: 'this-is-a-very-long-secret-key-123456789',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'password123',
        TRADING212_API_KEY: 'test-key',
        TRADING212_BASE_URL: 'https://trading212.com',
      }

      const { isConfigured } = await import('../env')

      expect(isConfigured.trading212).toBe(true)
    })
  })

  describe('isConfigured Helper', () => {
    it('should correctly detect configured integrations', async () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
        SESSION_SECRET: 'this-is-a-very-long-secret-key-123456789',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'password123',
        TRADING212_API_KEY: 'key1',
        TRADING212_BASE_URL: 'https://trading212.com',
        ALPHA_VANTAGE_API_KEY: 'key2',
        NEWS_API_KEY: 'key3',
      }

      const { isConfigured } = await import('../env')

      expect(isConfigured.trading212).toBe(true)
      expect(isConfigured.alphaVantage).toBe(true)
      expect(isConfigured.newsApi).toBe(true)
      expect(isConfigured.kraken).toBe(false) // Not configured
      expect(isConfigured.polygon).toBe(false) // Not configured
    })
  })

  describe('getConfigStatus', () => {
    it('should return configuration status', async () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'https://prod.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
        SESSION_SECRET: 'this-is-a-very-long-secret-key-123456789',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'password123',
        TRADING212_API_KEY: 'key',
        TRADING212_BASE_URL: 'https://trading212.com',
      }

      const { getConfigStatus } = await import('../env')
      const status = getConfigStatus()

      expect(status.environment).toBe('production')
      expect(status.supabaseUrl).toBe('https://prod.supabase.co')
      expect(status.configured.trading212).toBe(true)
    })
  })
})
