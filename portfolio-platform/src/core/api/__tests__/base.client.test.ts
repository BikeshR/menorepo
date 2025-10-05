import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/core/errors/app-error'
import { BaseApiClient } from '../base.client'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch as any

// Test client implementation
class TestApiClient extends BaseApiClient {
  constructor(config?: Partial<Parameters<typeof BaseApiClient.prototype.constructor>[0]>) {
    super({
      baseUrl: 'https://api.example.com',
      apiKey: 'test-key',
      timeout: 5000,
      retries: 2,
      ...config,
    })
  }

  // Expose protected methods for testing
  async testGet<T>(endpoint: string, options?: any) {
    return this.get<T>(endpoint, options)
  }

  async testPost<T>(endpoint: string, body: unknown, options?: any) {
    return this.post<T>(endpoint, body, options)
  }

  async testPut<T>(endpoint: string, body: unknown, options?: any) {
    return this.put<T>(endpoint, body, options)
  }

  async testDelete<T>(endpoint: string, options?: any) {
    return this.delete<T>(endpoint, options)
  }

  async testPatch<T>(endpoint: string, body: unknown, options?: any) {
    return this.patch<T>(endpoint, body, options)
  }
}

describe('BaseApiClient', () => {
  let client: TestApiClient

  beforeEach(() => {
    client = new TestApiClient()
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GET requests', () => {
    it('should make successful GET request', async () => {
      const mockData = { id: '1', name: 'Test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData,
      })

      const result = await client.testGet<typeof mockData>('/users/1')

      expect(result).toEqual(mockData)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('should handle trailing slash in baseUrl', async () => {
      const clientWithSlash = new TestApiClient({
        baseUrl: 'https://api.example.com/',
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      })

      await clientWithSlash.testGet('/users')

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/users', expect.any(Object))
    })
  })

  describe('POST requests', () => {
    it('should make successful POST request', async () => {
      const requestBody = { name: 'New User', email: 'user@example.com' }
      const responseBody = { id: '1', ...requestBody }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => responseBody,
      })

      const result = await client.testPost<typeof responseBody>('/users', requestBody)

      expect(result).toEqual(responseBody)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
        })
      )
    })
  })

  describe('PUT requests', () => {
    it('should make successful PUT request', async () => {
      const requestBody = { name: 'Updated User' }
      const responseBody = { id: '1', ...requestBody }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => responseBody,
      })

      const result = await client.testPut<typeof responseBody>('/users/1', requestBody)

      expect(result).toEqual(responseBody)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(requestBody),
        })
      )
    })
  })

  describe('DELETE requests', () => {
    it('should make successful DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => '',
      })

      const result = await client.testDelete<string>('/users/1')

      expect(result).toBe('')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('PATCH requests', () => {
    it('should make successful PATCH request', async () => {
      const requestBody = { name: 'Patched User' }
      const responseBody = { id: '1', name: 'Patched User' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => responseBody,
      })

      const result = await client.testPatch<typeof responseBody>('/users/1', requestBody)

      expect(result).toEqual(responseBody)
    })
  })

  describe('Error handling', () => {
    it('should throw AppError on 400 Bad Request', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers(),
        text: async () => JSON.stringify({ message: 'Invalid data' }),
      })

      await expect(client.testGet('/users')).rejects.toThrow(AppError)
      await expect(client.testGet('/users')).rejects.toThrow('Invalid request')
    })

    it('should throw AppError on 401 Unauthorized', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers(),
        text: async () => 'Unauthorized',
      })

      await expect(client.testGet('/users')).rejects.toThrow(AppError)
      await expect(client.testGet('/users')).rejects.toThrow('authentication failed')
    })

    it('should throw AppError on 403 Forbidden', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        text: async () => 'Forbidden',
      })

      await expect(client.testGet('/users')).rejects.toThrow(AppError)
      await expect(client.testGet('/users')).rejects.toThrow('access denied')
    })

    it('should throw AppError on 404 Not Found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: async () => 'Not Found',
      })

      await expect(client.testGet('/users/999')).rejects.toThrow(AppError)
      await expect(client.testGet('/users/999')).rejects.toThrow('not found')
    })

    it('should throw AppError on 429 Rate Limit without retries', async () => {
      const clientNoRetry = new TestApiClient({ retries: 0 })
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers(),
        text: async () => 'Rate limited',
      })

      await expect(clientNoRetry.testGet('/users')).rejects.toThrow(AppError)
      await expect(clientNoRetry.testGet('/users')).rejects.toThrow('rate limit')
    })
  })

  describe('Retry logic', () => {
    it('should retry on 500 server error', async () => {
      // First two attempts fail with 500, third succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers(),
          text: async () => 'Server error',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers(),
          text: async () => 'Server error',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true }),
        })

      const result = await client.testGet<{ success: boolean }>('/users')

      expect(result).toEqual({ success: true })
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should retry on network error', async () => {
      // First attempt fails with network error, second succeeds
      mockFetch.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true }),
      })

      const result = await client.testGet<{ success: boolean }>('/users')

      expect(result).toEqual({ success: true })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should fail after max retries', async () => {
      // All attempts fail
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(client.testGet('/users')).rejects.toThrow(AppError)

      // With retries: 2, should try 3 times total (initial + 2 retries)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('Custom headers and options', () => {
    it('should use custom headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      })

      await client.testGet('/users', {
        headers: { 'X-Custom-Header': 'custom-value' },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'custom-value',
          }),
        })
      )
    })

    it('should work without API key', async () => {
      const clientNoKey = new TestApiClient({ apiKey: undefined })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      })

      await clientNoKey.testGet('/public')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      )
    })
  })

  describe('Response parsing', () => {
    it('should parse JSON responses', async () => {
      const jsonData = { id: '1', name: 'Test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => jsonData,
      })

      const result = await client.testGet('/users/1')

      expect(result).toEqual(jsonData)
    })

    it('should handle non-JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'Plain text response',
      })

      const result = await client.testGet<string>('/text')

      expect(result).toBe('Plain text response')
    })
  })

  describe('Real-world client implementation', () => {
    it('should work with custom API client', async () => {
      class Trading212Client extends BaseApiClient {
        constructor() {
          super({
            baseUrl: 'https://api.trading212.com',
            apiKey: 'trading212-key',
          })
        }

        async getPortfolio(): Promise<{ positions: any[] }> {
          return this.get('/api/v0/equity/portfolio')
        }
      }

      const trading212 = new Trading212Client()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ positions: [] }),
      })

      const portfolio = await trading212.getPortfolio()

      expect(portfolio).toEqual({ positions: [] })
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.trading212.com/api/v0/equity/portfolio',
        expect.any(Object)
      )
    })
  })
})
