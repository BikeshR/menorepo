'use client'

import { Trash2 } from 'lucide-react'
import { useActionState, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Tables } from '@/types/global'
import { createDemoData, type DemoDataFormState, deleteDemoData } from '../actions'

type DemoData = Tables<'demo_private_data'>

interface DemoDataListProps {
  initialData: DemoData[]
  userEmail: string
}

const initialState: DemoDataFormState = {
  success: false,
}

export function DemoDataList({ initialData, userEmail }: DemoDataListProps) {
  const titleId = useId()
  const contentId = useId()
  const [data, setData] = useState<DemoData[]>(initialData)
  const [state, formAction, isPending] = useActionState(createDemoData, initialState)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    // Optimistic update
    setData((prev) => prev.filter((item) => item.id !== id))

    const result = await deleteDemoData(id)

    if (!result.success) {
      // Revert on error
      setData(initialData)
      alert(result.message)
    }

    setDeletingId(null)
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Create Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create Demo Data</CardTitle>
          <CardDescription>Add new entries to demonstrate CRUD operations</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={titleId}>Title</Label>
              <Input
                id={titleId}
                name="title"
                placeholder="Enter title (max 100 chars)"
                maxLength={100}
                required
              />
              {state?.errors?.title && (
                <p className="text-sm text-destructive">{state.errors.title[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={contentId}>Content</Label>
              <textarea
                id={contentId}
                name="content"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter content (max 1000 chars)"
                maxLength={1000}
                required
              />
              {state?.errors?.content && (
                <p className="text-sm text-destructive">{state.errors.content[0]}</p>
              )}
            </div>

            {state?.message && (
              <p className={`text-sm ${state.success ? 'text-green-600' : 'text-destructive'}`}>
                {state.message}
              </p>
            )}

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? 'Creating...' : 'Create Entry'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Data List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Demo Data</CardTitle>
          <CardDescription>Logged in as: {userEmail}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No data yet. Create your first entry!
            </p>
          ) : (
            <div className="space-y-4">
              {data.map((item) => (
                <div key={item.id} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
