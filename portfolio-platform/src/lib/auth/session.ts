import { getIronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

export interface SessionData {
  username: string
  isLoggedIn: boolean
}

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'portfolio_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}

export async function createSession(username: string) {
  const session = await getSession()
  session.username = username
  session.isLoggedIn = true
  await session.save()
}

export async function destroySession() {
  const session = await getSession()
  session.destroy()
}

export async function isAuthenticated() {
  const session = await getSession()
  return session.isLoggedIn === true
}
