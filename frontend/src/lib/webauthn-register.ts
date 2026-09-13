import { startRegistration } from '@simplewebauthn/browser'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser'

export class RegistrationCancelledError extends Error {}

export class InvitationExpiredError extends Error {}

export class DeviceLinkExpiredError extends Error {}

export type InvitationPreview = {
  householdName: string
  memberCount: number
}

export type RegisterResult = {
  userId: string
  householdId: string
}

async function parseInvitationResponse<T>(response: Response, failureMessage: string): Promise<T> {
  if (response.status === 410) {
    throw new InvitationExpiredError('Cette invitation a expiré ou est invalide.')
  }
  if (!response.ok) throw new Error(failureMessage)
  return response.json()
}

export async function fetchInvitationPreview(token: string): Promise<InvitationPreview> {
  const response = await fetch(`/households/invitations/${token}`)
  return parseInvitationResponse(response, "Impossible de récupérer l'invitation")
}

async function fetchRegistrationOptions(
  invitationToken: string,
  displayName: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const response = await fetch('/auth/webauthn/register/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invitationToken, displayName }),
  })
  return parseInvitationResponse(response, "Impossible de récupérer les options d'inscription")
}

async function verifyRegistration(
  invitationToken: string,
  credential: RegistrationResponseJSON,
): Promise<RegisterResult> {
  const response = await fetch('/auth/webauthn/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ invitationToken, credential, deviceName: 'Cet appareil' }),
  })
  return parseInvitationResponse(response, "Échec de la vérification de l'inscription")
}

export async function registerWithPasskey(
  invitationToken: string,
  displayName: string,
): Promise<RegisterResult> {
  const optionsJSON = await fetchRegistrationOptions(invitationToken, displayName)

  const credential = await createCredential(optionsJSON)

  return verifyRegistration(invitationToken, credential)
}

async function createCredential(
  optionsJSON: PublicKeyCredentialCreationOptionsJSON,
): Promise<RegistrationResponseJSON> {
  try {
    return await startRegistration({ optionsJSON })
  } catch (error) {
    if (error instanceof Error && error.name === 'NotAllowedError') {
      throw new RegistrationCancelledError('La création de la passkey a été annulée.')
    }
    throw error
  }
}

async function fetchEnrollmentRegistrationOptions(
  enrollmentToken: string,
  displayName: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const response = await fetch('/auth/webauthn/register/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollmentToken, displayName }),
  })
  return parseInvitationResponse(response, "Impossible de récupérer les options d'inscription")
}

async function verifyEnrollmentRegistration(
  enrollmentToken: string,
  credential: RegistrationResponseJSON,
): Promise<RegisterResult> {
  const response = await fetch('/auth/webauthn/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ enrollmentToken, credential, deviceName: 'Cet appareil' }),
  })
  return parseInvitationResponse(response, "Échec de la vérification de l'inscription")
}

export async function registerHouseholdOwner(
  enrollmentToken: string,
  displayName: string,
): Promise<RegisterResult> {
  const optionsJSON = await fetchEnrollmentRegistrationOptions(enrollmentToken, displayName)

  const credential = await createCredential(optionsJSON)

  return verifyEnrollmentRegistration(enrollmentToken, credential)
}

async function parseDeviceLinkResponse<T>(response: Response, failureMessage: string): Promise<T> {
  if (response.status === 410) {
    throw new DeviceLinkExpiredError("Ce jeton d'appairage a expiré ou est invalide.")
  }
  if (!response.ok) throw new Error(failureMessage)
  return response.json()
}

async function fetchDeviceLinkRegistrationOptions(
  deviceLinkToken: string,
  deviceName: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const response = await fetch('/auth/webauthn/register/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceLinkToken, displayName: deviceName }),
  })
  return parseDeviceLinkResponse(response, "Impossible de récupérer les options d'inscription")
}

async function verifyDeviceLinkRegistration(
  deviceLinkToken: string,
  deviceName: string,
  credential: RegistrationResponseJSON,
): Promise<RegisterResult> {
  const response = await fetch('/auth/webauthn/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ deviceLinkToken, credential, deviceName }),
  })
  return parseDeviceLinkResponse(response, "Échec de la vérification de l'inscription")
}

export async function registerDeviceWithPasskey(
  deviceLinkToken: string,
  deviceName: string,
): Promise<RegisterResult> {
  const optionsJSON = await fetchDeviceLinkRegistrationOptions(deviceLinkToken, deviceName)

  const credential = await createCredential(optionsJSON)

  return verifyDeviceLinkRegistration(deviceLinkToken, deviceName, credential)
}
