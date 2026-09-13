import { registerHouseholdOwner } from '@/lib/webauthn-register'

export class CreateHouseholdError extends Error {}

export type CreateHouseholdResult = {
  householdId: string
  invitationToken: string
  invitationExpiresAt: string
}

async function bootstrapHousehold(
  name: string,
  displayName: string,
): Promise<{ userId: string; householdId: string; enrollmentToken: string }> {
  const response = await fetch('/households', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, displayName }),
  })

  if (!response.ok) {
    throw new CreateHouseholdError('La création du foyer a échoué. Veuillez réessayer.')
  }

  return response.json()
}

async function createInvitationForOwnHousehold(): Promise<{ token: string; expiresAt: string }> {
  const response = await fetch('/households/invitations', {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new CreateHouseholdError("La génération du lien d'invitation a échoué. Veuillez réessayer.")
  }

  return response.json()
}

export async function createHousehold(
  name: string,
  displayName: string,
): Promise<CreateHouseholdResult> {
  const { householdId, enrollmentToken } = await bootstrapHousehold(name, displayName)

  await registerHouseholdOwner(enrollmentToken, displayName)

  const { token, expiresAt } = await createInvitationForOwnHousehold()

  return { householdId, invitationToken: token, invitationExpiresAt: expiresAt }
}
