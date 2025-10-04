import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Welcome back, {user?.email || 'User'}!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Manage your portfolio projects</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-muted-foreground mt-2">Total projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Investments</CardTitle>
            <CardDescription>Track your investment portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">$0.00</p>
            <p className="text-sm text-muted-foreground mt-2">Total value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your public profile information</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{user?.user_metadata?.full_name ? '✓' : '○'}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {user?.user_metadata?.full_name ? 'Complete' : 'Incomplete'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
