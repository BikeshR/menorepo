/**
 * ObjektCard Component
 *
 * Displays a single objekt with image and metadata
 * Shows member, season, class, and token ID
 */

import Image from 'next/image'
import type { Objekt } from '../_lib/types'
import { getAttribute } from '../_lib/queries'

type ObjektCardProps = {
  objekt: Objekt
}

export function ObjektCard({ objekt }: ObjektCardProps) {
  const member = getAttribute(objekt, 'Member') || 'Unknown'
  const season = getAttribute(objekt, 'Season') || 'Unknown'
  const objektClass = getAttribute(objekt, 'Class') || 'Unknown'

  return (
    <div className="group relative bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow border border-gray-200 dark:border-gray-800">
      {/* Image */}
      <div className="relative aspect-[3/4] bg-gray-100 dark:bg-gray-800">
        <Image
          src={objekt.metadata.image}
          alt={objekt.metadata.name}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          unoptimized // For external CDN images
        />
      </div>

      {/* Metadata */}
      <div className="p-4 space-y-2">
        {/* Member name - prominent */}
        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate">
          {member}
        </h3>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Season</span>
            <p className="font-medium text-gray-900 dark:text-gray-100">{season}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Class</span>
            <p className="font-medium text-gray-900 dark:text-gray-100">{objektClass}</p>
          </div>
        </div>

        {/* Token ID */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Token ID</span>
          <p className="font-mono text-xs text-gray-700 dark:text-gray-300">
            #{objekt.tokenId}
          </p>
        </div>
      </div>

      {/* Hover overlay with full name */}
      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white font-medium">{objekt.metadata.name}</p>
          {objekt.metadata.description && (
            <p className="text-gray-300 text-sm mt-2">{objekt.metadata.description}</p>
          )}
        </div>
      </div>
    </div>
  )
}
