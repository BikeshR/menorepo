import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Extend Vitest's expect with jest-dom matchers
expect.extend({})

// Run cleanup after each test case
afterEach(() => {
  cleanup()
})

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    push: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn().mockResolvedValue(undefined),
    beforePopState: vi.fn(),
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
  }),
}))

// Mock Next.js navigation (App Router)
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/',
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock AI services for testing
export const mockAIService = {
  generatePatentClaims: vi.fn().mockResolvedValue({
    data: 'Mock patent claims',
    confidence: 0.85,
    reasoning: ['Mock reasoning'],
    alternatives: [],
    humanReviewRequired: false,
    sources: []
  }),
  analyzeInvention: vi.fn().mockResolvedValue({
    patentabilityScore: 0.8,
    noveltyScore: 0.9,
    recommendation: 'Proceed with filing'
  }),
  searchPriorArt: vi.fn().mockResolvedValue([
    {
      id: '1',
      patentNumber: 'US1234567',
      title: 'Mock Patent',
      relevanceScore: 0.75
    }
  ])
}

// Global test utilities
export const createMockUser = () => ({
  id: '1',
  name: 'Test Attorney',
  email: 'test@firm.com',
  role: 'attorney' as const,
  permissions: ['patents:read', 'patents:write'] as const,
  preferences: {
    aiConfidenceThreshold: 0.7,
    autoSave: true,
    notifications: {
      email: true,
      inApp: true,
      deadlines: true,
      aiSuggestions: true
    },
    theme: 'light' as const
  }
})

export const createMockPatent = () => ({
  id: '1',
  title: 'Test Patent',
  status: 'pending' as const,
  filingDate: new Date('2024-01-01'),
  inventors: [{ id: '1', name: 'Test Inventor' }],
  assignee: 'Test Company',
  abstract: 'Test abstract',
  claims: [],
  description: 'Test description',
  classifications: ['G06F'],
  citations: [],
  prosecutionHistory: []
})

export const createMockAISuggestion = () => ({
  id: '1',
  type: 'improvement' as const,
  title: 'Test Suggestion',
  content: 'Test suggestion content',
  confidence: 0.85,
  reasoning: ['Test reasoning']
})