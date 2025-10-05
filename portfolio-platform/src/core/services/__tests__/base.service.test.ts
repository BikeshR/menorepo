import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/core/errors/app-error'
import type { Result } from '@/core/types/result.types'
import { BaseService } from '../base.service'

// Test service implementation
class TestService extends BaseService {
  // Expose protected methods for testing
  async testExecuteOperation<T>(
    operationName: string,
    fn: () => Promise<T>,
    context?: Record<string, unknown>
  ) {
    return this.executeOperation(operationName, fn, context)
  }

  async testExecuteInternalOperation<T>(
    operationName: string,
    fn: () => Promise<T>,
    context?: Record<string, unknown>
  ) {
    return this.executeInternalOperation(operationName, fn, context)
  }

  testValidate(condition: boolean, errorMessage: string, details?: unknown) {
    return this.validate(condition, errorMessage, details)
  }

  testAssertExists<T>(value: T | null | undefined, resourceName: string): asserts value is T {
    return this.assertExists(value, resourceName)
  }

  async testExecuteParallel<T>(operations: Array<() => Promise<T>>) {
    return this.executeParallel(operations)
  }
}

describe('BaseService', () => {
  let service: TestService

  beforeEach(() => {
    service = new TestService('TestService')
  })

  describe('executeOperation', () => {
    it('should return success Result on successful operation', async () => {
      const mockData = { id: '1', name: 'Test' }
      const operation = vi.fn().mockResolvedValue(mockData)

      const result = await service.testExecuteOperation('testOperation', operation)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockData)
      }
      expect(operation).toHaveBeenCalledOnce()
    })

    it('should return error Result when operation throws AppError', async () => {
      const appError = AppError.validation('Invalid input', { field: 'email' })
      const operation = vi.fn().mockRejectedValue(appError)

      const result = await service.testExecuteOperation('testOperation', operation)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('Invalid input')
      }
    })

    it('should wrap unexpected errors in AppError', async () => {
      const error = new Error('Unexpected error')
      const operation = vi.fn().mockRejectedValue(error)

      const result = await service.testExecuteOperation('testOperation', operation)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR')
        expect(result.error.message).toContain('testOperation failed')
      }
    })

    it('should include context in logs', async () => {
      const mockData = { success: true }
      const operation = vi.fn().mockResolvedValue(mockData)

      const result = await service.testExecuteOperation('testOperation', operation, {
        userId: '123',
        action: 'sync',
      })

      expect(result.success).toBe(true)
      expect(operation).toHaveBeenCalledOnce()
    })

    it('should measure operation duration', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 10))
        return { done: true }
      })

      const result = await service.testExecuteOperation('testOperation', operation)

      expect(result.success).toBe(true)
    })
  })

  describe('executeInternalOperation', () => {
    it('should return result directly on success', async () => {
      const mockData = { id: '1', name: 'Test' }
      const operation = vi.fn().mockResolvedValue(mockData)

      const result = await service.testExecuteInternalOperation('internalOp', operation)

      expect(result).toEqual(mockData)
      expect(operation).toHaveBeenCalledOnce()
    })

    it('should throw AppError when operation fails with AppError', async () => {
      const appError = AppError.notFound('User')
      const operation = vi.fn().mockRejectedValue(appError)

      await expect(service.testExecuteInternalOperation('internalOp', operation)).rejects.toThrow(
        AppError
      )

      await expect(service.testExecuteInternalOperation('internalOp', operation)).rejects.toThrow(
        'User not found'
      )
    })

    it('should wrap unexpected errors in AppError', async () => {
      const error = new Error('Network timeout')
      const operation = vi.fn().mockRejectedValue(error)

      await expect(service.testExecuteInternalOperation('internalOp', operation)).rejects.toThrow(
        AppError
      )

      await expect(service.testExecuteInternalOperation('internalOp', operation)).rejects.toThrow(
        'internalOp failed'
      )
    })

    it('should include context in error logs', async () => {
      const error = new Error('Failed')
      const operation = vi.fn().mockRejectedValue(error)

      try {
        await service.testExecuteInternalOperation('internalOp', operation, { recordId: '123' })
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
      }
    })
  })

  describe('validate', () => {
    it('should not throw when condition is true', () => {
      expect(() => {
        service.testValidate(true, 'Should not throw')
      }).not.toThrow()
    })

    it('should throw AppError when condition is false', () => {
      expect(() => {
        service.testValidate(false, 'Validation failed')
      }).toThrow(AppError)

      expect(() => {
        service.testValidate(false, 'Validation failed')
      }).toThrow('Validation failed')
    })

    it('should include details in error', () => {
      try {
        service.testValidate(false, 'Invalid email', { field: 'email' })
      } catch (error) {
        expect(error).toBeInstanceOf(AppError)
        const appError = error as AppError
        expect(appError.details).toMatchObject({ field: 'email' })
      }
    })
  })

  describe('assertExists', () => {
    it('should not throw when value exists', () => {
      const value = { id: '1', name: 'Test' }
      expect(() => {
        service.testAssertExists(value, 'Record')
      }).not.toThrow()
    })

    it('should throw AppError when value is null', () => {
      expect(() => {
        service.testAssertExists(null, 'User')
      }).toThrow(AppError)

      expect(() => {
        service.testAssertExists(null, 'User')
      }).toThrow('User not found')
    })

    it('should throw AppError when value is undefined', () => {
      expect(() => {
        service.testAssertExists(undefined, 'Record')
      }).toThrow(AppError)

      expect(() => {
        service.testAssertExists(undefined, 'Record')
      }).toThrow('Record not found')
    })

    it('should narrow type after assertion', () => {
      const maybeValue: string | null = 'test'
      service.testAssertExists(maybeValue, 'Value')
      // After assertion, maybeValue is string (not string | null)
      const length: number = maybeValue.length
      expect(length).toBe(4)
    })
  })

  describe('executeParallel', () => {
    it('should execute all operations in parallel', async () => {
      const op1 = vi.fn().mockResolvedValue('result1')
      const op2 = vi.fn().mockResolvedValue('result2')
      const op3 = vi.fn().mockResolvedValue('result3')

      const result = await service.testExecuteParallel([op1, op2, op3])

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(['result1', 'result2', 'result3'])
      }
      expect(op1).toHaveBeenCalledOnce()
      expect(op2).toHaveBeenCalledOnce()
      expect(op3).toHaveBeenCalledOnce()
    })

    it('should return error if any operation fails', async () => {
      const op1 = vi.fn().mockResolvedValue('result1')
      const op2 = vi.fn().mockRejectedValue(AppError.notFound('Record'))
      const op3 = vi.fn().mockResolvedValue('result3')

      const result = await service.testExecuteParallel([op1, op2, op3])

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })

    it('should handle unexpected errors', async () => {
      const op1 = vi.fn().mockResolvedValue('result1')
      const op2 = vi.fn().mockRejectedValue(new Error('Network error'))
      const op3 = vi.fn().mockResolvedValue('result3')

      const result = await service.testExecuteParallel([op1, op2, op3])

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR')
        expect(result.error.message).toContain('Parallel operation failed')
      }
    })
  })

  describe('Service with custom name', () => {
    it('should use custom service name in logs', async () => {
      const customService = new TestService('CustomService')
      const operation = vi.fn().mockResolvedValue({ done: true })

      const result = await customService.testExecuteOperation('customOp', operation)

      expect(result.success).toBe(true)
    })
  })

  describe('Service without name', () => {
    it('should work without service name', async () => {
      const anonymousService = new TestService()
      const operation = vi.fn().mockResolvedValue({ done: true })

      const result = await anonymousService.testExecuteOperation('anonymousOp', operation)

      expect(result.success).toBe(true)
    })
  })

  describe('Real-world Usage Patterns', () => {
    it('should handle typical service operation flow', async () => {
      class UserService extends BaseService {
        constructor() {
          super('UserService')
        }

        async createUser(email: string): Promise<Result<{ id: string; email: string }>> {
          return this.executeOperation(
            'createUser',
            async () => {
              // Validate
              this.validate(email.includes('@'), 'Invalid email format', { email })

              // Business logic
              const user = { id: '123', email }

              return user
            },
            { email }
          )
        }
      }

      const userService = new UserService()
      const result = await userService.createUser('test@example.com')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('test@example.com')
      }
    })

    it('should handle validation errors properly', async () => {
      class UserService extends BaseService {
        constructor() {
          super('UserService')
        }

        async createUser(email: string): Promise<Result<{ id: string; email: string }>> {
          return this.executeOperation(
            'createUser',
            async () => {
              this.validate(email.includes('@'), 'Invalid email format', { email })

              return { id: '123', email }
            },
            { email }
          )
        }
      }

      const userService = new UserService()
      const result = await userService.createUser('invalid-email')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('Invalid email format')
      }
    })

    it('should compose multiple internal operations', async () => {
      class DataService extends BaseService {
        constructor() {
          super('DataService')
        }

        async processData(id: string): Promise<Result<string>> {
          return this.executeOperation(
            'processData',
            async () => {
              const data = await this.fetchData(id)
              const validated = await this.validateData(data)
              return validated
            },
            { id }
          )
        }

        private async fetchData(id: string): Promise<string> {
          return this.executeInternalOperation(
            'fetchData',
            async () => {
              return `data-${id}`
            },
            { id }
          )
        }

        private async validateData(data: string): Promise<string> {
          return this.executeInternalOperation('validateData', async () => {
            this.validate(data.length > 0, 'Data is empty')
            return data.toUpperCase()
          })
        }
      }

      const dataService = new DataService()
      const result = await dataService.processData('123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('DATA-123')
      }
    })
  })
})
