import { Fingerprint, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  DeviceLinkExpiredError,
  RegistrationCancelledError,
  registerDeviceWithPasskey,
} from '@/lib/webauthn-register'

type PageState = { status: 'form' } | { status: 'expired' }

export function PairDevicePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [pageState, setPageState] = useState<PageState>(
    token ? { status: 'form' } : { status: 'expired' },
  )
  const [deviceName, setDeviceName] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreatePasskey() {
    if (!token) return

    setIsPending(true)
    setError(null)

    try {
      await registerDeviceWithPasskey(token, deviceName)
      navigate('/app')
    } catch (err) {
      if (err instanceof DeviceLinkExpiredError) {
        setPageState({ status: 'expired' })
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

  if (pageState.status === 'expired') {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-start justify-center gap-4 p-6">
        <h1 className="font-display text-2xl font-bold">Lien d'appairage invalide</h1>
        <p role="alert" className="text-sm text-destructive">
          Ce lien a expiré ou est invalide. Générez un nouveau code depuis votre appareil déjà associé.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-start justify-center gap-6 p-6">
      <h1 className="font-display text-2xl font-bold">Associer cet appareil</h1>
      <p className="text-muted-foreground">
        Donnez un nom à cet appareil, puis créez sa passkey pour terminer l'appairage.
      </p>
      <label htmlFor="device-name" className="text-sm font-medium">
        Nom de cet appareil <span aria-hidden="true">*</span>
      </label>
      <input
        id="device-name"
        type="text"
        required
        aria-required="true"
        value={deviceName}
        onChange={(event) => setDeviceName(event.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        placeholder="iPhone de Bastien"
      />
      <Button
        size="lg"
        onClick={handleCreatePasskey}
        disabled={isPending || deviceName.trim().length === 0}
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
    </main>
  )
}
