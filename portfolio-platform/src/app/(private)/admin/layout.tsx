import { FolderKanban, Home, LogOut, TrendingUp, User } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'Manage your portfolio and investments',
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b">
            <h1 className="text-xl font-semibold">Admin Panel</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/admin">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Home className="size-4" />
                Dashboard
              </Button>
            </Link>
            <Link href="/admin/profile">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <User className="size-4" />
                Profile
              </Button>
            </Link>
            <Link href="/admin/projects">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <FolderKanban className="size-4" />
                Projects
              </Button>
            </Link>
            <Link href="/admin/investments">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <TrendingUp className="size-4" />
                Investments
              </Button>
            </Link>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t">
            <form action="/api/auth/signout" method="post">
              <Button
                type="submit"
                variant="ghost"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              >
                <LogOut className="size-4" />
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-8">{children}</div>
      </main>
    </div>
  )
}
