'use client'

import { Check, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useThemeColor } from '@/lib/theme/use-theme-color'

/**
 * Theme color picker component
 * Displays 24 tripleS colors in a 6x4 grid (S1-S24)
 */
export function ThemeColorPicker() {
  const { currentColor, changeColor, availableColors } = useThemeColor()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" title="Change theme color">
          <Palette className="h-4 w-4" />
          <span className="sr-only">Change theme color</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="grid grid-cols-6 gap-1.5 p-3">
          {availableColors.map((color) => {
            const isSelected = color.id === currentColor.id

            return (
              <DropdownMenuItem
                key={color.id}
                className="p-0 focus:bg-transparent"
                onClick={() => changeColor(color.id)}
              >
                <button
                  type="button"
                  className="relative w-10 h-10 rounded-md border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  style={{
                    backgroundColor: color.hex,
                    borderColor: isSelected ? 'white' : 'transparent',
                  }}
                  title={color.name}
                >
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white drop-shadow-md" strokeWidth={3} />
                    </div>
                  )}
                </button>
              </DropdownMenuItem>
            )
          })}
        </div>

        {/* Current color display */}
        <div className="border-t mt-2 pt-2 px-3 pb-2">
          <p className="text-sm text-center">
            <span className="font-medium text-foreground">{currentColor.name}</span>
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
