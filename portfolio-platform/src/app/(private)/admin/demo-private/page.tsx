import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { DemoDataList } from './_components/DemoDataList'

export const metadata = {
  title: 'Demo Private Project',
  description: 'Demo CRUD project with Supabase and React Query',
}

// This page requires authentication and uses cookies
export const dynamic = 'force-dynamic'

export default async function DemoPrivatePage() {
  const supabase = createClient()
  const session = await getSession()

  // Fetch demo data
  const { data: demoData, error } = await supabase
    .from('demo_private_data')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching demo data:', error)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Demo Private Project</h1>
        <p className="text-muted-foreground mt-2">
          A demonstration of full CRUD operations with server actions and session-based auth
        </p>
      </div>

      <DemoDataList initialData={demoData || []} username={session.username || 'Unknown'} />
    </div>
  )
}
