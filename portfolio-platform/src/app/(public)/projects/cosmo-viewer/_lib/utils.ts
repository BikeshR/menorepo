/**
 * Utility functions for COSMO viewer
 */

import type { Objekt } from './types'

/**
 * Sort objekts by various criteria
 */
export function sortObjekts(
  objekts: Objekt[],
  sortBy: 'tokenId' | 'member' | 'season' | 'class' = 'tokenId'
): Objekt[] {
  return [...objekts].sort((a, b) => {
    if (sortBy === 'tokenId') {
      return Number(a.tokenId) - Number(b.tokenId)
    }

    const getAttr = (objekt: Objekt, type: string) =>
      objekt.metadata.attributes.find((attr) => attr.trait_type === type)?.value || ''

    if (sortBy === 'member') {
      return getAttr(a, 'Member').localeCompare(getAttr(b, 'Member'))
    }

    if (sortBy === 'season') {
      return getAttr(a, 'Season').localeCompare(getAttr(b, 'Season'))
    }

    if (sortBy === 'class') {
      return getAttr(a, 'Class').localeCompare(getAttr(b, 'Class'))
    }

    return 0
  })
}

/**
 * Filter objekts by member
 */
export function filterByMember(objekts: Objekt[], member: string): Objekt[] {
  if (!member) return objekts

  return objekts.filter((objekt) => {
    const memberAttr = objekt.metadata.attributes.find((attr) => attr.trait_type === 'Member')
    return memberAttr?.value === member
  })
}

/**
 * Filter objekts by season
 */
export function filterBySeason(objekts: Objekt[], season: string): Objekt[] {
  if (!season) return objekts

  return objekts.filter((objekt) => {
    const seasonAttr = objekt.metadata.attributes.find((attr) => attr.trait_type === 'Season')
    return seasonAttr?.value === season
  })
}

/**
 * Get unique members from objekts
 */
export function getUniqueMembers(objekts: Objekt[]): string[] {
  const members = new Set<string>()

  for (const objekt of objekts) {
    const memberAttr = objekt.metadata.attributes.find((attr) => attr.trait_type === 'Member')
    if (memberAttr) {
      members.add(memberAttr.value)
    }
  }

  return Array.from(members).sort()
}

/**
 * Get unique seasons from objekts
 */
export function getUniqueSeasons(objekts: Objekt[]): string[] {
  const seasons = new Set<string>()

  for (const objekt of objekts) {
    const seasonAttr = objekt.metadata.attributes.find((attr) => attr.trait_type === 'Season')
    if (seasonAttr) {
      seasons.add(seasonAttr.value)
    }
  }

  return Array.from(seasons).sort()
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}
