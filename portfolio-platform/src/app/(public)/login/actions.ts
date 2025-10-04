'use server'

import { redirect } from 'next/navigation'
import { createSession } from '@/lib/auth/session'

export async function login(_prevState: unknown, formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    await createSession(username)
    redirect('/admin')
  }

  return {
    error: 'Invalid username or password',
  }
}
