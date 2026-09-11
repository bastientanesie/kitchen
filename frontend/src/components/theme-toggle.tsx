import { Laptop, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const options = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
  { value: 'system', label: 'Système', icon: Laptop },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div role="radiogroup" aria-label="Thème" className="inline-flex gap-1 rounded-md border border-input p-1">
      {options.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          variant={theme === value ? 'default' : 'ghost'}
          size="sm"
          className={cn('gap-1.5')}
          onClick={() => setTheme(value)}
        >
          <Icon className="size-4" />
          {label}
        </Button>
      ))}
    </div>
  )
}
