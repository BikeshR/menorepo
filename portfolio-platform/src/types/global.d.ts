import type { Database } from './supabase'

// Re-export Database type for convenience
export type { Database }

// Supabase table types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// Specific table types
export type Profile = Tables<'profiles'>
export type Project = Tables<'projects'>
export type ProjectTag = Tables<'project_tags'>
export type ProjectLink = Tables<'project_links'>
export type ProjectTechStack = Tables<'project_tech_stack'>
export type Investment = Tables<'investments'>
export type Transaction = Tables<'transactions'>

// Enum types
export type ProjectStatus = Enums<'project_status'>
export type ProjectLinkType = Enums<'project_link_type'>
export type InvestmentType = Enums<'investment_type'>
export type TransactionType = Enums<'transaction_type'>

// Extended types with relations
export type ProjectWithDetails = Project & {
  tags: ProjectTag[]
  links: ProjectLink[]
  tech_stack: ProjectTechStack[]
  profile: Profile
}

// API Response types
export type ApiResponse<T = unknown> =
  | {
      success: true
      data: T
    }
  | {
      success: false
      error: string
    }

// Form types
export type FormState = {
  message: string | null
  errors?: Record<string, string[]>
}

// Pagination
export type PaginatedResponse<T> = {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// User types
export type User = {
  id: string
  email: string
  user_metadata?: {
    full_name?: string
    avatar_url?: string
  }
}
