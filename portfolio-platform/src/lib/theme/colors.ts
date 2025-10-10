/**
 * tripleS Member Colors
 * Each S-number maps to a signature color
 */

export const COLOR_PALETTES = [
  { id: 's1', name: 'S1', hex: '#1E90FF' },
  { id: 's2', name: 'S2', hex: '#BF00FF' },
  { id: 's3', name: 'S3', hex: '#FAFA33' },
  { id: 's4', name: 'S4', hex: '#66CC33' },
  { id: 's5', name: 'S5', hex: '#EC118F' },
  { id: 's6', name: 'S6', hex: '#E0B0D5' },
  { id: 's7', name: 'S7', hex: '#5F9EA0' },
  { id: 's8', name: 'S8', hex: '#FFE4E1' },
  { id: 's9', name: 'S9', hex: '#FFCC33' },
  { id: 's10', name: 'S10', hex: '#FBA0E3' },
  { id: 's11', name: 'S11', hex: '#FFDF00' },
  { id: 's12', name: 'S12', hex: '#4169E1' },
  { id: 's13', name: 'S13', hex: '#FFA343' },
  { id: 's14', name: 'S14', hex: '#1034A6' },
  { id: 's15', name: 'S15', hex: '#C80815' },
  { id: 's16', name: 'S16', hex: '#FFA089' },
  { id: 's17', name: 'S17', hex: '#AB62B4' },
  { id: 's18', name: 'S18', hex: '#B7F54A' },
  { id: 's19', name: 'S19', hex: '#52D9BB' },
  { id: 's20', name: 'S20', hex: '#FF428A' },
  { id: 's21', name: 'S21', hex: '#C7A3DF' },
  { id: 's22', name: 'S22', hex: '#7BBA8D' },
  { id: 's23', name: 'S23', hex: '#CFF4FF' },
  { id: 's24', name: 'S24', hex: '#FEAA61' },
] as const

export type ColorPaletteId = (typeof COLOR_PALETTES)[number]['id']

export function getColorById(id: ColorPaletteId) {
  return COLOR_PALETTES.find((color) => color.id === id) || COLOR_PALETTES[0]
}

/**
 * Convert hex color to OKLCH and extract hue
 * Using a simplified conversion via RGB → XYZ → OKLab → OKLCH
 */
function hexToOklch(hex: string): { l: number; c: number; h: number } {
  // Remove # if present
  const cleanHex = hex.replace('#', '')

  // Parse RGB
  const r = Number.parseInt(cleanHex.slice(0, 2), 16) / 255
  const g = Number.parseInt(cleanHex.slice(2, 4), 16) / 255
  const b = Number.parseInt(cleanHex.slice(4, 6), 16) / 255

  // sRGB to linear RGB
  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const rl = toLinear(r)
  const gl = toLinear(g)
  const bl = toLinear(b)

  // Linear RGB to OKLab (using simplified D65 matrix)
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

  // OKLab to OKLCH
  const C = Math.sqrt(A * A + B * B)
  let H = (Math.atan2(B, A) * 180) / Math.PI

  // Normalize hue to 0-360
  if (H < 0) H += 360

  return {
    l: L,
    c: C,
    h: H,
  }
}

/**
 * Get the hue from a member's hex color
 */
export function getHueFromColor(color: (typeof COLOR_PALETTES)[number]): number {
  const oklch = hexToOklch(color.hex)
  return oklch.h
}
