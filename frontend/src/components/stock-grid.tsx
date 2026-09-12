import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { IngredientCard } from '@/components/ingredient-card'
import { normalizeForSearch } from '@/lib/normalize-search'
import {
  IngredientsError,
  fetchIngredients,
  updateIngredientPresence,
  type Ingredient,
} from '@/lib/ingredients'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; ingredients: Ingredient[] }
  | { status: 'error'; message: string }

export function StockGrid() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [toggleError, setToggleError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchIngredients()
      .then((ingredients) => {
        if (!cancelled) setState({ status: 'ready', ingredients })
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof IngredientsError ? err.message : 'Une erreur est survenue.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const filteredIngredients = useMemo(() => {
    if (state.status !== 'ready') return []
    const normalizedQuery = normalizeForSearch(query)
    if (!normalizedQuery) return state.ingredients
    return state.ingredients.filter((ingredient) =>
      normalizeForSearch(ingredient.name).includes(normalizedQuery),
    )
  }, [state, query])

  async function handleTogglePresence(id: string, present: boolean) {
    if (state.status !== 'ready') return
    const previous = state.ingredients
    setToggleError(null)
    setState({
      status: 'ready',
      ingredients: previous.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, present } : ingredient,
      ),
    })
    try {
      await updateIngredientPresence(id, present)
    } catch (err) {
      setState({ status: 'ready', ingredients: previous })
      setToggleError(
        err instanceof IngredientsError ? err.message : "La mise à jour de l'ingrédient a échoué.",
      )
    }
  }

  if (state.status === 'loading') {
    return <p className="text-sm text-muted-foreground">Chargement du stock…</p>
  }

  if (state.status === 'error') {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.message}
      </p>
    )
  }

  const isFiltered = query.trim().length > 0
  const hiddenCount = state.ingredients.length - filteredIngredients.length

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un ingrédient…"
          aria-label="Rechercher un ingrédient"
          className="h-11 w-full rounded-md border border-input bg-background pr-10 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {isFiltered && (
          <button
            type="button"
            aria-label="Effacer la recherche"
            onClick={() => setQuery('')}
            className="absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {toggleError && (
        <p role="alert" className="text-sm text-destructive">
          {toggleError}
        </p>
      )}

      {isFiltered && hiddenCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {hiddenCount} ingrédient{hiddenCount > 1 ? 's' : ''} masqué{hiddenCount > 1 ? 's' : ''} ·{' '}
          <button type="button" onClick={() => setQuery('')} className="underline underline-offset-2">
            effacer la recherche
          </button>
        </p>
      )}

      {filteredIngredients.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun ingrédient ne correspond à cette recherche.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredIngredients.map((ingredient) => (
            <IngredientCard
              key={ingredient.id}
              ingredient={ingredient}
              onTogglePresence={handleTogglePresence}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
