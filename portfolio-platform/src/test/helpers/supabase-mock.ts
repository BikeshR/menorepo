/**
 * Supabase Mock Helpers
 *
 * Utilities for mocking Supabase query builders in tests.
 * Handles the dual nature of Supabase queries: chainable + thenable (Promise-like).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'

/**
 * Create a mock Supabase client with proper query chain support
 *
 * Usage:
 * ```typescript
 * const mockSupabase = createMockSupabaseClient()
 *
 * // For queries that return data
 * mockSupabase.mockQuery({ data: [...], error: null })
 *
 * // For queries that return single item
 * mockSupabase.mockQuery({ data: {...}, error: null })
 *
 * // For queries that return errors
 * mockSupabase.mockQuery({ data: null, error: { message: 'Error' } })
 * ```
 */
export function createMockSupabaseClient() {
  // Create the query mock that will be returned by all chain methods
  let queryMock: any

  const createQueryMock = (response: any) => {
    const mock = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      containedBy: vi.fn().mockReturnThis(),
      rangeLt: vi.fn().mockReturnThis(),
      rangeGt: vi.fn().mockReturnThis(),
      rangeGte: vi.fn().mockReturnThis(),
      rangeLte: vi.fn().mockReturnThis(),
      rangeAdjacent: vi.fn().mockReturnThis(),
      overlaps: vi.fn().mockReturnThis(),
      textSearch: vi.fn().mockReturnThis(),
      match: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(response),
      maybeSingle: vi.fn().mockResolvedValue(response),
      csv: vi.fn().mockResolvedValue(response),
      geojson: vi.fn().mockResolvedValue(response),
      explain: vi.fn().mockResolvedValue(response),
      rollback: vi.fn().mockResolvedValue(response),
      returns: vi.fn().mockReturnThis(),
      // Make the mock thenable (Promise-like) so it can be awaited
      then: vi.fn((resolve) => Promise.resolve(response).then(resolve)),
      catch: vi.fn((reject) => Promise.resolve(response).catch(reject)),
      finally: vi.fn((fn) => Promise.resolve(response).finally(fn)),
    }
    return mock
  }

  queryMock = createQueryMock({ data: null, error: null })

  const mockSupabase = {
    ...queryMock,
    auth: {},
    storage: {},
    /**
     * Set the response for the next query
     * Call this in your test to set what the query should return
     */
    mockQuery: (response: any) => {
      queryMock = createQueryMock(response)
      // Update all the methods to return the new mock
      Object.assign(mockSupabase, queryMock)
    },
  }

  return mockSupabase as unknown as SupabaseClient & {
    mockQuery: (response: any) => void
  }
}

/**
 * Create a simple mock response for Supabase queries
 */
export function createMockResponse<T>(data: T | null, error: any = null) {
  return { data, error, count: null, status: error ? 400 : 200, statusText: error ? 'Error' : 'OK' }
}

/**
 * Create a mock response with count (for queries with count: 'exact')
 */
export function createMockResponseWithCount<T>(data: T | null, count: number, error: any = null) {
  return { data, error, count, status: error ? 400 : 200, statusText: error ? 'Error' : 'OK' }
}
