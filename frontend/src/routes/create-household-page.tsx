import { Check, Copy, Loader2, PlusCircle } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { CreateHouseholdError, createHousehold, invitationUrl } from '@/lib/create-household'

type CreateState =
  | { status: 'idle' }
  | { status: 'success'; link: string }

export function CreateHouseholdPage() {
  const [name, setName] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createState, setCreateState] = useState<CreateState>({ status: 'idle' })
  const [copied, setCopied] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsPending(true)
    setError(null)

    try {
      const result = await createHousehold(name.trim())
      setCreateState({ status: 'success', link: invitationUrl(result.invitationToken) })
    } catch (err) {
      setError(
        err instanceof CreateHouseholdError
          ? err.message
          : 'La création du foyer a échoué. Veuillez réessayer.',
      )
    } finally {
      setIsPending(false)
    }
  }

  async function handleCopy(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Impossible de copier le lien. Copiez-le manuellement.')
    }
  }

  if (createState.status === 'success') {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-start justify-center gap-4 p-6">
        <h1 className="font-display text-2xl font-bold">Foyer créé !</h1>
        <p className="text-muted-foreground">
          Partagez ce lien pour inviter les membres de votre foyer.
        </p>
        <div className="flex w-full items-center gap-2">
          <input
            readOnly
            value={createState.link}
            aria-label="Lien d'invitation"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            onFocus={(event) => event.target.select()}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Copier le lien d'invitation"
            onClick={() => handleCopy(createState.link)}
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
        {copied && (
          <p role="status" className="text-sm text-muted-foreground">
            Lien copié !
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-start justify-center gap-4 p-6">
      <h1 className="font-display text-2xl font-bold">Bienvenue dans Kitchen</h1>
      <p className="text-muted-foreground">
        Vous n'avez pas encore de foyer. Créez-en un pour commencer.
      </p>
      <form onSubmit={handleSubmit} className="flex w-full flex-col items-start gap-4">
        <label htmlFor="household-name" className="text-sm font-medium">
          Nom du foyer <span aria-hidden="true">*</span>
        </label>
        <input
          id="household-name"
          type="text"
          required
          aria-required="true"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Ex : Foyer Dupont"
        />
        <Button type="submit" size="lg" disabled={isPending || name.trim().length === 0}>
          {isPending ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <PlusCircle className="mr-2 h-5 w-5" aria-hidden="true" />
          )}
          {isPending ? 'Création en cours…' : 'Créer mon foyer'}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </main>
  )
}
