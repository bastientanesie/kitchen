import { Laptop, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import type { KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const options = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
  { value: 'system', label: 'Système', icon: Laptop },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return

    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (index + direction + options.length) % options.length
    setTheme(options[nextIndex].value)
    ;(
      event.currentTarget.parentElement?.children[nextIndex] as HTMLButtonElement | undefined
    )?.focus()
  }

  return (
    <div role="radiogroup" aria-label="Thème" className="inline-flex gap-1 rounded-md border border-input p-1">
      {options.map(({ value, label, icon: Icon }, index) => (
        <Button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          tabIndex={theme === value ? 0 : -1}
          variant={theme === value ? 'default' : 'ghost'}
          size="sm"
          className={cn('gap-1.5')}
          onClick={() => setTheme(value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          <Icon className="size-4" />
          {label}
        </Button>
      ))}
    </div>
  )
}
