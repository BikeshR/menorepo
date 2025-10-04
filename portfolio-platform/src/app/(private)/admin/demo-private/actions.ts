'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// Validation schemas
const createDemoDataSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(1000, 'Content must be 1000 characters or less'),
})

const deleteDemoDataSchema = z.object({
  id: z.string().uuid('Invalid ID'),
})

export type DemoDataFormState = {
  success: boolean
  message?: string
  errors?: {
    title?: string[]
    content?: string[]
  }
}

export async function createDemoData(
  _prevState: DemoDataFormState,
  formData: FormData
): Promise<DemoDataFormState> {
  try {
    // Parse and validate form data
    const validatedFields = createDemoDataSchema.safeParse({
      title: formData.get('title'),
      content: formData.get('content'),
    })

    if (!validatedFields.success) {
      return {
        success: false,
        message: 'Validation failed',
        errors: validatedFields.error.flatten().fieldErrors,
      }
    }

    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        message: 'You must be logged in to create demo data',
      }
    }

    // Insert data
    const { error: insertError } = await supabase.from('demo_private_data').insert({
      user_id: user.id,
      title: validatedFields.data.title,
      content: validatedFields.data.content,
    })

    if (insertError) {
      console.error('Failed to create demo data:', insertError)
      return {
        success: false,
        message: 'Failed to create demo data. Please try again.',
      }
    }

    // Revalidate the page
    revalidatePath('/admin/demo-private')

    return {
      success: true,
      message: 'Demo data created successfully!',
    }
  } catch (error) {
    console.error('Unexpected error in createDemoData:', error)
    return {
      success: false,
      message: 'An unexpected error occurred',
    }
  }
}

export async function deleteDemoData(id: string): Promise<{ success: boolean; message: string }> {
  try {
    // Validate ID
    const validatedFields = deleteDemoDataSchema.safeParse({ id })

    if (!validatedFields.success) {
      return {
        success: false,
        message: 'Invalid ID',
      }
    }

    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        message: 'You must be logged in to delete demo data',
      }
    }

    // Delete data (RLS ensures user can only delete their own data)
    const { error: deleteError } = await supabase
      .from('demo_private_data')
      .delete()
      .eq('id', validatedFields.data.id)

    if (deleteError) {
      console.error('Failed to delete demo data:', deleteError)
      return {
        success: false,
        message: 'Failed to delete demo data. Please try again.',
      }
    }

    // Revalidate the page
    revalidatePath('/admin/demo-private')

    return {
      success: true,
      message: 'Demo data deleted successfully!',
    }
  } catch (error) {
    console.error('Unexpected error in deleteDemoData:', error)
    return {
      success: false,
      message: 'An unexpected error occurred',
    }
  }
}
