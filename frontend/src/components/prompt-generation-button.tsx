import * as Dialog from '@radix-ui/react-dialog'
import { Check, Copy, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { fetchCookingModes } from '@/lib/cooking-modes'
import { fetchHouseholdPreferences } from '@/lib/household'
import { fetchIngredients } from '@/lib/ingredients'
import { buildRecipePrompt } from '@/lib/prompt'

const AI_ASSISTANTS = [
  { name: 'Claude', url: 'https://claude.ai' },
  { name: 'ChatGPT', url: 'https://chatgpt.com' },
  { name: 'Gemini', url: 'https://gemini.google.com' },
  { name: 'Perplexity', url: 'https://www.perplexity.ai' },
]

type PromptState =
  | { status: 'loading' }
  | { status: 'ready'; presentIngredients: string[]; activeCookingModes: string[]; preferences: string | null }
  | { status: 'error'; message: string }

export function PromptGenerationButton({ onEditPreferences }: { onEditPreferences: () => void }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<PromptState>({ status: 'loading' })
  const [instructions, setInstructions] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setState({ status: 'loading' })
    Promise.all([fetchIngredients(), fetchCookingModes(), fetchHouseholdPreferences()])
      .then(([ingredients, cookingModes, preferences]) => {
        if (cancelled) return
        setState({
          status: 'ready',
          presentIngredients: ingredients.filter((ingredient) => ingredient.present).map((ingredient) => ingredient.name),
          activeCookingModes: cookingModes.filter((mode) => mode.present).map((mode) => mode.name),
          preferences,
        })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: 'Impossible de préparer le prompt. Veuillez réessayer.' })
      })

    return () => {
      cancelled = true
    }
  }, [open])

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setInstructions('')
      setCopied(false)
      setCopyError(null)
    }
    setOpen(nextOpen)
  }

  async function handleCopy() {
    if (state.status !== 'ready') return
    const prompt = buildRecipePrompt({
      presentIngredients: state.presentIngredients,
      activeCookingModes: state.activeCookingModes,
      preferences: state.preferences,
      instructions,
    })
    try {
      await navigator.clipboard.writeText(prompt)
      setCopyError(null)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError('Impossible de copier le prompt. Copiez-le manuellement.')
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button type="button" size="lg" aria-label="Générer" className="fixed bottom-4 left-4 z-10 rounded-full shadow-lg">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          Générer
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl bg-background p-6 shadow-lg"
          aria-label="Générer des recettes"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-display text-lg font-bold">Générer des recettes</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fermer">
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          {state.status === 'loading' && <p className="text-sm text-muted-foreground">Préparation du prompt…</p>}
          {state.status === 'error' && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}

          {state.status === 'ready' && (
            <>
              <div className="flex flex-col gap-2">
                <label htmlFor="prompt-instructions" className="text-sm font-medium text-muted-foreground">
                  Instructions ponctuelles
                </label>
                <textarea
                  id="prompt-instructions"
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  placeholder="Ex. repas rapide ce soir, envie de légumes…"
                />
                <p className="text-xs text-muted-foreground">
                  Préférences du foyer prises en compte ·{' '}
                  <button type="button" onClick={onEditPreferences} className="underline">
                    modifier
                  </button>
                </p>
              </div>

              <Button type="button" onClick={handleCopy} className="w-full">
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                Copier le prompt
              </Button>
              {copyError && (
                <p role="alert" className="text-sm text-destructive">
                  {copyError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                {AI_ASSISTANTS.map((assistant) => (
                  <a
                    key={assistant.name}
                    href={assistant.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    {assistant.name}
                  </a>
                ))}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
