import { describe, it, expect } from 'vitest'
import { createDemoDataSchema, deleteDemoDataSchema } from './schemas'

describe('createDemoDataSchema', () => {
  describe('Happy Path', () => {
    it('should validate valid demo data', () => {
      const validData = {
        title: 'Test Project',
        content: 'This is a test project description',
      }

      const result = createDemoDataSchema.safeParse(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    it('should validate with maximum length title', () => {
      const data = {
        title: 'a'.repeat(100), // Exactly 100 characters
        content: 'Valid content',
      }

      const result = createDemoDataSchema.safeParse(data)

      expect(result.success).toBe(true)
    })

    it('should validate with maximum length content', () => {
      const data = {
        title: 'Valid title',
        content: 'a'.repeat(1000), // Exactly 1000 characters
      }

      const result = createDemoDataSchema.safeParse(data)

      expect(result.success).toBe(true)
    })
  })

  describe('Error Cases', () => {
    it('should fail when title is empty', () => {
      const invalidData = {
        title: '',
        content: 'Valid content',
      }

      const result = createDemoDataSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.title).toContain('Title is required')
      }
    })

    it('should fail when title is too long', () => {
      const invalidData = {
        title: 'a'.repeat(101), // 101 characters (over limit)
        content: 'Valid content',
      }

      const result = createDemoDataSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.title).toContain(
          'Title must be 100 characters or less'
        )
      }
    })

    it('should fail when content is empty', () => {
      const invalidData = {
        title: 'Valid title',
        content: '',
      }

      const result = createDemoDataSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.content).toContain('Content is required')
      }
    })

    it('should fail when content is too long', () => {
      const invalidData = {
        title: 'Valid title',
        content: 'a'.repeat(1001), // 1001 characters (over limit)
      }

      const result = createDemoDataSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.content).toContain(
          'Content must be 1000 characters or less'
        )
      }
    })

    it('should fail when title is missing', () => {
      const invalidData = {
        content: 'Valid content',
      }

      const result = createDemoDataSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })

    it('should fail when content is missing', () => {
      const invalidData = {
        title: 'Valid title',
      }

      const result = createDemoDataSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })

    it('should fail when both fields are missing', () => {
      const invalidData = {}

      const result = createDemoDataSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })
  })
})

describe('deleteDemoDataSchema', () => {
  describe('Happy Path', () => {
    it('should validate valid UUID', () => {
      const validData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
      }

      const result = deleteDemoDataSchema.safeParse(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    it('should validate another valid UUID', () => {
      const validData = {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      }

      const result = deleteDemoDataSchema.safeParse(validData)

      expect(result.success).toBe(true)
    })
  })

  describe('Error Cases', () => {
    it('should fail with invalid UUID format', () => {
      const invalidData = {
        id: 'not-a-uuid',
      }

      const result = deleteDemoDataSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.id).toContain('Invalid ID')
      }
    })

    it('should fail with empty string', () => {
      const invalidData = {
        id: '',
      }

      const result = deleteDemoDataSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })

    it('should fail with missing id', () => {
      const invalidData = {}

      const result = deleteDemoDataSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })

    it('should fail with random string', () => {
      const invalidData = {
        id: '12345',
      }

      const result = deleteDemoDataSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })
  })
})
