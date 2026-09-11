import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NoPasskeyFoundError, loginWithPasskey } from '@/lib/webauthn-login'

import { LoginPage } from './login-page'

vi.mock('@/lib/webauthn-login', async () => {
  const actual = await vi.importActual<typeof import('@/lib/webauthn-login')>(
    '@/lib/webauthn-login',
  )
  return { ...actual, loginWithPasskey: vi.fn() }
})

const loginWithPasskeyMock = vi.mocked(loginWithPasskey)

function renderLoginPage() {
  render(
    <MemoryRouter initialEntries={['/connexion']}>
      <Routes>
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/app" element={<div>Écran principal</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    loginWithPasskeyMock.mockReset()
  })

  it("déclenche la cérémonie WebAuthn et redirige vers l'écran principal", async () => {
    loginWithPasskeyMock.mockResolvedValue({ userId: 'u1', householdId: 'h1' })
    renderLoginPage()

    await userEvent.click(screen.getByRole('button', { name: /se connecter avec une passkey/i }))

    expect(loginWithPasskeyMock).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.getByText('Écran principal')).toBeInTheDocument())
  })

  it("affiche un message d'erreur explicite si aucune passkey n'est trouvée", async () => {
    loginWithPasskeyMock.mockRejectedValue(new NoPasskeyFoundError("Aucune passkey n'a été trouvée sur cet appareil."))
    renderLoginPage()

    await userEvent.click(screen.getByRole('button', { name: /se connecter avec une passkey/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Aucune passkey n'a été trouvée sur cet appareil.",
    )
  })

  it('affiche un message générique pour toute autre erreur de connexion', async () => {
    loginWithPasskeyMock.mockRejectedValue(new Error('boom'))
    renderLoginPage()

    await userEvent.click(screen.getByRole('button', { name: /se connecter avec une passkey/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La connexion a échoué')
  })
})
