/**
 * Generates CSS variables for dark mode theme based on a hue value
 *
 * Primary color: Bright and vibrant (L=0.72, C=0.16)
 * Background color: Dark with subtle tint (L=0.155, C=0.013)
 *
 * All colors maintain the original hue from tripleS member colors
 */
export function generateThemeCSS(hue: number): string {
  return `
    :root {
      /* Primary - Bright and accessible for dark mode */
      --primary: oklch(0.72 0.16 ${hue});
      --primary-foreground: oklch(0.145 0 0);

      /* Background - Dark with moderate member color tint */
      --background: oklch(0.155 0.025 ${hue});
      --foreground: oklch(0.985 0 0);

      /* Secondary - Slightly lighter than background */
      --secondary: oklch(0.205 0.012 ${hue});
      --secondary-foreground: oklch(0.985 0 0);

      /* Accent - More visible than secondary */
      --accent: oklch(0.205 0.018 ${hue});
      --accent-foreground: oklch(0.985 0 0);

      /* Muted - Subtle elements */
      --muted: oklch(0.205 0.012 ${hue});
      --muted-foreground: oklch(0.645 0 0);

      /* Card - Same as background with slight variation */
      --card: oklch(0.155 0.013 ${hue});
      --card-foreground: oklch(0.985 0 0);

      /* Popover - Slightly elevated */
      --popover: oklch(0.165 0.013 ${hue});
      --popover-foreground: oklch(0.985 0 0);

      /* Borders and inputs - Visible but subtle */
      --border: oklch(0.22 0.015 ${hue});
      --input: oklch(0.22 0.015 ${hue});
      --ring: oklch(0.72 0.16 ${hue});

      /* Destructive stays red (hue 25) */
      --destructive: oklch(0.70 0.18 25);
      --destructive-foreground: oklch(0.985 0 0);

      --radius: 0.625rem;
    }
  `.trim()
}

/**
 * Apply theme CSS by injecting a style tag into the document
 */
export function applyTheme(hue: number): void {
  const styleId = 'dynamic-theme'
  let styleElement = document.getElementById(styleId) as HTMLStyleElement

  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = styleId
    document.head.appendChild(styleElement)
  }

  styleElement.textContent = generateThemeCSS(hue)
}
