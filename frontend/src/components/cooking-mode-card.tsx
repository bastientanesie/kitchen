import { Flame } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { CookingMode } from '@/lib/cooking-modes'

export function CookingModeCard({
  cookingMode,
  onTogglePresence,
}: {
  cookingMode: CookingMode
  onTogglePresence: (id: string, present: boolean) => void
}) {
  return (
    <li className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <span className="flex min-w-0 items-center gap-3">
        <Flame className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate font-medium">{cookingMode.name}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={cookingMode.present}
        aria-label={cookingMode.name}
        onClick={() => onTogglePresence(cookingMode.id, !cookingMode.present)}
        className={cn(
          'inline-flex h-11 min-w-[6.5rem] items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          cookingMode.present
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        )}
      >
        {cookingMode.present ? 'Présent' : 'Absent'}
      </button>
    </li>
  )
}
