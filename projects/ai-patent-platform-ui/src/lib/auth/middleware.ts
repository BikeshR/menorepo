import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Define protected routes and their required permissions
const PROTECTED_ROUTES = {
  '/dashboard': [],
  '/patents': ['patents:read'],
  '/patents/create': ['patents:write'],
  '/patents/*/edit': ['patents:write'],
  '/invention-wizard': ['patents:write', 'ai:use'],
  '/patent-drafting': ['patents:write', 'ai:use'],
  '/prior-art-search': ['ai:use'],
  '/analytics': ['analytics:read'],
  '/settings': [],
  '/admin': ['admin:access'],
} as const

// Define role hierarchy
const ROLE_HIERARCHY = {
  admin: ['admin:access', 'analytics:read', 'patents:read', 'patents:write', 'ai:use'],
  attorney: ['analytics:read', 'patents:read', 'patents:write', 'ai:use'],
  counsel: ['analytics:read', 'patents:read', 'patents:write', 'ai:use'],
  paralegal: ['patents:read', 'patents:write'],
} as const

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/auth/signin',
  '/auth/signup',
  '/auth/error',
  '/auth/verify-request',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
]

// API routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/auth',
  '/api/health',
  '/api/public',
]

export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip middleware for public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }
  
  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    // Redirect to sign-in if no token
    if (!token) {
      return redirectToSignIn(request)
    }

    // Check if user has required permissions for the route
    const hasAccess = await checkRouteAccess(pathname, token)
    
    if (!hasAccess) {
      return redirectToUnauthorized(request)
    }

    // Add user info to headers for API routes
    if (pathname.startsWith('/api/')) {
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-user-id', token.userId || '')
      requestHeaders.set('x-user-role', token.role || '')
      requestHeaders.set('x-user-permissions', JSON.stringify(token.permissions || []))
      requestHeaders.set('x-firm-id', token.firmId || '')

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return redirectToSignIn(request)
  }
}

function isPublicRoute(pathname: string): boolean {
  // Check exact matches
  if (PUBLIC_ROUTES.includes(pathname)) {
    return true
  }
  
  // Check API routes
  if (PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))) {
    return true
  }
  
  // Check dynamic routes
  if (pathname.match(/^\/auth\//)) {
    return true
  }
  
  return false
}

async function checkRouteAccess(pathname: string, token: any): Promise<boolean> {
  const userPermissions = new Set([
    ...(token.permissions || []),
    ...(ROLE_HIERARCHY[token.role as keyof typeof ROLE_HIERARCHY] || []),
  ])
  
  // Check exact route match
  for (const [route, requiredPermissions] of Object.entries(PROTECTED_ROUTES)) {
    if (pathname === route || pathname.match(routeToRegex(route))) {
      if (requiredPermissions.length === 0) {
        return true // Route requires authentication but no specific permissions
      }
      
      return requiredPermissions.every(permission => userPermissions.has(permission))
    }
  }
  
  // Default to allowing access for authenticated users to unspecified routes
  return true
}

function routeToRegex(route: string): RegExp {
  // Convert route patterns like '/patents/*/edit' to regex
  const pattern = route
    .replace(/\*/g, '[^/]+')
    .replace(/\//g, '\\/')
  
  return new RegExp(`^${pattern}$`)
}

function redirectToSignIn(request: NextRequest): NextResponse {
  const signInUrl = new URL('/auth/signin', request.url)
  signInUrl.searchParams.set('callbackUrl', request.url)
  
  return NextResponse.redirect(signInUrl)
}

function redirectToUnauthorized(request: NextRequest): NextResponse {
  const unauthorizedUrl = new URL('/auth/unauthorized', request.url)
  return NextResponse.redirect(unauthorizedUrl)
}

// Higher-order component for protecting pages
export function withAuth<T extends object>(
  WrappedComponent: any,
  requiredPermissions: string[] = []
) {
  // This will be implemented in a separate .tsx file
  throw new Error('withAuth HOC should be imported from @/lib/auth/components')
}