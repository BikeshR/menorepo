import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">Portfolio Platform</h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Showcase your projects and manage your portfolio in one place
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href={ROUTES.LOGIN}>
            <Button size="lg" className="w-full sm:w-auto">
              Get Started
            </Button>
          </Link>
          <Link href={ROUTES.SIGNUP}>
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Sign Up
            </Button>
          </Link>
        </div>

        <div className="pt-8 text-sm text-muted-foreground">
          <p>Built with Next.js 15, React 19, Tailwind CSS 4, and Supabase</p>
        </div>
      </div>
    </div>
  )
}
