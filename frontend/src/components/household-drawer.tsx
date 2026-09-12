import * as Dialog from '@radix-ui/react-dialog'
import { Check, Copy, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  HouseholdError,
  createInvitation,
  fetchHouseholdPreferences,
  updateHouseholdPreferences,
} from '@/lib/household'

type InvitationState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'ready'; link: string }
  | { status: 'error'; message: string }

type PreferencesState =
  | { status: 'loading' }
  | { status: 'ready'; value: string }
  | { status: 'error'; message: string }

export function HouseholdDrawer({
  open,
  onOpenChange,
  householdName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdName: string
}) {
  const [invitation, setInvitation] = useState<InvitationState>({ status: 'idle' })
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<PreferencesState>({ status: 'loading' })
  const [isSavingPreferences, setIsSavingPreferences] = useState(false)
  const savedPreferencesRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setPreferences({ status: 'loading' })
    fetchHouseholdPreferences()
      .then((value) => {
        if (!cancelled) {
          savedPreferencesRef.current = value ?? ''
          setPreferences({ status: 'ready', value: value ?? '' })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreferences({ status: 'error', message: 'Impossible de charger les préférences.' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [open])

  async function handleGenerateInvitation() {
    setInvitation({ status: 'pending' })
    try {
      const link = await createInvitation()
      setInvitation({ status: 'ready', link })
    } catch (err) {
      setInvitation({
        status: 'error',
        message: err instanceof HouseholdError ? err.message : "La génération du lien a échoué.",
      })
    }
  }

  async function handleCopy(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopyError(null)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError('Impossible de copier le lien. Copiez-le manuellement.')
    }
  }

  async function savePreferencesIfChanged(value: string) {
    if (value === savedPreferencesRef.current) return
    setIsSavingPreferences(true)
    try {
      const saved = await updateHouseholdPreferences(value)
      savedPreferencesRef.current = saved ?? ''
      setPreferences({ status: 'ready', value: saved ?? '' })
    } catch {
      setPreferences({ status: 'error', message: 'La sauvegarde des préférences a échoué.' })
    } finally {
      setIsSavingPreferences(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && preferences.status === 'ready') {
      void savePreferencesIfChanged(preferences.value)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 flex w-full max-w-sm flex-col gap-6 overflow-y-auto bg-background p-6 shadow-lg"
          aria-label="Menu"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-display text-xl font-bold">Menu</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fermer le menu">
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">Thème</h2>
            <ThemeToggle />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Foyer</h2>
            <p className="font-medium">{householdName}</p>

            {invitation.status === 'ready' ? (
              <div className="flex w-full items-center gap-2">
                <input
                  readOnly
                  value={invitation.link}
                  aria-label="Lien d'invitation"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  onFocus={(event) => event.target.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Copier le lien d'invitation"
                  onClick={() => handleCopy(invitation.link)}
                >
                  {copied ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateInvitation}
                disabled={invitation.status === 'pending'}
              >
                {invitation.status === 'pending' && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Générer un lien d'invitation
              </Button>
            )}
            {invitation.status === 'error' && (
              <p role="alert" className="text-sm text-destructive">
                {invitation.message}
              </p>
            )}
            {copyError && (
              <p role="alert" className="text-sm text-destructive">
                {copyError}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <label htmlFor="household-preferences" className="text-sm font-medium text-muted-foreground">
              Préférences du foyer
            </label>
            {preferences.status === 'loading' ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : (
              <textarea
                id="household-preferences"
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={preferences.status === 'ready' ? preferences.value : ''}
                onChange={(event) =>
                  setPreferences({ status: 'ready', value: event.target.value })
                }
                onBlur={(event) => savePreferencesIfChanged(event.target.value)}
                placeholder="Allergies, régimes, habitudes du foyer…"
              />
            )}
            {isSavingPreferences && (
              <p className="text-sm text-muted-foreground">Enregistrement…</p>
            )}
            {preferences.status === 'error' && (
              <p role="alert" className="text-sm text-destructive">
                {preferences.message}
              </p>
            )}
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
