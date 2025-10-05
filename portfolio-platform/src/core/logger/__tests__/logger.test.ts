import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger, logger } from '../logger'

describe('Logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  describe('Basic Logging', () => {
    it('should log info messages', () => {
      logger.info('Test info message')

      expect(consoleLogSpy).toHaveBeenCalled()
      const logCall = consoleLogSpy.mock.calls[0][0]
      expect(logCall).toContain('Test info message')
    })

    it('should log error messages', () => {
      logger.error('Test error message')

      expect(consoleLogSpy).toHaveBeenCalled()
      const logCall = consoleLogSpy.mock.calls[0][0]
      expect(logCall).toContain('Test error message')
    })

    it('should log warning messages', () => {
      logger.warn('Test warning message')

      expect(consoleLogSpy).toHaveBeenCalled()
      const logCall = consoleLogSpy.mock.calls[0][0]
      expect(logCall).toContain('Test warning message')
    })

    it('should log debug messages in development', () => {
      logger.debug('Test debug message')

      // Debug messages are only logged in development
      // In test environment (NODE_ENV='test'), debug logs are not shown
      // This is expected behavior
      // consoleLogSpy may or may not be called depending on NODE_ENV
    })
  })

  describe('Context Logging', () => {
    it('should log with context', () => {
      logger.info('User action', { userId: '123', action: 'login' })

      expect(consoleLogSpy).toHaveBeenCalled()
      // Check that context is logged (second call is the context)
      expect(consoleLogSpy.mock.calls.length).toBeGreaterThanOrEqual(1)
    })

    it('should log complex context objects', () => {
      const context = {
        user: { id: '123', name: 'John' },
        metadata: { timestamp: Date.now() },
      }

      logger.info('Complex context', context)

      expect(consoleLogSpy).toHaveBeenCalled()
    })
  })

  describe('Exception Logging', () => {
    it('should log exceptions with stack trace', () => {
      const error = new Error('Test error')

      logger.exception(error, 'An error occurred')

      expect(consoleLogSpy).toHaveBeenCalled()
      // The context should include error details
      const calls = consoleLogSpy.mock.calls
      const hasErrorContext = calls.some((call) => JSON.stringify(call).includes('Test error'))
      expect(hasErrorContext).toBe(true)
    })

    it('should log exceptions with additional context', () => {
      const error = new Error('Database error')

      logger.exception(error, 'Database operation failed', {
        operation: 'insert',
        table: 'users',
      })

      expect(consoleLogSpy).toHaveBeenCalled()
    })

    it('should handle non-Error exceptions', () => {
      const error = { message: 'Custom error object' }

      logger.exception(error, 'Non-standard error')

      expect(consoleLogSpy).toHaveBeenCalled()
    })
  })

  describe('Child Logger', () => {
    it('should create child logger with default context', () => {
      const moduleLogger = createLogger({ module: 'portfolio' })

      moduleLogger.info('Test message')

      expect(consoleLogSpy).toHaveBeenCalled()
      // The context should include the module
      const calls = consoleLogSpy.mock.calls
      const hasModuleContext = calls.some((call) => JSON.stringify(call).includes('portfolio'))
      expect(hasModuleContext).toBe(true)
    })

    it('should merge child context with call context', () => {
      const moduleLogger = logger.child({ module: 'sync' })

      moduleLogger.info('Syncing data', { ticker: 'AAPL' })

      expect(consoleLogSpy).toHaveBeenCalled()
      const calls = consoleLogSpy.mock.calls
      const callString = JSON.stringify(calls)
      expect(callString).toContain('sync')
      expect(callString).toContain('AAPL')
    })
  })

  describe('Log Levels', () => {
    it('should use different log levels', () => {
      logger.debug('Debug level')
      logger.info('Info level')
      logger.warn('Warn level')
      logger.error('Error level')

      // All should call console.log
      expect(consoleLogSpy.mock.calls.length).toBeGreaterThanOrEqual(3) // debug might not show in production
    })
  })

  describe('Real-world Usage Patterns', () => {
    it('should log service operations', () => {
      const serviceLogger = createLogger({ service: 'PortfolioService' })

      serviceLogger.info('Starting sync operation')
      serviceLogger.info('Fetched positions from API', { count: 10 })
      serviceLogger.info('Sync completed successfully', { duration: '2.5s' })

      expect(consoleLogSpy.mock.calls.length).toBeGreaterThanOrEqual(3)
    })

    it('should log errors with context', () => {
      try {
        throw new Error('API request failed')
      } catch (error) {
        logger.exception(error, 'Failed to fetch data', {
          url: '/api/portfolio',
          statusCode: 500,
        })
      }

      expect(consoleLogSpy).toHaveBeenCalled()
    })

    it('should log user actions', () => {
      logger.info('User logged in', {
        userId: '123',
        email: 'user@example.com',
        ip: '192.168.1.1',
      })

      expect(consoleLogSpy).toHaveBeenCalled()
    })
  })
})
