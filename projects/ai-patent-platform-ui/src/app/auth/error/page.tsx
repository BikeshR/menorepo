'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Icons } from '@/components/ui/icons'

const errorMessages = {
  Configuration: {
    title: 'Server Configuration Error',
    description: 'There is a problem with the server configuration. Please contact support.',
  },
  AccessDenied: {
    title: 'Access Denied',
    description: 'You do not have permission to sign in with this account.',
  },
  Verification: {
    title: 'Verification Error',
    description: 'The verification token has expired or has already been used. Please request a new one.',
  },
  Default: {
    title: 'Authentication Error',
    description: 'An error occurred during authentication. Please try again.',
  },
}

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || 'Default'
  
  const errorInfo = errorMessages[error as keyof typeof errorMessages] || errorMessages.Default

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
              <Icons.alertTriangle className="w-6 h-6 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">{errorInfo.title}</CardTitle>
          <CardDescription className="text-center">
            Something went wrong during authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>{errorInfo.description}</AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/auth/signin">
                Try signing in again
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="w-full">
              <Link href="/">
                Go to homepage
              </Link>
            </Button>
          </div>

          {error === 'AccessDenied' && (
            <div className="text-center text-sm text-muted-foreground">
              If you believe this is an error, please{' '}
              <Link href="/contact" className="text-primary hover:underline">
                contact support
              </Link>
              .
            </div>
          )}

          {error === 'Verification' && (
            <div className="text-center text-sm text-muted-foreground">
              Need a new verification email?{' '}
              <Link href="/auth/resend-verification" className="text-primary hover:underline">
                Resend verification
              </Link>
              .
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}