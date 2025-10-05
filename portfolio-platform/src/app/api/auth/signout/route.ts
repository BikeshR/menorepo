import { NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth/session'

// This route uses cookies for session management
export const dynamic = 'force-dynamic'

export async function POST() {
  await destroySession()

  return NextResponse.redirect(
    new URL('/login', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
  )
}
