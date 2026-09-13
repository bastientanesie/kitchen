import { invitationUrl } from '@/lib/invitation'

export class HouseholdError extends Error {}

export type HouseholdSummary = {
  householdId: string
  name: string
}

async function parseHouseholdResponse<T>(response: Response, failureMessage: string): Promise<T> {
  if (!response.ok) throw new HouseholdError(failureMessage)
  return response.json()
}

export async function fetchHousehold(): Promise<HouseholdSummary> {
  const response = await fetch('/households/mine', { credentials: 'include' })
  return parseHouseholdResponse(response, 'Impossible de récupérer les informations du foyer.')
}

export async function createInvitation(): Promise<string> {
  const response = await fetch('/households/invitations', {
    method: 'POST',
    credentials: 'include',
  })
  const { token } = await parseHouseholdResponse<{ token: string }>(
    response,
    "La génération du lien d'invitation a échoué. Veuillez réessayer.",
  )
  return invitationUrl(token)
}

export async function fetchHouseholdPreferences(): Promise<string | null> {
  const response = await fetch('/households/me/preferences', { credentials: 'include' })
  const { preferences } = await parseHouseholdResponse<{ preferences: string | null }>(
    response,
    'Impossible de récupérer les préférences du foyer.',
  )
  return preferences
}

export async function updateHouseholdPreferences(preferences: string): Promise<string | null> {
  const response = await fetch('/households/me/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ preferences }),
  })
  const { preferences: saved } = await parseHouseholdResponse<{ preferences: string | null }>(
    response,
    'La mise à jour des préférences a échoué. Veuillez réessayer.',
  )
  return saved
}
