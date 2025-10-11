/**
 * Abstract Blockchain Client Configuration
 *
 * Configures viem to connect to Abstract L2 blockchain
 */

import { type Chain, createPublicClient, http } from 'viem'

/**
 * Abstract Chain Configuration
 * Chain ID: 2741
 * Explorer: https://abscan.org
 */
export const abstractChain = {
  id: 2741,
  name: 'Abstract',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://api.mainnet.abs.xyz'],
    },
    public: {
      http: ['https://abstract-mainnet.public.blastapi.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Abscan',
      url: 'https://abscan.org',
    },
  },
} as const satisfies Chain

/**
 * Public client for read-only operations
 * Used for querying blockchain data (balances, token info, etc.)
 */
export const abstractClient = createPublicClient({
  chain: abstractChain,
  transport: http(abstractChain.rpcUrls.default.http[0], {
    batch: true, // Enable batching for better performance
    retryCount: 3, // Retry failed requests
  }),
})

/**
 * Helper function to check if an address is valid
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Helper function to truncate address for display
 * Example: 0x1234...5678
 */
export function truncateAddress(address: string, chars = 4): string {
  if (!isValidAddress(address)) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}
