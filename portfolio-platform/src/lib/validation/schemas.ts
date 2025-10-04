import { z } from 'zod'

export const createDemoDataSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(1000, 'Content must be 1000 characters or less'),
})

export const deleteDemoDataSchema = z.object({
  id: z.string().uuid('Invalid ID'),
})
