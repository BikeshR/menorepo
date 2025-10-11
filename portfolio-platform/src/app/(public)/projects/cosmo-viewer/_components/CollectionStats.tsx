/**
 * CollectionStats Component
 *
 * Display statistics about a collection of objekts
 * Shows total count, voting power, and breakdowns by member/season/class
 */

import type { CollectionStats as StatsType } from '../_lib/types'
import { formatNumber } from '../_lib/utils'

type CollectionStatsProps = {
  stats: StatsType
}

export function CollectionStats({ stats }: CollectionStatsProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800 p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Collection Stats
      </h2>

      {/* Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Objekts</p>
          <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">
            {formatNumber(stats.totalObjekts)}
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
            COMO Voting Power
          </p>
          <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-1">
            {formatNumber(stats.comoVotingPower)}
          </p>
        </div>
      </div>

      {/* By Member */}
      {Object.keys(stats.byMember).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            By Member
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.byMember)
              .sort(([, a], [, b]) => b - a)
              .map(([member, count]) => (
                <div
                  key={member}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded"
                >
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {member}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 font-mono text-sm">
                    {formatNumber(count)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* By Season */}
      {Object.keys(stats.bySeason).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            By Season
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.bySeason)
              .sort(([, a], [, b]) => b - a)
              .map(([season, count]) => (
                <div
                  key={season}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded"
                >
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {season}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 font-mono text-sm">
                    {formatNumber(count)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* By Class */}
      {Object.keys(stats.byClass).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            By Class
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.byClass)
              .sort(([, a], [, b]) => b - a)
              .map(([objektClass, count]) => (
                <div
                  key={objektClass}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded"
                >
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {objektClass}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 font-mono text-sm">
                    {formatNumber(count)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
