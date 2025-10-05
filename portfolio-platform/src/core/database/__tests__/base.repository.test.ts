import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/core/errors/app-error'
import { BaseRepository } from '../base.repository'

// Mock Supabase client
const createMockSupabase = () =>
  ({
    from: vi.fn(),
    auth: {},
    storage: {},
  }) as unknown as SupabaseClient

// Test repository implementation
class TestRepository extends BaseRepository<{ id: string; name: string }> {
  constructor(supabase: SupabaseClient) {
    super(supabase, 'test_table')
  }

  // Expose protected methods for testing
  async testExecuteQuery<T>(
    queryFn: () => PromiseLike<{ data: T | null; error: any }>,
    errorMessage: string,
    context?: Record<string, unknown>
  ) {
    return this.executeQuery(queryFn, errorMessage, context)
  }

  async testExecuteMutation<T>(
    queryFn: () => PromiseLike<{ data: T | null; error: any }>,
    errorMessage: string,
    context?: Record<string, unknown>
  ) {
    return this.executeMutation(queryFn, errorMessage, context)
  }

  async testExecuteOptionalQuery<T>(
    queryFn: () => PromiseLike<{ data: T | null; error: any }>,
    errorMessage: string,
    context?: Record<string, unknown>
  ) {
    return this.executeOptionalQuery(queryFn, errorMessage, context)
  }

  async testExecuteCount(
    queryFn: () => PromiseLike<{ data: unknown; error: any; count?: number }>,
    errorMessage: string,
    context?: Record<string, unknown>
  ) {
    return this.executeCount(queryFn, errorMessage, context)
  }
}

describe('BaseRepository', () => {
  let repository: TestRepository
  let mockSupabase: SupabaseClient

  beforeEach(() => {
    mockSupabase = createMockSupabase()
    repository = new TestRepository(mockSupabase)
  })

  describe('executeQuery', () => {
    it('should return data on successful query', async () => {
      const mockData = [{ id: '1', name: 'Test' }]
      const queryFn = vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      })

      const result = await repository.testExecuteQuery(queryFn, 'Failed to fetch data')

      expect(result).toEqual(mockData)
      expect(queryFn).toHaveBeenCalledOnce()
    })

    it('should throw AppError when query returns error', async () => {
      const mockError = {
        message: 'Database error',
        code: '23505',
      }
      const queryFn = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      })

      await expect(repository.testExecuteQuery(queryFn, 'Failed to fetch data')).rejects.toThrow(
        AppError
      )

      await expect(repository.testExecuteQuery(queryFn, 'Failed to fetch data')).rejects.toThrow(
        'Failed to fetch data'
      )
    })

    it('should throw AppError when query returns null data', async () => {
      const queryFn = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      await expect(repository.testExecuteQuery(queryFn, 'Failed to fetch data')).rejects.toThrow(
        AppError
      )

      await expect(repository.testExecuteQuery(queryFn, 'Failed to fetch data')).rejects.toThrow(
        'No data returned'
      )
    })

    it('should include context in error details', async () => {
      const mockError = { message: 'Database error' }
      const queryFn = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      })

      try {
        await repository.testExecuteQuery(queryFn, 'Failed to fetch data', {
          userId: '123',
          action: 'fetch',
        })
      } catch (error) {
        expect(error).toBeInstanceOf(AppError)
        const appError = error as AppError
        expect(appError.details).toMatchObject({
          userId: '123',
          action: 'fetch',
          table: 'test_table',
        })
      }
    })

    it('should handle unexpected errors', async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error('Network error'))

      await expect(repository.testExecuteQuery(queryFn, 'Failed to fetch data')).rejects.toThrow(
        AppError
      )
    })
  })

  describe('executeMutation', () => {
    it('should return data on successful mutation', async () => {
      const mockData = { id: '1', name: 'Created' }
      const queryFn = vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      })

      const result = await repository.testExecuteMutation(queryFn, 'Failed to create record')

      expect(result).toEqual(mockData)
      expect(queryFn).toHaveBeenCalledOnce()
    })

    it('should throw AppError when mutation returns error', async () => {
      const mockError = {
        message: 'Unique constraint violation',
        code: '23505',
      }
      const queryFn = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      })

      await expect(
        repository.testExecuteMutation(queryFn, 'Failed to create record')
      ).rejects.toThrow(AppError)

      await expect(
        repository.testExecuteMutation(queryFn, 'Failed to create record')
      ).rejects.toThrow('Failed to create record')
    })

    it('should throw AppError when mutation returns null data', async () => {
      const queryFn = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      await expect(
        repository.testExecuteMutation(queryFn, 'Failed to create record')
      ).rejects.toThrow(AppError)

      await expect(
        repository.testExecuteMutation(queryFn, 'Failed to create record')
      ).rejects.toThrow('No data returned')
    })

    it('should include context in mutation logs', async () => {
      const mockData = { id: '1', name: 'Updated' }
      const queryFn = vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      })

      const result = await repository.testExecuteMutation(queryFn, 'Failed to update record', {
        recordId: '1',
        operation: 'update',
      })

      expect(result).toEqual(mockData)
    })
  })

  describe('executeOptionalQuery', () => {
    it('should return data when found', async () => {
      const mockData = { id: '1', name: 'Found' }
      const queryFn = vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      })

      const result = await repository.testExecuteOptionalQuery(queryFn, 'Failed to find record')

      expect(result).toEqual(mockData)
    })

    it('should return null when not found', async () => {
      const queryFn = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      const result = await repository.testExecuteOptionalQuery(queryFn, 'Failed to find record')

      expect(result).toBeNull()
    })

    it('should throw AppError when query returns error', async () => {
      const mockError = { message: 'Database error' }
      const queryFn = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      })

      await expect(
        repository.testExecuteOptionalQuery(queryFn, 'Failed to find record')
      ).rejects.toThrow(AppError)
    })

    it('should handle unexpected errors', async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error('Connection timeout'))

      await expect(
        repository.testExecuteOptionalQuery(queryFn, 'Failed to find record')
      ).rejects.toThrow(AppError)
    })
  })

  describe('executeCount', () => {
    it('should return count from successful query', async () => {
      const queryFn = vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 42,
      })

      const result = await repository.testExecuteCount(queryFn, 'Failed to count records')

      expect(result).toBe(42)
    })

    it('should return 0 when count is undefined', async () => {
      const queryFn = vi.fn().mockResolvedValue({
        data: [],
        error: null,
        // count is undefined
      })

      const result = await repository.testExecuteCount(queryFn, 'Failed to count records')

      expect(result).toBe(0)
    })

    it('should throw AppError when count query returns error', async () => {
      const mockError = { message: 'Database error' }
      const queryFn = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      })

      await expect(repository.testExecuteCount(queryFn, 'Failed to count records')).rejects.toThrow(
        AppError
      )
    })
  })

  describe('Real-world Usage Patterns', () => {
    it('should handle repository with table name', () => {
      const repo = new TestRepository(mockSupabase)
      expect(repo.tableName).toBe('test_table')
    })

    it('should work without table name', () => {
      class NoTableRepo extends BaseRepository {}

      const repo = new NoTableRepo(mockSupabase)
      expect(repo.tableName).toBeUndefined()
    })

    it('should chain multiple operations', async () => {
      const queryFn1 = vi.fn().mockResolvedValue({
        data: [{ id: '1', name: 'Item 1' }],
        error: null,
      })

      const queryFn2 = vi.fn().mockResolvedValue({
        data: { id: '2', name: 'Item 2' },
        error: null,
      })

      const result1 = await repository.testExecuteQuery(queryFn1, 'Failed to fetch items')

      const result2 = await repository.testExecuteMutation(queryFn2, 'Failed to create item')

      expect(result1).toHaveLength(1)
      expect(result2).toEqual({ id: '2', name: 'Item 2' })
    })
  })

  describe('Error Handling', () => {
    it('should preserve AppError when thrown', async () => {
      const originalError = AppError.validation('Invalid data', {
        field: 'email',
      })

      const queryFn = vi.fn().mockRejectedValue(originalError)

      try {
        await repository.testExecuteQuery(queryFn, 'Failed to fetch data')
      } catch (error) {
        expect(error).toBe(originalError) // Same instance
        expect(error).toBeInstanceOf(AppError)
      }
    })

    it('should wrap non-AppError in AppError', async () => {
      const originalError = new Error('Something broke')
      const queryFn = vi.fn().mockRejectedValue(originalError)

      try {
        await repository.testExecuteQuery(queryFn, 'Failed to fetch data')
      } catch (error) {
        expect(error).toBeInstanceOf(AppError)
        expect(error).not.toBe(originalError) // Wrapped, not same instance
        const appError = error as AppError
        expect(appError.details).toMatchObject({
          originalError,
        })
      }
    })
  })
})
