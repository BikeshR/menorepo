import { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import CredentialsProvider from 'next-auth/providers/credentials'
import { DefaultPatentService } from '@/lib/services'

export const authConfig = {
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/onboarding',
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile',
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email',
        },
      },
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Call your authentication API
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          })

          if (!response.ok) {
            return null
          }

          const user = await response.json()
          
          if (user && user.id) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.avatar,
              role: user.role,
              firmId: user.firmId,
              permissions: user.permissions,
            }
          }

          return null
        } catch (error) {
          console.error('Authentication error:', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      try {
        // Check if user exists in your system
        if (account?.provider === 'google' || account?.provider === 'github') {
          // For OAuth providers, create or update user
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/oauth-signin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              provider: account.provider,
              providerId: account.providerAccountId,
              email: user.email,
              name: user.name,
              image: user.image,
            }),
          })

          if (!response.ok) {
            console.error('OAuth sign-in failed:', await response.text())
            return false
          }

          const userData = await response.json()
          
          // Extend user object with additional data
          user.id = userData.id
          user.role = userData.role
          user.firmId = userData.firmId
          user.permissions = userData.permissions
        }

        return true
      } catch (error) {
        console.error('Sign-in error:', error)
        return false
      }
    },
    
    async jwt({ token, user, account, trigger, session }) {
      // Persist additional user data to the token
      if (user) {
        token.role = user.role
        token.firmId = user.firmId
        token.permissions = user.permissions
        token.userId = user.id
      }

      // Handle session updates
      if (trigger === 'update' && session) {
        token.role = session.role
        token.firmId = session.firmId
        token.permissions = session.permissions
      }

      // Refresh user data periodically
      if (token.userId && (!token.lastRefresh || Date.now() - token.lastRefresh > 60 * 60 * 1000)) {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/users/${token.userId}`, {
            headers: {
              'Authorization': `Bearer ${token.accessToken}`,
            },
          })

          if (response.ok) {
            const userData = await response.json()
            token.role = userData.role
            token.firmId = userData.firmId
            token.permissions = userData.permissions
            token.lastRefresh = Date.now()
          }
        } catch (error) {
          console.error('Failed to refresh user data:', error)
        }
      }

      return token
    },
    
    async session({ session, token }) {
      // Send properties to the client
      if (token) {
        session.user.id = token.userId as string
        session.user.role = token.role as string
        session.user.firmId = token.firmId as string
        session.user.permissions = token.permissions as string[]
      }

      return session
    },
    
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log('User signed in:', { userId: user.id, email: user.email, isNewUser })
      
      // Track sign-in analytics
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/analytics/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: 'user_signin',
            userId: user.id,
            metadata: {
              provider: account?.provider,
              isNewUser,
            },
          }),
        })
      } catch (error) {
        console.error('Failed to track sign-in event:', error)
      }
    },
    
    async signOut({ session, token }) {
      console.log('User signed out:', { userId: token?.userId })
      
      // Track sign-out analytics
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/analytics/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: 'user_signout',
            userId: token?.userId,
          }),
        })
      } catch (error) {
        console.error('Failed to track sign-out event:', error)
      }
    },
  },
} satisfies NextAuthConfig

// Type augmentation for NextAuth
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string
      role: string
      firmId: string
      permissions: string[]
    }
  }

  interface User {
    role?: string
    firmId?: string
    permissions?: string[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    role?: string
    firmId?: string
    permissions?: string[]
    lastRefresh?: number
  }
}