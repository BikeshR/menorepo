/**
 * COSMO Objekt Viewer
 *
 * A blockchain explorer for TripleS COSMO objekts on Abstract L2
 * View and analyze your objekt collection by wallet address
 */

import type { Metadata } from 'next'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'COSMO Objekt Viewer - TripleS Collection Explorer',
  description:
    'Explore your TripleS COSMO objekt collection on Abstract blockchain. View stats, filter by member or season, and analyze your COMO voting power.',
  openGraph: {
    title: 'COSMO Objekt Viewer',
    description: 'View and analyze your TripleS COSMO objekt collection',
    type: 'website',
  },
}
import { AddressSearch } from './_components/AddressSearch'
import { ObjektGrid } from './_components/ObjektGrid'
import { QueryProvider } from './_components/QueryProvider'
import { isValidAddress } from './_lib/abstract-client'
import { IS_CONTRACT_CONFIGURED } from './_lib/contracts'

type PageProps = {
  searchParams: Promise<{
    address?: string
  }>
}

export default async function CosmoViewerPage({ searchParams }: PageProps) {
  const params = await searchParams
  const address = params.address

  return (
    <QueryProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              COSMO Objekt Viewer
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Explore your TripleS COSMO objekt collection on Abstract blockchain. View stats,
              filter by member or season, and analyze your COMO voting power.
            </p>
          </div>

          {/* Configuration Warning */}
          {!IS_CONTRACT_CONFIGURED && (
            <div className="mb-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                Configuration Required
              </h3>
              <p className="text-yellow-800 dark:text-yellow-200">
                The COSMO contract address needs to be configured. Please update{' '}
                <code className="bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded">
                  COSMO_CONTRACT_ADDRESS
                </code>{' '}
                in{' '}
                <code className="bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded">
                  contracts.ts
                </code>{' '}
                with the actual contract address from Abstract blockchain.
              </p>
            </div>
          )}

          {/* Search */}
          <div className="mb-12">
            <Suspense
              fallback={
                <div className="w-full max-w-2xl mx-auto h-12 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
              }
            >
              <AddressSearch />
            </Suspense>
          </div>

          {/* Results */}
          {address && IS_CONTRACT_CONFIGURED && (
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-gray-600 dark:text-gray-400">Loading objekts...</p>
                  </div>
                </div>
              }
            >
              {isValidAddress(address) ? (
                <ObjektGrid address={address as `0x${string}`} />
              ) : (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                    Invalid Address
                  </h3>
                  <p className="text-red-700 dark:text-red-200">
                    Please enter a valid Ethereum address (0x followed by 40 hex characters).
                  </p>
                </div>
              )}
            </Suspense>
          )}

          {/* Info Footer */}
          {!address && (
            <div className="mt-16 max-w-3xl mx-auto">
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800 p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  About COSMO
                </h2>
                <div className="space-y-4 text-gray-600 dark:text-gray-400">
                  <p>
                    COSMO is TripleS&#39;s blockchain-based collectible system featuring digital
                    objekts (photocards) of the members. Each objekt is a unique NFT on the
                    Abstract L2 blockchain.
                  </p>
                  <p>
                    Objekts provide COMO voting power, allowing fans to participate in
                    group decisions. Each objekt equals 1 COMO vote.
                  </p>
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      How to use:
                    </h3>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Enter your wallet address in the search box above</li>
                      <li>View your complete objekt collection</li>
                      <li>Filter by member, season, or class</li>
                      <li>See your total COMO voting power</li>
                      <li>Share your collection using the URL</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </QueryProvider>
  )
}
