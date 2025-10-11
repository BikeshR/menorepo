/**
 * Blockchain Query Functions
 *
 * Functions to fetch objekt data from Abstract blockchain
 */

import { abstractClient } from './abstract-client'
import { COSMO_CONTRACT_ABI, COSMO_CONTRACT_ADDRESS, IS_CONTRACT_CONFIGURED } from './contracts'
import type { CollectionStats, Objekt, ObjektMetadata } from './types'

/**
 * Fetch all objekts owned by an address
 *
 * Uses Transfer events to discover tokens, then checks current ownership
 * This approach works because the contract doesn't implement ERC-721 Enumerable
 *
 * @param address - Ethereum address (0x...)
 * @returns Array of objekts with metadata
 */
export async function getObjektsForAddress(address: `0x${string}`): Promise<Objekt[]> {
  if (!IS_CONTRACT_CONFIGURED) {
    throw new Error(
      'COSMO contract address not configured. Please update COSMO_CONTRACT_ADDRESS in contracts.ts'
    )
  }

  try {
    // 1. Get Transfer events where this address received tokens
    // Query logs for Transfer(address from, address to, uint256 tokenId)
    const logs = await abstractClient.getLogs({
      address: COSMO_CONTRACT_ADDRESS,
      event: {
        type: 'event',
        name: 'Transfer',
        inputs: [
          { type: 'address', indexed: true, name: 'from' },
          { type: 'address', indexed: true, name: 'to' },
          { type: 'uint256', indexed: true, name: 'tokenId' },
        ],
      },
      args: {
        to: address, // Filter for transfers TO this address
      },
      fromBlock: BigInt(0), // From contract deployment
      toBlock: 'latest',
    })

    // Extract unique token IDs
    const tokenIdSet = new Set<bigint>()
    for (const log of logs) {
      if (log.args.tokenId) {
        tokenIdSet.add(log.args.tokenId)
      }
    }

    const tokenIds = Array.from(tokenIdSet)

    if (tokenIds.length === 0) {
      return []
    }

    // 2. Check ownership and fetch metadata for each token
    const objektPromises = tokenIds.map(async (tokenId) => {
      try {
        // Check if address still owns this token
        const currentOwner = (await abstractClient.readContract({
          address: COSMO_CONTRACT_ADDRESS,
          abi: COSMO_CONTRACT_ABI,
          functionName: 'ownerOf',
          args: [tokenId],
        })) as `0x${string}`

        // Skip if no longer owned by this address
        if (currentOwner.toLowerCase() !== address.toLowerCase()) {
          return null
        }

        // Get metadata URI
        const uri = (await abstractClient.readContract({
          address: COSMO_CONTRACT_ADDRESS,
          abi: COSMO_CONTRACT_ABI,
          functionName: 'tokenURI',
          args: [tokenId],
        })) as string

        // Fetch metadata JSON from URI
        const metadata = await fetchMetadata(uri)

        return {
          tokenId: tokenId.toString(),
          owner: address,
          metadata,
        } satisfies Objekt
      } catch (error) {
        console.error(`Failed to fetch metadata for token ${tokenId}:`, error)
        // Return placeholder if metadata fetch fails
        return {
          tokenId: tokenId.toString(),
          owner: address,
          metadata: getPlaceholderMetadata(tokenId.toString()),
        } satisfies Objekt
      }
    })

    const results = await Promise.all(objektPromises)
    // Filter out null values (tokens no longer owned)
    const objekts = results.filter((obj) => obj !== null) as Objekt[]
    return objekts
  } catch (error) {
    console.error('Failed to fetch objekts:', error)
    throw new Error(
      `Failed to fetch objekts: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Fetch metadata from URI
 *
 * Handles both HTTPS and IPFS URIs
 */
async function fetchMetadata(uri: string): Promise<ObjektMetadata> {
  try {
    // Convert IPFS URIs to HTTP gateway
    const httpUri = uri.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${uri.slice(7)}` : uri

    const response = await fetch(httpUri)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const metadata = (await response.json()) as ObjektMetadata
    return metadata
  } catch (error) {
    console.error(`Failed to fetch metadata from ${uri}:`, error)
    throw error
  }
}

/**
 * Get placeholder metadata when fetch fails
 */
function getPlaceholderMetadata(tokenId: string): ObjektMetadata {
  return {
    name: `Objekt #${tokenId}`,
    description: 'Metadata unavailable',
    image: '/cosmo-viewer/placeholder-objekt.png',
    attributes: [],
  }
}

/**
 * Calculate collection statistics from objekts
 */
export function calculateStats(objekts: Objekt[]): CollectionStats {
  const stats: CollectionStats = {
    totalObjekts: objekts.length,
    comoVotingPower: objekts.length, // 1 COMO per objekt
    byMember: {},
    bySeason: {},
    byClass: {},
  }

  for (const objekt of objekts) {
    const { attributes } = objekt.metadata

    // Count by member
    const memberAttr = attributes.find((attr) => attr.trait_type === 'Member')
    if (memberAttr) {
      stats.byMember[memberAttr.value] = (stats.byMember[memberAttr.value] || 0) + 1
    }

    // Count by season
    const seasonAttr = attributes.find((attr) => attr.trait_type === 'Season')
    if (seasonAttr) {
      stats.bySeason[seasonAttr.value] = (stats.bySeason[seasonAttr.value] || 0) + 1
    }

    // Count by class
    const classAttr = attributes.find((attr) => attr.trait_type === 'Class')
    if (classAttr) {
      stats.byClass[classAttr.value] = (stats.byClass[classAttr.value] || 0) + 1
    }
  }

  return stats
}

/**
 * Get specific attribute value from objekt
 */
export function getAttribute(objekt: Objekt, traitType: string): string | undefined {
  return objekt.metadata.attributes.find((attr) => attr.trait_type === traitType)?.value
}

/**
 * Check total supply of objekts on the blockchain
 */
export async function getTotalSupply(): Promise<number> {
  if (!IS_CONTRACT_CONFIGURED) {
    return 0
  }

  try {
    const supply = (await abstractClient.readContract({
      address: COSMO_CONTRACT_ADDRESS,
      abi: COSMO_CONTRACT_ABI,
      functionName: 'totalSupply',
    })) as bigint

    return Number(supply)
  } catch (error) {
    console.error('Failed to fetch total supply:', error)
    return 0
  }
}
