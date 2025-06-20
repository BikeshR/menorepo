'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Icons } from '@/components/ui/icons'
import { useAuth } from '@/lib/auth'

export default function UnauthorizedPage() {
  const router = useRouter()
  const { user, logout } = useAuth()

  const handleGoBack = () => {
    router.back()
  }

  const handleSignOut = async () => {
    await logout()
    router.push('/auth/signin')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/20 rounded-lg flex items-center justify-center">
              <Icons.shield className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Access Restricted</CardTitle>
          <CardDescription className="text-center">
            You don't have permission to access this resource
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            {user ? (
              <>
                You are signed in as <strong>{user.email}</strong> with{' '}
                <strong>{user.role}</strong> privileges.
              </>
            ) : (
              'You need to sign in to access this resource.'
            )}
          </div>

          <div className="space-y-2">
            {user ? (
              <>
                <Button onClick={handleGoBack} className="w-full">
                  <Icons.arrowLeft className="mr-2 h-4 w-4" />
                  Go back
                </Button>
                
                <Button variant="outline" asChild className="w-full">
                  <Link href="/dashboard">
                    <Icons.home className="mr-2 h-4 w-4" />
                    Go to dashboard
                  </Link>
                </Button>

                <Button variant="ghost" onClick={handleSignOut} className="w-full">
                  <Icons.logOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button asChild className="w-full">
                  <Link href="/auth/signin">
                    <Icons.logIn className="mr-2 h-4 w-4" />
                    Sign in
                  </Link>
                </Button>
                
                <Button variant="outline" asChild className="w-full">
                  <Link href="/">
                    <Icons.home className="mr-2 h-4 w-4" />
                    Go to homepage
                  </Link>
                </Button>
              </>
            )}
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Need different permissions?{' '}
            <Link href="/contact" className="text-primary hover:underline">
              Contact your administrator
            </Link>
            .
          </div>
        </CardContent>
      </Card>
    </div>
  )
}