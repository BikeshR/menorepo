import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn utility function', () => {
  describe('Happy Path', () => {
    it('should merge single className', () => {
      const result = cn('text-red-500')

      expect(result).toBe('text-red-500')
    })

    it('should merge multiple classNames', () => {
      const result = cn('text-red-500', 'bg-blue-500')

      expect(result).toBe('text-red-500 bg-blue-500')
    })

    it('should merge Tailwind classes with conflicts (last wins)', () => {
      const result = cn('p-4', 'p-8')

      // twMerge should keep the last conflicting class
      expect(result).toBe('p-8')
    })

    it('should handle conditional classes', () => {
      const isActive = true
      const result = cn('base-class', isActive && 'active-class')

      expect(result).toBe('base-class active-class')
    })

    it('should filter out falsy values', () => {
      const result = cn('base-class', false && 'hidden-class', null, undefined, 'visible-class')

      expect(result).toBe('base-class visible-class')
    })

    it('should merge array of classes', () => {
      const result = cn(['text-red-500', 'bg-blue-500'])

      expect(result).toBe('text-red-500 bg-blue-500')
    })

    it('should handle objects with boolean values', () => {
      const result = cn({
        'text-red-500': true,
        'bg-blue-500': false,
        'p-4': true,
      })

      expect(result).toBe('text-red-500 p-4')
    })

    it('should merge complex Tailwind classes correctly', () => {
      const result = cn('px-4 py-2', 'px-8') // px-8 should override px-4

      expect(result).toBe('py-2 px-8')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const result = cn()

      expect(result).toBe('')
    })

    it('should handle empty strings', () => {
      const result = cn('', '', '')

      expect(result).toBe('')
    })

    it('should handle all falsy values', () => {
      const result = cn(false, null, undefined, '')

      expect(result).toBe('')
    })

    it('should handle mixed inputs', () => {
      const result = cn(
        'base-class',
        true && 'conditional-class',
        false && 'hidden-class',
        ['array-class-1', 'array-class-2'],
        { 'object-class-1': true, 'object-class-2': false }
      )

      expect(result).toBe('base-class conditional-class array-class-1 array-class-2 object-class-1')
    })
  })
})
