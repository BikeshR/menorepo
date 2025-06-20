'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Icons } from '@/components/ui/icons'

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const token = searchParams.get('token')
  
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verifying' | 'success' | 'error'>('pending')
  const [verificationMessage, setVerificationMessage] = useState('')

  // If there's a token in the URL, attempt verification
  useEffect(() => {
    if (token && email) {
      verifyEmail(token, email)
    }
  }, [token, email])

  const verifyEmail = async (verificationToken: string, userEmail: string) => {
    setVerificationStatus('verifying')
    
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: verificationToken,
          email: userEmail,
        }),
      })

      if (response.ok) {
        setVerificationStatus('success')
        setVerificationMessage('Your email has been verified successfully! You can now sign in.')
      } else {
        const errorData = await response.json()
        setVerificationStatus('error')
        setVerificationMessage(errorData.message || 'Verification failed. The link may be expired or invalid.')
      }
    } catch (error) {
      setVerificationStatus('error')
      setVerificationMessage('An error occurred during verification. Please try again.')
    }
  }

  const handleResendVerification = async () => {
    if (!email) {
      setResendMessage('Email address is required')
      return
    }

    setIsResending(true)
    setResendMessage('')

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (response.ok) {
        setResendMessage('Verification email sent! Please check your inbox.')
      } else {
        const errorData = await response.json()
        setResendMessage(errorData.message || 'Failed to resend verification email.')
      }
    } catch (error) {
      setResendMessage('An error occurred. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  const renderContent = () => {
    switch (verificationStatus) {
      case 'verifying':
        return (
          <>
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icons.spinner className="w-6 h-6 text-primary animate-spin" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Verifying Email</CardTitle>
            <CardDescription className="text-center">
              Please wait while we verify your email address...
            </CardDescription>
          </>
        )

      case 'success':
        return (
          <>
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <Icons.checkCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Email Verified!</CardTitle>
            <CardDescription className="text-center">
              Your email has been successfully verified
            </CardDescription>
          </>
        )

      case 'error':
        return (
          <>
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                <Icons.alertTriangle className="w-6 h-6 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Verification Failed</CardTitle>
            <CardDescription className="text-center">
              There was a problem verifying your email
            </CardDescription>
          </>
        )

      default:
        return (
          <>
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icons.mail className="w-6 h-6 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Check Your Email</CardTitle>
            <CardDescription className="text-center">
              We've sent you a verification link
            </CardDescription>
          </>
        )
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          {renderContent()}
        </CardHeader>
        <CardContent className="space-y-4">
          {verificationStatus === 'success' && (
            <Alert>
              <Icons.checkCircle className="h-4 w-4" />
              <AlertDescription>{verificationMessage}</AlertDescription>
            </Alert>
          )}

          {verificationStatus === 'error' && (
            <Alert variant="destructive">
              <Icons.alertTriangle className="h-4 w-4" />
              <AlertDescription>{verificationMessage}</AlertDescription>
            </Alert>
          )}

          {verificationStatus === 'pending' && email && (
            <div className="text-center text-sm text-muted-foreground">
              We sent a verification email to{' '}
              <strong className="text-foreground">{email}</strong>
              <br />
              Click the link in the email to verify your account.
            </div>
          )}

          {resendMessage && (
            <Alert variant={resendMessage.includes('sent') ? 'default' : 'destructive'}>
              <AlertDescription>{resendMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            {verificationStatus === 'success' && (
              <Button asChild className="w-full">
                <Link href="/auth/signin">
                  <Icons.logIn className="mr-2 h-4 w-4" />
                  Sign in to your account
                </Link>
              </Button>
            )}

            {(verificationStatus === 'pending' || verificationStatus === 'error') && (
              <Button
                onClick={handleResendVerification}
                disabled={isResending || !email}
                variant="outline"
                className="w-full"
              >
                {isResending ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Resending...
                  </>
                ) : (
                  <>
                    <Icons.mail className="mr-2 h-4 w-4" />
                    Resend verification email
                  </>
                )}
              </Button>
            )}

            <Button variant="ghost" asChild className="w-full">
              <Link href="/auth/signin">
                Back to sign in
              </Link>
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Didn't receive the email? Check your spam folder or{' '}
            <Link href="/contact" className="text-primary hover:underline">
              contact support
            </Link>
            .
          </div>
        </CardContent>
      </Card>
    </div>
  )
}