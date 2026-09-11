import { Fingerprint, KeyRound, LogIn } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { loginWithPasskey, NoPasskeyFoundError } from '@/lib/webauthn-login'

const STEPS = [
  { icon: Fingerprint, label: 'Cliquez sur le bouton de connexion' },
  { icon: KeyRound, label: 'Choisissez votre passkey enregistrée' },
  { icon: LogIn, label: "Vous voilà connecté, sans mot de passe" },
] as const

export function LoginPage() {
  const navigate = useNavigate()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    setIsPending(true)
    setError(null)

    try {
      await loginWithPasskey()
      navigate('/app')
    } catch (err) {
      setError(
        err instanceof NoPasskeyFoundError
          ? err.message
          : 'La connexion a échoué. Veuillez réessayer.',
      )
    } finally {
      setIsPending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col justify-center gap-10 p-6 md:flex-row md:items-center md:gap-16 md:p-12">
      <div className="flex flex-col items-start gap-6 rounded-xl bg-present/10 p-6 md:w-1/2">
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Comment ça marche
        </h1>
        <ol className="flex flex-col gap-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            return (
              <li key={step.label} className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-present text-present-foreground"
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium">
                  {index + 1}. {step.label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="flex flex-col items-start gap-4 md:w-1/2">
        <h2 className="font-display text-2xl font-bold">Se connecter</h2>
        <p className="text-muted-foreground">
          Utilisez la passkey enregistrée sur cet appareil, aucun mot de passe n'est nécessaire.
        </p>
        <Button size="lg" onClick={handleLogin} disabled={isPending}>
          {isPending ? 'Connexion en cours…' : 'Se connecter avec une passkey'}
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
