import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  InvitationExpiredError,
  RegistrationCancelledError,
  fetchInvitationPreview,
  registerWithPasskey,
} from '@/lib/webauthn-register'

import { JoinHouseholdPage } from './join-household-page'

vi.mock('@/lib/webauthn-register', async () => {
  const actual = await vi.importActual<typeof import('@/lib/webauthn-register')>(
    '@/lib/webauthn-register',
  )
  return { ...actual, fetchInvitationPreview: vi.fn(), registerWithPasskey: vi.fn() }
})

const fetchInvitationPreviewMock = vi.mocked(fetchInvitationPreview)
const registerWithPasskeyMock = vi.mocked(registerWithPasskey)

function renderJoinHouseholdPage(token = 'tok-123') {
  render(
    <MemoryRouter initialEntries={[`/rejoindre/${token}`]}>
      <Routes>
        <Route path="/rejoindre/:token" element={<JoinHouseholdPage />} />
        <Route path="/app" element={<div>Écran principal</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('JoinHouseholdPage', () => {
  beforeEach(() => {
    fetchInvitationPreviewMock.mockReset()
    registerWithPasskeyMock.mockReset()
  })

  it("affiche le nom du foyer et le nombre de membres à partir de l'invitation", async () => {
    fetchInvitationPreviewMock.mockResolvedValue({ householdName: 'Foyer Dupont', memberCount: 3 })
    renderJoinHouseholdPage()

    expect(await screen.findByText(/rejoindre foyer dupont/i)).toBeInTheDocument()
    expect(screen.getByText('3 membres déjà dans ce foyer.')).toBeInTheDocument()
  })

  it('désactive le bouton de création tant que le nom est vide puis le déclenche', async () => {
    fetchInvitationPreviewMock.mockResolvedValue({ householdName: 'Foyer Dupont', memberCount: 1 })
    registerWithPasskeyMock.mockResolvedValue({ userId: 'u1', householdId: 'h1' })
    renderJoinHouseholdPage()

    const button = await screen.findByRole('button', { name: /créer ma passkey/i })
    expect(button).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/nom d'affichage/i), 'Sam')
    expect(button).toBeEnabled()

    await userEvent.click(button)

    expect(registerWithPasskeyMock).toHaveBeenCalledWith('tok-123', 'Sam')
    await waitFor(() => expect(screen.getByText('Écran principal')).toBeInTheDocument())
  })

  it("affiche une erreur générique si le chargement de l'invitation échoue pour une autre raison", async () => {
    fetchInvitationPreviewMock.mockRejectedValue(new Error('network down'))
    renderJoinHouseholdPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger cette invitation')
  })

  it("affiche un état d'erreur explicite si l'invitation a expiré", async () => {
    fetchInvitationPreviewMock.mockRejectedValue(
      new InvitationExpiredError('Cette invitation a expiré ou est invalide.'),
    )
    renderJoinHouseholdPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cette invitation a expiré ou est invalide.',
    )
  })

  it("gère l'annulation de la cérémonie WebAuthn par l'utilisateur", async () => {
    fetchInvitationPreviewMock.mockResolvedValue({ householdName: 'Foyer Dupont', memberCount: 1 })
    registerWithPasskeyMock.mockRejectedValue(
      new RegistrationCancelledError('La création de la passkey a été annulée.'),
    )
    renderJoinHouseholdPage()

    await userEvent.type(await screen.findByLabelText(/nom d'affichage/i), 'Sam')
    await userEvent.click(screen.getByRole('button', { name: /créer ma passkey/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La création de la passkey a été annulée.',
    )
  })

  it('affiche un message générique pour toute autre erreur de création', async () => {
    fetchInvitationPreviewMock.mockResolvedValue({ householdName: 'Foyer Dupont', memberCount: 1 })
    registerWithPasskeyMock.mockRejectedValue(new Error('boom'))
    renderJoinHouseholdPage()

    await userEvent.type(await screen.findByLabelText(/nom d'affichage/i), 'Sam')
    await userEvent.click(screen.getByRole('button', { name: /créer ma passkey/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La création de la passkey a échoué')
  })

  it("bascule vers l'état d'invitation expirée si l'invitation expire pendant la création", async () => {
    fetchInvitationPreviewMock.mockResolvedValue({ householdName: 'Foyer Dupont', memberCount: 1 })
    registerWithPasskeyMock.mockRejectedValue(
      new InvitationExpiredError('Cette invitation a expiré ou est invalide.'),
    )
    renderJoinHouseholdPage()

    await userEvent.type(await screen.findByLabelText(/nom d'affichage/i), 'Sam')
    await userEvent.click(screen.getByRole('button', { name: /créer ma passkey/i }))

    expect(await screen.findByText('Invitation invalide')).toBeInTheDocument()
  })
})
