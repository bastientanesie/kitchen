import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import { CookingModeCard } from '@/components/cooking-mode-card'
import {
  CookingModesError,
  createCookingMode,
  fetchCookingModes,
  updateCookingModePresence,
  type CookingMode,
} from '@/lib/cooking-modes'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; cookingModes: CookingMode[] }
  | { status: 'error'; message: string }

export function CookingModesSection() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [newName, setNewName] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchCookingModes()
      .then((cookingModes) => {
        if (!cancelled) setState({ status: 'ready', cookingModes })
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof CookingModesError ? err.message : 'Une erreur est survenue.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleTogglePresence(id: string, present: boolean) {
    if (state.status !== 'ready') return
    const previous = state.cookingModes
    setActionError(null)
    setState({
      status: 'ready',
      cookingModes: previous.map((cookingMode) =>
        cookingMode.id === id ? { ...cookingMode, present } : cookingMode,
      ),
    })
    try {
      await updateCookingModePresence(id, present)
    } catch (err) {
      setState({ status: 'ready', cookingModes: previous })
      setActionError(
        err instanceof CookingModesError ? err.message : 'La mise à jour du mode de cuisson a échoué.',
      )
    }
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    if (state.status !== 'ready') return
    const name = newName.trim()
    if (!name) return

    setActionError(null)
    setIsAdding(true)
    try {
      const created = await createCookingMode(name)
      setState({ status: 'ready', cookingModes: [...state.cookingModes, created] })
      setNewName('')
    } catch (err) {
      setActionError(
        err instanceof CookingModesError ? err.message : "L'ajout du mode de cuisson a échoué.",
      )
    } finally {
      setIsAdding(false)
    }
  }

  if (state.status === 'loading') {
    return <p className="text-sm text-muted-foreground">Chargement des modes de cuisson…</p>
  }

  if (state.status === 'error') {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.message}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}

      {state.cookingModes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun mode de cuisson pour le moment.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {state.cookingModes.map((cookingMode) => (
            <CookingModeCard
              key={cookingMode.id}
              cookingMode={cookingMode}
              onTogglePresence={handleTogglePresence}
            />
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Ajouter un mode de cuisson…"
          aria-label="Ajouter un mode de cuisson"
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <button
          type="submit"
          disabled={isAdding || !newName.trim()}
          aria-label="Ajouter"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
      </form>
    </div>
  )
}
