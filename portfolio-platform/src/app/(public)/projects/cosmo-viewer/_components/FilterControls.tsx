/**
 * FilterControls Component
 *
 * Provides filter and sort controls for objekts
 * Filters: member, season
 * Sorts: tokenId, member, season, class
 */

'use client'

type FilterControlsProps = {
  members: string[]
  seasons: string[]
  selectedMember: string
  selectedSeason: string
  sortBy: 'tokenId' | 'member' | 'season' | 'class'
  onMemberChange: (member: string) => void
  onSeasonChange: (season: string) => void
  onSortChange: (sort: 'tokenId' | 'member' | 'season' | 'class') => void
}

export function FilterControls({
  members,
  seasons,
  selectedMember,
  selectedSeason,
  sortBy,
  onMemberChange,
  onSeasonChange,
  onSortChange,
}: FilterControlsProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800 p-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Filter & Sort
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Member Filter */}
        <div>
          <label
            htmlFor="member-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Member
          </label>
          <select
            id="member-filter"
            value={selectedMember}
            onChange={(e) => onMemberChange(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Members</option>
            {members.map((member) => (
              <option key={member} value={member}>
                {member}
              </option>
            ))}
          </select>
        </div>

        {/* Season Filter */}
        <div>
          <label
            htmlFor="season-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Season
          </label>
          <select
            id="season-filter"
            value={selectedSeason}
            onChange={(e) => onSeasonChange(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Seasons</option>
            {seasons.map((season) => (
              <option key={season} value={season}>
                {season}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div>
          <label
            htmlFor="sort-by"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Sort By
          </label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) =>
              onSortChange(e.target.value as 'tokenId' | 'member' | 'season' | 'class')
            }
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="tokenId">Token ID</option>
            <option value="member">Member</option>
            <option value="season">Season</option>
            <option value="class">Class</option>
          </select>
        </div>
      </div>
    </div>
  )
}
