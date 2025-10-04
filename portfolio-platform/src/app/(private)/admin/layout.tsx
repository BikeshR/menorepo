'use client'

import { Beaker, FolderKanban, Home, LogOut, Menu, TrendingUp, User, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const closeSidebar = () => {
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeSidebar()
          }}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 border-r bg-card transform transition-transform duration-200 ease-in-out lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b flex items-center justify-between">
            <h1 className="text-xl font-semibold">Admin Panel</h1>
            <button
              type="button"
              className="lg:hidden"
              onClick={closeSidebar}
              aria-label="Close sidebar"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/admin" onClick={closeSidebar}>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Home className="size-4" />
                Dashboard
              </Button>
            </Link>
            <Link href="/admin/profile" onClick={closeSidebar}>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <User className="size-4" />
                Profile
              </Button>
            </Link>
            <Link href="/admin/projects" onClick={closeSidebar}>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <FolderKanban className="size-4" />
                Projects
              </Button>
            </Link>
            <Link href="/admin/investments" onClick={closeSidebar}>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <TrendingUp className="size-4" />
                Investments
              </Button>
            </Link>
            <Link href="/admin/demo-private" onClick={closeSidebar}>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Beaker className="size-4" />
                Demo CRUD
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
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 border-b bg-background px-4 py-3">
          <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
            <Menu className="size-6" />
          </button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1">
          <div className="container mx-auto p-4 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
