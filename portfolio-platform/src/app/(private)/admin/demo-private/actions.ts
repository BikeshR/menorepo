'use server'

import { revalidatePath } from 'next/cache'
import { isAuthenticated } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { createDemoDataSchema, deleteDemoDataSchema } from '@/lib/validation/schemas'

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
    // Check authentication
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return {
        success: false,
        message: 'You must be logged in to create demo data',
      }
    }

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

    // Insert data
    const supabase = createClient()
    const { error: insertError } = await supabase.from('demo_private_data').insert({
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
    // Check authentication
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return {
        success: false,
        message: 'You must be logged in to delete demo data',
      }
    }

    // Validate ID
    const validatedFields = deleteDemoDataSchema.safeParse({ id })

    if (!validatedFields.success) {
      return {
        success: false,
        message: 'Invalid ID',
      }
    }

    // Delete data
    const supabase = createClient()
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
