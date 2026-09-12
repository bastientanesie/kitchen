import { QRCodeSVG } from 'qrcode.react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { CountdownRing } from '@/components/countdown-ring'
import {
  DevicePairingError,
  createDeviceLinkToken,
  subscribeToDeviceLinkEvents,
} from '@/lib/device-pairing'

type Phase =
  | { status: 'loading' }
  | { status: 'active'; code: string; link: string; expiresAt: string; totalMs: number }
  | { status: 'expired' }
  | { status: 'paired'; deviceName: string }
  | { status: 'error'; message: string }

export function AddDeviceSheet() {
  const [phase, setPhase] = useState<Phase>({ status: 'loading' })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    generateToken()
  }, [])

  const activeCode = phase.status === 'active' ? phase.code : null

  useEffect(() => {
    if (!activeCode) return
    return subscribeToDeviceLinkEvents(activeCode, (event) => {
      if (event.kind === 'paired') {
        setPhase({ status: 'paired', deviceName: event.deviceName })
      } else {
        setPhase({ status: 'expired' })
      }
    })
  }, [activeCode])

  async function generateToken() {
    setPhase({ status: 'loading' })
    try {
      const { code, link, expiresAt } = await createDeviceLinkToken()
      setPhase({ status: 'active', code, link, expiresAt, totalMs: Date.parse(expiresAt) - Date.now() })
    } catch (err) {
      setPhase({
        status: 'error',
        message: err instanceof DevicePairingError ? err.message : 'Une erreur est survenue.',
      })
    }
  }

  async function handleCopy(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // La copie automatique a échoué : le lien reste affiché pour une copie manuelle.
    }
  }

  if (phase.status === 'loading') {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Génération du code d'appairage…
      </p>
    )
  }

  if (phase.status === 'error') {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="text-sm text-destructive">
          {phase.message}
        </p>
        <Button type="button" onClick={generateToken}>
          Réessayer
        </Button>
      </div>
    )
  }

  if (phase.status === 'expired') {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="text-sm text-destructive">
          Ce code a expiré.
        </p>
        <Button type="button" onClick={generateToken}>
          Générer un nouveau code
        </Button>
      </div>
    )
  }

  if (phase.status === 'paired') {
    return (
      <p role="status" className="text-sm font-medium">
        « {phase.deviceName} » a été associé avec succès.
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <div className="rounded-lg border border-border bg-white p-2">
          <QRCodeSVG value={phase.link} size={128} />
        </div>
        <CountdownRing
          expiresAt={phase.expiresAt}
          totalMs={phase.totalMs}
          onExpire={() => setPhase({ status: 'expired' })}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Scannez le QR code, ou saisissez ce code sur le nouvel appareil :
      </p>
      <p className="text-2xl font-bold tracking-widest tabular-nums">{phase.code}</p>

      <div className="flex w-full items-center gap-2">
        <input
          readOnly
          value={phase.link}
          aria-label="Lien d'appairage"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          onFocus={(event) => event.target.select()}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Copier le lien d'appairage"
          onClick={() => handleCopy(phase.link)}
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </div>
  )
}
