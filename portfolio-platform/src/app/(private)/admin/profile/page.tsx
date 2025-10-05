import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSession } from '@/lib/auth/session'

// This page requires authentication and uses cookies
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const session = await getSession()

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-2">Your account information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>Single-user admin account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Username</p>
              <p className="text-lg">{session.username || 'Not logged in'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <p className="text-lg">
                {session.isLoggedIn ? (
                  <span className="text-green-600">Active</span>
                ) : (
                  <span className="text-muted-foreground">Not logged in</span>
                )}
              </p>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                To change your username or password, update the environment variables in{' '}
                <code className="px-1 py-0.5 bg-muted rounded">.env.local</code> and restart the
                server.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
