import { startAuthentication } from '@simplewebauthn/browser'
import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'

export class NoPasskeyFoundError extends Error {}

export type LoginResult = {
  userId: string
  householdId: string
}

async function fetchLoginOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const response = await fetch('/webauthn/login/options', { method: 'POST' })
  if (!response.ok) throw new Error('Impossible de récupérer les options de connexion')
  return response.json()
}

async function verifyLogin(credential: AuthenticationResponseJSON): Promise<LoginResult> {
  const response = await fetch('/webauthn/login/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ credential }),
  })
  if (!response.ok) throw new Error('Échec de la vérification de connexion')
  return response.json()
}

export async function loginWithPasskey(): Promise<LoginResult> {
  const optionsJSON = await fetchLoginOptions()

  let credential: AuthenticationResponseJSON
  try {
    credential = await startAuthentication({ optionsJSON })
  } catch (error) {
    if (error instanceof Error && error.name === 'NotAllowedError') {
      throw new NoPasskeyFoundError("Aucune passkey n'a été trouvée sur cet appareil.")
    }
    throw error
  }

  return verifyLogin(credential)
}
