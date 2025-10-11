'use client'

/**
 * AddressSearch Component
 *
 * Input field for searching objekts by wallet address
 * Updates URL with ?address=0x... parameter for sharing
 */

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isValidAddress } from '../_lib/abstract-client'

export function AddressSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [input, setInput] = useState(searchParams.get('address') || '')
  const [error, setError] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate address
    if (!input.trim()) {
      setError('Please enter a wallet address')
      return
    }

    if (!isValidAddress(input.trim())) {
      setError('Invalid Ethereum address. Must be 0x followed by 40 hex characters.')
      return
    }

    // Clear error and update URL
    setError('')
    router.push(`?address=${input.trim()}`)
  }

  const handleClear = () => {
    setInput('')
    setError('')
    router.push('/projects/cosmo-viewer')
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setError('') // Clear error on input
          }}
          placeholder="Enter wallet address (0x...)"
          className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950"
        >
          Search
        </button>
        {input && (
          <button
            type="button"
            onClick={handleClear}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950"
          >
            Clear
          </button>
        )}
      </form>

      {error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p>Example addresses to try:</p>
        <ul className="mt-2 space-y-1">
          <li>
            <button
              type="button"
              onClick={() => setInput('0x1234567890123456789012345678901234567890')}
              className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs"
            >
              0x1234567890123456789012345678901234567890
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}
