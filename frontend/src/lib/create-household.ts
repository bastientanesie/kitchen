export class CreateHouseholdError extends Error {}

export type CreateHouseholdResult = {
  householdId: string
  invitationToken: string
  invitationExpiresAt: string
}

export async function createHousehold(name: string): Promise<CreateHouseholdResult> {
  const response = await fetch('/households/mine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name }),
  })

  if (response.status === 409) {
    throw new CreateHouseholdError(
      'Vous ne pouvez pas créer un nouveau foyer tant que d\'autres membres font partie du vôtre.',
    )
  }
  if (!response.ok) {
    throw new CreateHouseholdError('La création du foyer a échoué. Veuillez réessayer.')
  }

  return response.json()
}

export function invitationUrl(token: string): string {
  return `${window.location.origin}/rejoindre/${token}`
}
