/**
 * COSMO Smart Contract Configuration
 *
 * Contract addresses for COSMO on Abstract blockchain (migrated April 18, 2025)
 * Source: https://github.com/teamreflex/cosmo-db
 */

import type { Address } from 'viem'

/**
 * COSMO NFT Contract Address on Abstract
 *
 * OBJEKT contract on Abstract blockchain
 * Source: https://github.com/teamreflex/cosmo-db/blob/main/src/constants.ts
 */
export const COSMO_CONTRACT_ADDRESS: Address =
  '0x99Bb83AE9bb0C0A6be865CaCF67760947f91Cb70'

/**
 * Minimal ERC-721 ABI for reading objekt data
 * Only includes functions we need for the viewer
 */
export const COSMO_CONTRACT_ABI = [
  // Get number of objekts owned by address
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get token ID by index for an owner
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    name: 'tokenOfOwnerByIndex',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get metadata URI for a token
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get owner of a specific token
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get total supply of objekts
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

/**
 * Helper constant to check if contract is configured
 */
export const IS_CONTRACT_CONFIGURED =
  COSMO_CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000'
