import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portfolio Platform',
  description: 'Showcase your projects and skills',
}

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <>{children}</>
}
