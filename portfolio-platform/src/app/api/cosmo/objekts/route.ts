/**
 * COSMO Objekts API Route
 *
 * Server-side endpoint for fetching objekts from Abstract blockchain
 * Avoids CORS issues and works reliably on mobile devices
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getObjektsForAddress } from '@/app/(public)/projects/cosmo-viewer/_lib/queries'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const address = searchParams.get('address')

    // Validate address parameter
    if (!address) {
      return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 })
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid Ethereum address format' }, { status: 400 })
    }

    // Fetch objekts from blockchain
    const objekts = await getObjektsForAddress(address as `0x${string}`)

    return NextResponse.json({
      success: true,
      data: objekts,
      count: objekts.length,
    })
  } catch (error) {
    console.error('Failed to fetch objekts:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch objekts',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
