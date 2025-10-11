/**
 * Admin COSMO Viewer
 *
 * Redirects to the public COSMO viewer with personal wallet address pre-filled
 */

import { redirect } from 'next/navigation'

export const metadata = {
  title: 'My COSMO Objekts',
  description: 'View my COSMO objekt collection',
}

export default function AdminCosmoPage() {
  // Get wallet address from environment variable
  const walletAddress = process.env.COSMO_WALLET_ADDRESS

  if (!walletAddress || walletAddress === '0x0000000000000000000000000000000000000000') {
    // If no wallet address configured, show configuration instructions
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-900 dark:text-yellow-100 mb-3">
            Wallet Address Not Configured
          </h2>
          <p className="text-yellow-800 dark:text-yellow-200 mb-4">
            To use the admin COSMO viewer, please add your wallet address to{' '}
            <code className="bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded">.env.local</code>
          </p>
          <div className="bg-yellow-100 dark:bg-yellow-900 rounded p-4 font-mono text-sm mb-4">
            <code>COSMO_WALLET_ADDRESS=0xYourWalletAddressHere</code>
          </div>
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            After adding your address, restart the development server.
          </p>
        </div>
      </div>
    )
  }

  // Redirect to public viewer with address pre-filled
  redirect(`/projects/cosmo-viewer?address=${walletAddress}`)
}
