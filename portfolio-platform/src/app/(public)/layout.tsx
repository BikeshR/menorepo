import type { Metadata } from 'next'
import { APP_DESCRIPTION, APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
}

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <div className="flex min-h-screen flex-col">{children}</div>
}
