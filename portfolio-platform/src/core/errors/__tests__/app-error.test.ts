import { describe, expect, it } from 'vitest'
import { AppError, isAppError } from '../app-error'
import { ErrorCode } from '../error-codes'

describe('AppError', () => {
  describe('constructor', () => {
    it('should create error with all properties', () => {
      const error = new AppError(
        ErrorCode.NOT_FOUND,
        'Database record not found',
        'The requested item could not be found',
        { id: '123' },
        404
      )

      expect(error.code).toBe(ErrorCode.NOT_FOUND)
      expect(error.message).toBe('Database record not found')
      expect(error.userMessage).toBe('The requested item could not be found')
      expect(error.details).toEqual({ id: '123' })
      expect(error.statusCode).toBe(404)
      expect(error.name).toBe('AppError')
    })

    it('should use message as userMessage if not provided', () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Something went wrong')

      expect(error.userMessage).toBe('Something went wrong')
    })

    it('should use default status code from error code map', () => {
      const error = new AppError(ErrorCode.UNAUTHORIZED, 'Not authenticated')

      expect(error.statusCode).toBe(401)
    })

    it('should have proper stack trace', () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Test error')

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('AppError')
    })
  })

  describe('toJSON', () => {
    it('should serialize to JSON correctly', () => {
      const error = new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid input',
        'Please check your input',
        { field: 'email' }
      )

      const json = error.toJSON()

      expect(json).toMatchObject({
        name: 'AppError',
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid input',
        userMessage: 'Please check your input',
        details: { field: 'email' },
        statusCode: 400,
      })
      expect(json.stack).toBeDefined()
    })
  })

  describe('Factory Methods', () => {
    describe('unauthorized', () => {
      it('should create unauthorized error', () => {
        const error = AppError.unauthorized()

        expect(error.code).toBe(ErrorCode.UNAUTHORIZED)
        expect(error.statusCode).toBe(401)
        expect(error.userMessage).toBe('You must be logged in to perform this action')
      })

      it('should accept custom message', () => {
        const error = AppError.unauthorized('Session expired')

        expect(error.message).toBe('Session expired')
      })
    })

    describe('forbidden', () => {
      it('should create forbidden error', () => {
        const error = AppError.forbidden()

        expect(error.code).toBe(ErrorCode.FORBIDDEN)
        expect(error.statusCode).toBe(403)
        expect(error.userMessage).toBe('You do not have permission to perform this action')
      })
    })

    describe('notFound', () => {
      it('should create not found error', () => {
        const error = AppError.notFound('User')

        expect(error.code).toBe(ErrorCode.NOT_FOUND)
        expect(error.message).toBe('User not found')
        expect(error.userMessage).toBe('The requested user could not be found')
        expect(error.statusCode).toBe(404)
      })
    })

    describe('validation', () => {
      it('should create validation error', () => {
        const error = AppError.validation('Email is required', { field: 'email' })

        expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
        expect(error.message).toBe('Email is required')
        expect(error.userMessage).toBe('Invalid input provided')
        expect(error.details).toEqual({ field: 'email' })
        expect(error.statusCode).toBe(400)
      })
    })

    describe('database', () => {
      it('should create database error', () => {
        const error = AppError.database('Connection timeout')

        expect(error.code).toBe(ErrorCode.DATABASE_ERROR)
        expect(error.message).toBe('Connection timeout')
        expect(error.userMessage).toBe('A database error occurred. Please try again.')
        expect(error.statusCode).toBe(500)
      })
    })

    describe('rateLimit', () => {
      it('should create rate limit error', () => {
        const error = AppError.rateLimit('Too many requests')

        expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED)
        expect(error.statusCode).toBe(429)
        expect(error.userMessage).toBe('Rate limit exceeded. Please try again later.')
      })
    })

    describe('externalApi', () => {
      it('should create external API error', () => {
        const error = AppError.externalApi(
          'Trading212',
          'API unavailable',
          ErrorCode.TRADING212_ERROR
        )

        expect(error.code).toBe(ErrorCode.TRADING212_ERROR)
        expect(error.message).toBe('API unavailable')
        expect(error.userMessage).toBe('Failed to connect to Trading212. Please try again later.')
        expect(error.statusCode).toBe(502)
      })
    })

    describe('internal', () => {
      it('should create internal error', () => {
        const error = AppError.internal()

        expect(error.code).toBe(ErrorCode.INTERNAL_ERROR)
        expect(error.statusCode).toBe(500)
        expect(error.userMessage).toBe('An unexpected error occurred. Please try again.')
      })
    })

    describe('conflict', () => {
      it('should create conflict error', () => {
        const error = AppError.conflict('Email')

        expect(error.code).toBe(ErrorCode.ALREADY_EXISTS)
        expect(error.message).toBe('Email already exists')
        expect(error.userMessage).toBe('This email already exists')
        expect(error.statusCode).toBe(409)
      })
    })

    describe('insufficientData', () => {
      it('should create insufficient data error', () => {
        const error = AppError.insufficientData('Need at least 2 data points')

        expect(error.code).toBe(ErrorCode.INSUFFICIENT_DATA)
        expect(error.message).toBe('Need at least 2 data points')
        expect(error.userMessage).toBe('Insufficient data to perform this operation')
        expect(error.statusCode).toBe(422)
      })
    })
  })

  describe('isAppError type guard', () => {
    it('should return true for AppError instances', () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Test error')

      expect(isAppError(error)).toBe(true)
    })

    it('should return false for regular errors', () => {
      const error = new Error('Regular error')

      expect(isAppError(error)).toBe(false)
    })

    it('should return false for non-error values', () => {
      expect(isAppError('string')).toBe(false)
      expect(isAppError(null)).toBe(false)
      expect(isAppError(undefined)).toBe(false)
      expect(isAppError({})).toBe(false)
      expect(isAppError(42)).toBe(false)
    })
  })

  describe('Error handling patterns', () => {
    it('should work with try-catch', () => {
      function throwError() {
        throw AppError.notFound('User')
      }

      expect(() => throwError()).toThrow(AppError)

      try {
        throwError()
      } catch (error) {
        if (isAppError(error)) {
          expect(error.code).toBe(ErrorCode.NOT_FOUND)
          expect(error.userMessage).toContain('user could not be found')
        }
      }
    })

    it('should preserve stack trace when re-throwing', () => {
      function innerFunction() {
        throw AppError.internal('Inner error')
      }

      function outerFunction() {
        try {
          innerFunction()
        } catch (error) {
          if (isAppError(error)) {
            expect(error.stack).toContain('innerFunction')
          }
          throw error
        }
      }

      expect(() => outerFunction()).toThrow(AppError)
    })
  })
})
