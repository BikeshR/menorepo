'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Bell, Menu, Settings, User, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/lib/auth'

export function Header() {
  const { user, logout, isAuthenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await logout()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      width: '100%',
      borderBottom: '1px solid #E5E7EB',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        height: '64px',
        alignItems: 'center',
        padding: '0 24px'
      }}>
        <div style={{ display: 'flex', marginRight: '16px' }}>
          <Link href="/" style={{
            marginRight: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              backgroundColor: '#1E40AF',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText style={{ width: '16px', height: '16px', color: 'white' }} />
            </div>
            <span style={{
              display: 'none',
              fontWeight: 'bold',
              fontSize: '16px',
              color: '#111827'
            }} className="sm:inline-block">
              Solve Intelligence
            </span>
          </Link>
          <nav style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <Link
              href="/dashboard"
              style={{
                color: '#6B7280',
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#111827'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
            >
              Dashboard
            </Link>
            <Link
              href="/patents"
              style={{
                color: '#6B7280',
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#111827'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
            >
              Patents
            </Link>
            <Link
              href="/invention-wizard"
              style={{
                color: '#6B7280',
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#111827'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
            >
              Invention Wizard
            </Link>
            <Link
              href="/patent-drafting"
              style={{
                color: '#6B7280',
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#111827'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
            >
              Drafting Studio
            </Link>
            <Link
              href="/prior-art-search"
              style={{
                color: '#6B7280',
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#111827'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
            >
              Prior Art Search
            </Link>
          </nav>
        </div>

        {/* Mobile menu button */}
        <Button variant="ghost" style={{
          marginRight: '8px',
          padding: '0',
          textAlign: 'left',
          display: 'flex',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer'
        }} className="md:hidden">
          <Menu style={{ height: '24px', width: '24px' }} />
          <span className="sr-only">Toggle Menu</span>
        </Button>

        <div style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{ width: '100%', flex: 1 }}>
            {/* Search could go here */}
          </div>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" style={{
                  padding: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}>
                  <Bell style={{ height: '16px', width: '16px', color: '#6B7280' }} />
                  <span className="sr-only">Notifications</span>
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" style={{
                      position: 'relative',
                      height: '32px',
                      width: '32px',
                      borderRadius: '50%',
                      padding: 0,
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}>
                      <Avatar style={{ height: '32px', width: '32px' }}>
                        <AvatarImage src={user?.avatar} alt={user?.name || ''} />
                        <AvatarFallback style={{
                          backgroundColor: '#E5E7EB',
                          color: '#6B7280',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <div className="flex items-center justify-start gap-2 p-2">
                      <div className="flex flex-col space-y-1 leading-none">
                        {user?.name && <p className="font-medium">{user.name}</p>}
                        {user?.email && (
                          <p className="w-[200px] truncate text-sm text-muted-foreground">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard">
                        <User className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={handleSignOut}
                      disabled={isLoading}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button variant="ghost" size="sm" asChild style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  border: '1px solid transparent',
                  color: '#6B7280',
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}>
                  <Link href="/auth/signin">Sign In</Link>
                </Button>
                <Button size="sm" asChild style={{
                  padding: '8px 16px',
                  backgroundColor: '#1E40AF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '500',
                  fontSize: '14px',
                  cursor: 'pointer',
                  textDecoration: 'none'
                }}>
                  <Link href="/auth/signup">Sign Up</Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}