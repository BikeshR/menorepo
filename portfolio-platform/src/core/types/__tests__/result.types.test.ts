import { describe, expect, it } from 'vitest'
import { isError, isSuccess, Result, unwrap, unwrapOr } from '../result.types'

describe('Result Type', () => {
  describe('Result.ok', () => {
    it('should create a successful result', () => {
      const result = Result.ok({ userId: '123', name: 'John' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ userId: '123', name: 'John' })
      }
    })

    it('should work with primitive types', () => {
      const stringResult = Result.ok('hello')
      const numberResult = Result.ok(42)
      const booleanResult = Result.ok(true)

      expect(stringResult.success).toBe(true)
      expect(numberResult.success).toBe(true)
      expect(booleanResult.success).toBe(true)
    })

    it('should work with null and undefined', () => {
      const nullResult = Result.ok(null)
      const undefinedResult = Result.ok(undefined)

      expect(nullResult.success).toBe(true)
      expect(undefinedResult.success).toBe(true)
    })
  })

  describe('Result.fail', () => {
    it('should create a failed result', () => {
      const result = Result.fail({
        code: 'NOT_FOUND',
        message: 'User not found in database',
        userMessage: 'The requested user could not be found',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
        expect(result.error.message).toBe('User not found in database')
        expect(result.error.userMessage).toBe('The requested user could not be found')
      }
    })

    it('should include optional details', () => {
      const result = Result.fail({
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        userMessage: 'Please check your input',
        details: { field: 'email', reason: 'invalid format' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.details).toEqual({ field: 'email', reason: 'invalid format' })
      }
    })
  })

  describe('isSuccess', () => {
    it('should return true for successful results', () => {
      const result = Result.ok({ data: 'test' })
      expect(isSuccess(result)).toBe(true)
    })

    it('should return false for error results', () => {
      const result = Result.fail({
        code: 'ERROR',
        message: 'Error',
        userMessage: 'Error',
      })
      expect(isSuccess(result)).toBe(false)
    })

    it('should narrow type correctly', () => {
      const result = Result.ok({ userId: '123' })

      if (isSuccess(result)) {
        // TypeScript should know result is SuccessResult here
        const data = result.data
        expect(data).toEqual({ userId: '123' })
      }
    })
  })

  describe('isError', () => {
    it('should return true for error results', () => {
      const result = Result.fail({
        code: 'ERROR',
        message: 'Error',
        userMessage: 'Error',
      })
      expect(isError(result)).toBe(true)
    })

    it('should return false for successful results', () => {
      const result = Result.ok({ data: 'test' })
      expect(isError(result)).toBe(false)
    })

    it('should narrow type correctly', () => {
      const result = Result.fail({
        code: 'NOT_FOUND',
        message: 'Not found',
        userMessage: 'Not found',
      })

      if (isError(result)) {
        // TypeScript should know result is ErrorResult here
        const error = result.error
        expect(error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('unwrap', () => {
    it('should return data for successful results', () => {
      const result = Result.ok({ userId: '123' })
      const data = unwrap(result)

      expect(data).toEqual({ userId: '123' })
    })

    it('should throw for error results', () => {
      const result = Result.fail({
        code: 'ERROR',
        message: 'Something went wrong',
        userMessage: 'Error',
      })

      expect(() => unwrap(result)).toThrow('Something went wrong')
    })
  })

  describe('unwrapOr', () => {
    it('should return data for successful results', () => {
      const result = Result.ok({ userId: '123' })
      const data = unwrapOr(result, { userId: 'default' })

      expect(data).toEqual({ userId: '123' })
    })

    it('should return default value for error results', () => {
      const result = Result.fail({
        code: 'ERROR',
        message: 'Error',
        userMessage: 'Error',
      })

      const data = unwrapOr(result, { userId: 'default' })
      expect(data).toEqual({ userId: 'default' })
    })
  })

  describe('Real-world usage patterns', () => {
    // Simulating a service function
    async function fetchUser(id: string): Promise<Result<{ id: string; name: string }>> {
      if (id === 'invalid') {
        return Result.fail({
          code: 'NOT_FOUND',
          message: `User ${id} not found`,
          userMessage: 'User not found',
        })
      }

      return Result.ok({ id, name: 'John Doe' })
    }

    it('should handle success case', async () => {
      const result = await fetchUser('123')

      expect(isSuccess(result)).toBe(true)

      if (isSuccess(result)) {
        expect(result.data.id).toBe('123')
        expect(result.data.name).toBe('John Doe')
      }
    })

    it('should handle error case', async () => {
      const result = await fetchUser('invalid')

      expect(isError(result)).toBe(true)

      if (isError(result)) {
        expect(result.error.code).toBe('NOT_FOUND')
        expect(result.error.userMessage).toBe('User not found')
      }
    })

    it('should chain operations safely', async () => {
      const getUserName = async (id: string): Promise<string> => {
        const result = await fetchUser(id)

        if (isError(result)) {
          return 'Unknown'
        }

        return result.data.name
      }

      const validName = await getUserName('123')
      const invalidName = await getUserName('invalid')

      expect(validName).toBe('John Doe')
      expect(invalidName).toBe('Unknown')
    })
  })
})
