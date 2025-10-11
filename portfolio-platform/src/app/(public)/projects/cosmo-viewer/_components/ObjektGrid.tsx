'use client'

/**
 * ObjektGrid Component
 *
 * Main component for fetching and displaying objekts
 * Uses React Query for data fetching and caching
 * Includes filtering and sorting controls
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { calculateStats } from '../_lib/queries'
import type { Objekt } from '../_lib/types'
import {
  filterByMember,
  filterBySeason,
  getUniqueMembers,
  getUniqueSeasons,
  sortObjekts,
} from '../_lib/utils'
import { CollectionStats } from './CollectionStats'
import { FilterControls } from './FilterControls'
import { ObjektCard } from './ObjektCard'

type ObjektGridProps = {
  address: `0x${string}`
}

/**
 * Fetch objekts from server-side API route
 * This avoids CORS issues and works reliably on mobile devices
 */
async function fetchObjekts(address: string): Promise<Objekt[]> {
  const response = await fetch(`/api/cosmo/objekts?address=${address}`)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || errorData.error || 'Failed to fetch objekts')
  }

  const data = await response.json()
  return data.data
}

export function ObjektGrid({ address }: ObjektGridProps) {
  const [selectedMember, setSelectedMember] = useState('')
  const [selectedSeason, setSelectedSeason] = useState('')
  const [sortBy, setSortBy] = useState<'tokenId' | 'member' | 'season' | 'class'>('tokenId')

  // Fetch objekts with React Query via server-side API
  const {
    data: objekts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['objekts', address],
    queryFn: () => fetchObjekts(address),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  })

  // Get unique values for filters
  const members = useMemo(() => getUniqueMembers(objekts), [objekts])
  const seasons = useMemo(() => getUniqueSeasons(objekts), [objekts])

  // Apply filters and sorting
  const filteredObjekts = useMemo(() => {
    let filtered = objekts
    filtered = filterByMember(filtered, selectedMember)
    filtered = filterBySeason(filtered, selectedSeason)
    filtered = sortObjekts(filtered, sortBy)
    return filtered
  }, [objekts, selectedMember, selectedSeason, sortBy])

  // Calculate stats from all objekts (not filtered)
  const stats = useMemo(() => calculateStats(objekts), [objekts])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 dark:text-gray-400">Loading objekts...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
          Error Loading Objekts
        </h3>
        <p className="text-red-700 dark:text-red-200">
          {error instanceof Error ? error.message : 'Failed to load objekts'}
        </p>
      </div>
    )
  }

  if (objekts.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          No objekts found for this address.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <CollectionStats stats={stats} />

      {/* Filters */}
      <FilterControls
        members={members}
        seasons={seasons}
        selectedMember={selectedMember}
        selectedSeason={selectedSeason}
        sortBy={sortBy}
        onMemberChange={setSelectedMember}
        onSeasonChange={setSelectedSeason}
        onSortChange={setSortBy}
      />

      {/* Results count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredObjekts.length} of {objekts.length} objekts
      </div>

      {/* Grid */}
      {filteredObjekts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredObjekts.map((objekt) => (
            <ObjektCard key={objekt.tokenId} objekt={objekt} />
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">No objekts match the selected filters.</p>
        </div>
      )}
    </div>
  )
}
