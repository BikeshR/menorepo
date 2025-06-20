import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query'
import { queryClient, queryKeys } from '../query-client'
import type { Patent, PatentClaim } from '@/lib/stores/types'

// Types for API responses
interface PatentsListResponse {
  patents: Patent[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

interface PatentFilters {
  status?: string[]
  dateRange?: [Date, Date]
  inventors?: string[]
  assignee?: string[]
  classifications?: string[]
  search?: string
}

interface PaginationOptions {
  page?: number
  limit?: number
}

// Fetch functions (these would connect to your actual API)
const fetchPatents = async (
  filters: PatentFilters = {}, 
  pagination: PaginationOptions = {}
): Promise<PatentsListResponse> => {
  const params = new URLSearchParams({
    page: String(pagination.page || 1),
    limit: String(pagination.limit || 20),
    ...(filters.search && { search: filters.search }),
    ...(filters.status?.length && { status: filters.status.join(',') }),
    ...(filters.inventors?.length && { inventors: filters.inventors.join(',') }),
    ...(filters.assignee?.length && { assignee: filters.assignee.join(',') }),
    ...(filters.classifications?.length && { classifications: filters.classifications.join(',') }),
  })

  if (filters.dateRange) {
    params.append('dateFrom', filters.dateRange[0].toISOString())
    params.append('dateTo', filters.dateRange[1].toISOString())
  }

  const response = await fetch(`/api/patents?${params}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch patents: ${response.statusText}`)
  }
  return response.json()
}

const fetchPatent = async (id: string): Promise<Patent> => {
  const response = await fetch(`/api/patents/${id}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch patent: ${response.statusText}`)
  }
  return response.json()
}

const createPatent = async (patentData: Partial<Patent>): Promise<Patent> => {
  const response = await fetch('/api/patents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patentData),
  })
  if (!response.ok) {
    throw new Error(`Failed to create patent: ${response.statusText}`)
  }
  return response.json()
}

const updatePatent = async ({ id, data }: { id: string; data: Partial<Patent> }): Promise<Patent> => {
  const response = await fetch(`/api/patents/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error(`Failed to update patent: ${response.statusText}`)
  }
  return response.json()
}

const deletePatent = async (id: string): Promise<void> => {
  const response = await fetch(`/api/patents/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(`Failed to delete patent: ${response.statusText}`)
  }
}

const updatePatentClaims = async ({ 
  patentId, 
  claims 
}: { 
  patentId: string
  claims: PatentClaim[] 
}): Promise<PatentClaim[]> => {
  const response = await fetch(`/api/patents/${patentId}/claims`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ claims }),
  })
  if (!response.ok) {
    throw new Error(`Failed to update patent claims: ${response.statusText}`)
  }
  return response.json()
}

// Query hooks
export const usePatents = (filters: PatentFilters = {}, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.patentsList(filters),
    queryFn: () => fetchPatents(filters),
    enabled: options?.enabled !== false,
    staleTime: 2 * 60 * 1000, // 2 minutes for patent list
  })
}

export const useInfinitePatents = (filters: PatentFilters = {}) => {
  return useInfiniteQuery({
    queryKey: queryKeys.patentsList(filters),
    queryFn: ({ pageParam = 1 }) => fetchPatents(filters, { page: pageParam }),
    getNextPageParam: (lastPage) => 
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  })
}

export const usePatent = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.patent(id),
    queryFn: () => fetchPatent(id),
    enabled: options?.enabled !== false && !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for individual patent
  })
}

export const usePatentClaims = (patentId: string) => {
  return useQuery({
    queryKey: queryKeys.patentClaims(patentId),
    queryFn: async () => {
      const patent = await fetchPatent(patentId)
      return patent.claims
    },
    enabled: !!patentId,
    staleTime: 5 * 60 * 1000, // 5 minutes for claims
  })
}

// Mutation hooks
export const useCreatePatent = () => {
  return useMutation({
    mutationFn: createPatent,
    onSuccess: () => {
      // Invalidate and refetch patents list
      queryClient.invalidateQueries({ queryKey: queryKeys.patents() })
    },
    meta: {
      successMessage: 'Patent created successfully',
      errorMessage: 'Failed to create patent',
    },
  })
}

export const useUpdatePatent = () => {
  return useMutation({
    mutationFn: updatePatent,
    onSuccess: (data) => {
      // Update the specific patent in cache
      queryClient.setQueryData(queryKeys.patent(data.id), data)
      
      // Invalidate patents list to reflect changes
      queryClient.invalidateQueries({ queryKey: queryKeys.patents() })
    },
    meta: {
      successMessage: 'Patent updated successfully',
      errorMessage: 'Failed to update patent',
    },
  })
}

export const useDeletePatent = () => {
  return useMutation({
    mutationFn: deletePatent,
    onSuccess: (_, patentId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.patent(patentId) })
      
      // Invalidate patents list
      queryClient.invalidateQueries({ queryKey: queryKeys.patents() })
    },
    meta: {
      successMessage: 'Patent deleted successfully',
      errorMessage: 'Failed to delete patent',
    },
  })
}

export const useUpdatePatentClaims = () => {
  return useMutation({
    mutationFn: updatePatentClaims,
    onSuccess: (claims, { patentId }) => {
      // Update claims in cache
      queryClient.setQueryData(queryKeys.patentClaims(patentId), claims)
      
      // Invalidate the full patent to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.patent(patentId) })
    },
    meta: {
      successMessage: 'Patent claims updated successfully',
      errorMessage: 'Failed to update patent claims',
    },
  })
}

// Utility hooks for common patterns
export const usePrefetchPatent = () => {
  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.patent(id),
      queryFn: () => fetchPatent(id),
      staleTime: 10 * 60 * 1000,
    })
  }
}

export const useOptimisticPatentUpdate = () => {
  return useMutation({
    mutationFn: updatePatent,
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.patent(id) })
      
      // Snapshot previous value
      const previousPatent = queryClient.getQueryData(queryKeys.patent(id))
      
      // Optimistically update to new value
      if (previousPatent) {
        queryClient.setQueryData(queryKeys.patent(id), {
          ...previousPatent,
          ...data,
        })
      }
      
      return { previousPatent }
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousPatent) {
        queryClient.setQueryData(queryKeys.patent(id), context.previousPatent)
      }
    },
    onSettled: (data) => {
      // Always refetch after error or success
      if (data) {
        queryClient.invalidateQueries({ queryKey: queryKeys.patent(data.id) })
      }
    },
  })
}