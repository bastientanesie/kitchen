import { Archive, Refrigerator, Snowflake } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Ingredient, Storage } from '@/lib/ingredients'

const storageIcons: Record<Storage, typeof Refrigerator> = {
  frigo: Refrigerator,
  placard: Archive,
  congelateur: Snowflake,
}

export function IngredientCard({
  ingredient,
  onTogglePresence,
}: {
  ingredient: Ingredient
  onTogglePresence: (id: string, present: boolean) => void
}) {
  const Icon = storageIcons[ingredient.storage]

  return (
    <li className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate font-medium">{ingredient.name}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={ingredient.present}
        aria-label={ingredient.name}
        onClick={() => onTogglePresence(ingredient.id, !ingredient.present)}
        className={cn(
          'inline-flex h-11 min-w-[6.5rem] items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          ingredient.present
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        )}
      >
        {ingredient.present ? 'Présent' : 'Absent'}
      </button>
    </li>
  )
}
