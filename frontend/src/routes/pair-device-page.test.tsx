import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DeviceLinkExpiredError,
  RegistrationCancelledError,
  registerDeviceWithPasskey,
} from '@/lib/webauthn-register'

import { PairDevicePage } from './pair-device-page'

vi.mock('@/lib/webauthn-register', async () => {
  const actual = await vi.importActual<typeof import('@/lib/webauthn-register')>(
    '@/lib/webauthn-register',
  )
  return { ...actual, registerDeviceWithPasskey: vi.fn() }
})

const registerDeviceWithPasskeyMock = vi.mocked(registerDeviceWithPasskey)

function renderPairDevicePage(token = 'tok-123') {
  render(
    <MemoryRouter initialEntries={[`/appareils/associer/${token}`]}>
      <Routes>
        <Route path="/appareils/associer/:token" element={<PairDevicePage />} />
        <Route path="/app" element={<div>Écran principal</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PairDevicePage', () => {
  beforeEach(() => {
    registerDeviceWithPasskeyMock.mockReset()
  })

  it('désactive le bouton de création tant que le nom est vide puis crée la passkey de cet appareil', async () => {
    registerDeviceWithPasskeyMock.mockResolvedValue({ userId: 'u1', householdId: 'h1' })
    renderPairDevicePage()

    const button = screen.getByRole('button', { name: /créer ma passkey/i })
    expect(button).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/nom de cet appareil/i), 'iPhone de Sam')
    expect(button).toBeEnabled()

    await userEvent.click(button)

    expect(registerDeviceWithPasskeyMock).toHaveBeenCalledWith('tok-123', 'iPhone de Sam')
    await waitFor(() => expect(screen.getByText('Écran principal')).toBeInTheDocument())
  })

  it("affiche un état d'erreur explicite si le lien a expiré", async () => {
    registerDeviceWithPasskeyMock.mockRejectedValue(
      new DeviceLinkExpiredError("Ce jeton d'appairage a expiré ou est invalide."),
    )
    renderPairDevicePage()

    await userEvent.type(screen.getByLabelText(/nom de cet appareil/i), 'iPhone de Sam')
    await userEvent.click(screen.getByRole('button', { name: /créer ma passkey/i }))

    expect(await screen.findByText("Lien d'appairage invalide")).toBeInTheDocument()
  })

  it("gère l'annulation de la cérémonie WebAuthn par l'utilisateur", async () => {
    registerDeviceWithPasskeyMock.mockRejectedValue(
      new RegistrationCancelledError('La création de la passkey a été annulée.'),
    )
    renderPairDevicePage()

    await userEvent.type(screen.getByLabelText(/nom de cet appareil/i), 'iPhone de Sam')
    await userEvent.click(screen.getByRole('button', { name: /créer ma passkey/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La création de la passkey a été annulée.',
    )
  })

  it('affiche un état expiré si aucun jeton n\'est présent dans l\'URL', async () => {
    render(
      <MemoryRouter initialEntries={['/appareils/associer/']}>
        <Routes>
          <Route path="/appareils/associer/:token?" element={<PairDevicePage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText("Lien d'appairage invalide")).toBeInTheDocument()
  })
})
