import { Fingerprint, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  InvitationExpiredError,
  RegistrationCancelledError,
  fetchInvitationPreview,
  registerWithPasskey,
  type InvitationPreview,
} from '@/lib/webauthn-register'

type PreviewState =
  | { status: 'loading' }
  | { status: 'ready'; preview: InvitationPreview }
  | { status: 'expired' }
  | { status: 'error' }

export function JoinHouseholdPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [previewState, setPreviewState] = useState<PreviewState>({ status: 'loading' })
  const [displayName, setDisplayName] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setPreviewState({ status: 'expired' })
      return
    }

    fetchInvitationPreview(token)
      .then((preview) => setPreviewState({ status: 'ready', preview }))
      .catch((err) =>
        setPreviewState({ status: err instanceof InvitationExpiredError ? 'expired' : 'error' }),
      )
  }, [token])

  async function handleCreatePasskey() {
    if (!token) return

    setIsPending(true)
    setError(null)

    try {
      await registerWithPasskey(token, displayName)
      navigate('/app')
    } catch (err) {
      if (err instanceof InvitationExpiredError) {
        setPreviewState({ status: 'expired' })
      } else {
        setError(
          err instanceof RegistrationCancelledError
            ? err.message
            : "La création de la passkey a échoué. Veuillez réessayer.",
        )
      }
    } finally {
      setIsPending(false)
    }
  }

  if (previewState.status === 'loading') {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-start justify-center gap-4 p-6">
        <p className="text-muted-foreground">Chargement de l'invitation…</p>
      </main>
    )
  }

  if (previewState.status === 'expired') {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-start justify-center gap-4 p-6">
        <h1 className="font-display text-2xl font-bold">Invitation invalide</h1>
        <p role="alert" className="text-sm text-destructive">
          Cette invitation a expiré ou est invalide.
        </p>
      </main>
    )
  }

  if (previewState.status === 'error') {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-start justify-center gap-4 p-6">
        <h1 className="font-display text-2xl font-bold">Une erreur est survenue</h1>
        <p role="alert" className="text-sm text-destructive">
          Impossible de charger cette invitation. Veuillez réessayer.
        </p>
      </main>
    )
  }

  const { householdName, memberCount } = previewState.preview

  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col justify-center gap-10 p-6 md:flex-row md:items-center md:gap-16 md:p-12">
      <div className="flex flex-col items-start gap-6 rounded-xl bg-present/10 p-6 md:w-1/2">
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Rejoindre {householdName}
        </h1>
        <p className="text-muted-foreground">
          {memberCount === 1
            ? '1 membre déjà dans ce foyer.'
            : `${memberCount} membres déjà dans ce foyer.`}
        </p>
      </div>

      <div className="flex flex-col items-start gap-4 md:w-1/2">
        <h2 className="font-display text-2xl font-bold">Créer votre passkey</h2>
        <label htmlFor="display-name" className="text-sm font-medium">
          Nom d'affichage <span aria-hidden="true">*</span>
        </label>
        <input
          id="display-name"
          type="text"
          required
          aria-required="true"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Votre nom"
        />
        <Button
          size="lg"
          onClick={handleCreatePasskey}
          disabled={isPending || displayName.trim().length === 0}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <Fingerprint className="mr-2 h-5 w-5" aria-hidden="true" />
          )}
          {isPending ? 'Création en cours…' : 'Créer ma passkey'}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
