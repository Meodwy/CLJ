'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const label = theme === 'light' ? 'Modo escuro' : 'Modo claro'

  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/40 transition-all duration-200 hover:bg-muted hover:text-foreground/70"
    >
      {theme === 'light' ? (
        <Moon className="h-[18px] w-[18px] stroke-[1.5]" aria-hidden />
      ) : (
        <Sun className="h-[18px] w-[18px] stroke-[1.5]" aria-hidden />
      )}
    </button>
  )
}