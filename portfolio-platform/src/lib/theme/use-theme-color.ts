'use client'

import { useEffect, useState } from 'react'
import { COLOR_PALETTES, type ColorPaletteId, getHueFromColor } from './colors'
import { applyTheme } from './theme-generator'

const STORAGE_KEY = 'bikesh-theme-color'
const DEFAULT_COLOR_ID: ColorPaletteId = 's1' // Default to S1

/**
 * Hook to manage theme color selection with localStorage persistence
 * Uses tripleS member colors
 */
export function useThemeColor() {
  const [colorId, setColorId] = useState<ColorPaletteId>(DEFAULT_COLOR_ID)

  // Load saved color from localStorage on mount
  useEffect(() => {
    const savedColorId = localStorage.getItem(STORAGE_KEY) as ColorPaletteId | null
    if (savedColorId && COLOR_PALETTES.some((c) => c.id === savedColorId)) {
      setColorId(savedColorId)
    }
  }, [])

  // Apply theme whenever color changes
  useEffect(() => {
    const color = COLOR_PALETTES.find((c) => c.id === colorId)
    if (color) {
      const hue = getHueFromColor(color)
      applyTheme(hue)
    }
  }, [colorId])

  const changeColor = (newColorId: ColorPaletteId) => {
    setColorId(newColorId)
    localStorage.setItem(STORAGE_KEY, newColorId)
  }

  const currentColor = COLOR_PALETTES.find((c) => c.id === colorId) || COLOR_PALETTES[0]

  return {
    colorId,
    currentColor,
    changeColor,
    availableColors: COLOR_PALETTES,
  }
}
