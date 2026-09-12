export class DevicePairingError extends Error {}

export type DeviceLinkToken = {
  code: string
  link: string
  expiresAt: string
}

export function deviceLinkUrl(code: string): string {
  return `${window.location.origin}/appareils/associer/${code}`
}

export async function createDeviceLinkToken(): Promise<DeviceLinkToken> {
  const response = await fetch('/device-pairing/tokens', {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    throw new DevicePairingError("La génération du code d'appairage a échoué. Veuillez réessayer.")
  }
  const { code, expiresAt } = (await response.json()) as { code: string; expiresAt: string }
  return { code, link: deviceLinkUrl(code), expiresAt }
}

export type DeviceLinkEvent =
  | { kind: 'paired'; deviceName: string }
  | { kind: 'expired' }

export function subscribeToDeviceLinkEvents(
  code: string,
  onEvent: (event: DeviceLinkEvent) => void,
): () => void {
  const source = new EventSource(`/device-pairing/tokens/${code}/events`, {
    withCredentials: true,
  })

  source.addEventListener('paired', (event) => {
    const { deviceName } = JSON.parse((event as MessageEvent).data)
    onEvent({ kind: 'paired', deviceName })
  })

  source.addEventListener('expired', () => {
    onEvent({ kind: 'expired' })
  })

  return () => source.close()
}
