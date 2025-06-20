// Export all patent service types and classes
export * from './types'
export * from './patent-service'

// Export commonly used utilities
export { 
  PatentService, 
  DefaultPatentService, 
  createPatentServiceFromEnv 
} from './patent-service'

// Export error classes for error handling
export {
  PatentServiceError,
  PatentNotFoundError,
  PatentValidationError,
  PatentPermissionError
} from './types'