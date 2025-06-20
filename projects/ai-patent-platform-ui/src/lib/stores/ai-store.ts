import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import type { AIOperation, AIResponse } from './types'

interface AIState {
  operations: Map<string, AIOperation>
  activeOperations: string[]
  streamingData: Map<string, string>
  globalSettings: {
    confidenceThreshold: number
    enableStreaming: boolean
    maxConcurrentOperations: number
  }
}

interface AIActions {
  startOperation: (operation: Omit<AIOperation, 'id' | 'startedAt' | 'progress'>) => string
  updateOperation: (id: string, updates: Partial<AIOperation>) => void
  completeOperation: (id: string, response: AIResponse) => void
  failOperation: (id: string, error: string) => void
  cancelOperation: (id: string) => void
  updateProgress: (id: string, progress: number) => void
  appendStreamingData: (id: string, chunk: string) => void
  clearStreamingData: (id: string) => void
  removeOperation: (id: string) => void
  clearCompletedOperations: () => void
  updateGlobalSettings: (settings: Partial<AIState['globalSettings']>) => void
}

type AIStore = AIState & AIActions

export const useAIStore = create<AIStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial state
      operations: new Map(),
      activeOperations: [],
      streamingData: new Map(),
      globalSettings: {
        confidenceThreshold: 0.7,
        enableStreaming: true,
        maxConcurrentOperations: 3,
      },

      // Actions
      startOperation: (operationData) => {
        const id = `ai-op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const operation: AIOperation = {
          ...operationData,
          id,
          startedAt: new Date(),
          progress: 0,
        }

        set((state) => {
          const newOperations = new Map(state.operations)
          newOperations.set(id, operation)
          
          return {
            operations: newOperations,
            activeOperations: [...state.activeOperations, id],
          }
        }, false, 'ai/startOperation')

        return id
      },

      updateOperation: (id, updates) => {
        set((state) => {
          const newOperations = new Map(state.operations)
          const existing = newOperations.get(id)
          if (existing) {
            newOperations.set(id, { ...existing, ...updates })
          }
          return { operations: newOperations }
        }, false, 'ai/updateOperation')
      },

      completeOperation: (id, response) => {
        set((state) => {
          const newOperations = new Map(state.operations)
          const existing = newOperations.get(id)
          if (existing) {
            newOperations.set(id, {
              ...existing,
              status: 'completed',
              output: response,
              completedAt: new Date(),
              progress: 100,
            })
          }

          return {
            operations: newOperations,
            activeOperations: state.activeOperations.filter(opId => opId !== id),
          }
        }, false, 'ai/completeOperation')
      },

      failOperation: (id, error) => {
        set((state) => {
          const newOperations = new Map(state.operations)
          const existing = newOperations.get(id)
          if (existing) {
            newOperations.set(id, {
              ...existing,
              status: 'failed',
              error,
              completedAt: new Date(),
            })
          }

          return {
            operations: newOperations,
            activeOperations: state.activeOperations.filter(opId => opId !== id),
          }
        }, false, 'ai/failOperation')
      },

      cancelOperation: (id) => {
        set((state) => {
          const newOperations = new Map(state.operations)
          newOperations.delete(id)
          
          const newStreamingData = new Map(state.streamingData)
          newStreamingData.delete(id)

          return {
            operations: newOperations,
            activeOperations: state.activeOperations.filter(opId => opId !== id),
            streamingData: newStreamingData,
          }
        }, false, 'ai/cancelOperation')
      },

      updateProgress: (id, progress) => {
        set((state) => {
          const newOperations = new Map(state.operations)
          const existing = newOperations.get(id)
          if (existing) {
            newOperations.set(id, { ...existing, progress })
          }
          return { operations: newOperations }
        }, false, 'ai/updateProgress')
      },

      appendStreamingData: (id, chunk) => {
        set((state) => {
          const newStreamingData = new Map(state.streamingData)
          const existing = newStreamingData.get(id) || ''
          newStreamingData.set(id, existing + chunk)
          return { streamingData: newStreamingData }
        }, false, 'ai/appendStreamingData')
      },

      clearStreamingData: (id) => {
        set((state) => {
          const newStreamingData = new Map(state.streamingData)
          newStreamingData.delete(id)
          return { streamingData: newStreamingData }
        }, false, 'ai/clearStreamingData')
      },

      removeOperation: (id) => {
        set((state) => {
          const newOperations = new Map(state.operations)
          newOperations.delete(id)
          
          const newStreamingData = new Map(state.streamingData)
          newStreamingData.delete(id)

          return {
            operations: newOperations,
            activeOperations: state.activeOperations.filter(opId => opId !== id),
            streamingData: newStreamingData,
          }
        }, false, 'ai/removeOperation')
      },

      clearCompletedOperations: () => {
        set((state) => {
          const newOperations = new Map()
          state.operations.forEach((op, id) => {
            if (op.status !== 'completed' && op.status !== 'failed') {
              newOperations.set(id, op)
            }
          })
          return { operations: newOperations }
        }, false, 'ai/clearCompletedOperations')
      },

      updateGlobalSettings: (settings) => {
        set((state) => ({
          globalSettings: { ...state.globalSettings, ...settings }
        }), false, 'ai/updateGlobalSettings')
      },
    })),
    {
      name: 'ai-store',
    }
  )
)

// Selectors
export const useAIOperations = () => useAIStore((state) => Array.from(state.operations.values()))
export const useActiveOperations = () => useAIStore((state) => 
  state.activeOperations.map(id => state.operations.get(id)).filter(Boolean) as AIOperation[]
)
export const useAIOperation = (id: string) => useAIStore((state) => state.operations.get(id))
export const useStreamingData = (id: string) => useAIStore((state) => state.streamingData.get(id) || '')
export const useAISettings = () => useAIStore((state) => state.globalSettings)