// Export all service modules
export * from './ai'
export * from './patent'

// Re-export commonly used classes and utilities
export { AIServiceFactory, DefaultAIService } from './ai'
export { PatentService, DefaultPatentService } from './patent'