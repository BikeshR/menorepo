'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Icons } from '@/components/ui/icons'
import { useAuth } from '@/lib/auth'

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, loginWithProvider, isLoading, error, clearError, isAuthenticated } = useAuth()
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const errorParam = searchParams.get('error')

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(callbackUrl)
    }
  }, [isAuthenticated, router, callbackUrl])

  // Clear any existing errors when component mounts
  useEffect(() => {
    clearError()
  }, [clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.email || !formData.password) {
      return
    }

    setIsSubmitting(true)
    
    try {
      const result = await login(formData.email, formData.password)
      
      if (result.success) {
        router.push(callbackUrl)
      }
    } catch (err) {
      console.error('Sign in error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    try {
      await loginWithProvider(provider)
    } catch (err) {
      console.error('OAuth sign in error:', err)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear error when user starts typing
    if (error) {
      clearError()
    }
  }

  const getErrorMessage = () => {
    if (errorParam) {
      switch (errorParam) {
        case 'CredentialsSignin':
          return 'Invalid email or password. Please try again.'
        case 'OAuthSignin':
          return 'Error occurred during OAuth sign in. Please try again.'
        case 'OAuthCallback':
          return 'OAuth callback error. Please try again.'
        case 'OAuthCreateAccount':
          return 'Could not create OAuth account. Please contact support.'
        case 'EmailCreateAccount':
          return 'Could not create account with that email. Please try a different email.'
        case 'Callback':
          return 'Callback error. Please try again.'
        case 'OAuthAccountNotLinked':
          return 'Email already associated with another account. Please sign in with your original method.'
        case 'EmailSignin':
          return 'Check your email for the sign in link.'
        case 'SessionRequired':
          return 'Please sign in to access this page.'
        default:
          return 'An error occurred during sign in. Please try again.'
      }
    }
    
    return error
  }

  const errorMessage = getErrorMessage()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Icons.patent className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Sign in to Solve Intelligence</CardTitle>
          <CardDescription className="text-center">
            Access your AI-powered patent platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="attorney@firm.com"
                value={formData.email}
                onChange={handleInputChange}
                required
                disabled={isLoading || isSubmitting}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                disabled={isLoading || isSubmitting}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || isSubmitting || !formData.email || !formData.password}
            >
              {isSubmitting ? (
                <>
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={() => handleOAuthSignIn('google')}
              disabled={isLoading}
            >
              <Icons.google className="mr-2 h-4 w-4" />
              Google
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOAuthSignIn('github')}
              disabled={isLoading}
            >
              <Icons.gitHub className="mr-2 h-4 w-4" />
              GitHub
            </Button>
          </div>

          <div className="text-center text-sm">
            <Link 
              href="/auth/forgot-password" 
              className="text-primary hover:underline"
            >
              Forgot your password?
            </Link>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link 
              href="/auth/signup" 
              className="text-primary hover:underline"
            >
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}