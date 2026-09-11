import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CreateHouseholdError, createHousehold } from '@/lib/create-household'

import { AppHomePage } from './app-home-page'

vi.mock('@/lib/create-household', async () => {
  const actual = await vi.importActual<typeof import('@/lib/create-household')>(
    '@/lib/create-household',
  )
  return { ...actual, createHousehold: vi.fn() }
})

const createHouseholdMock = vi.mocked(createHousehold)

function renderAppHomePage() {
  render(
    <MemoryRouter>
      <AppHomePage />
    </MemoryRouter>,
  )
}

describe('AppHomePage', () => {
  beforeEach(() => {
    createHouseholdMock.mockReset()
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it("affiche l'état vide avec le formulaire de création de foyer", () => {
    renderAppHomePage()

    expect(screen.getByRole('heading', { name: /bienvenue dans kitchen/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/nom du foyer/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /créer mon foyer/i })).toBeDisabled()
  })

  it('crée le foyer via le backend et affiche l\'état de succès avec le lien copiable', async () => {
    createHouseholdMock.mockResolvedValue({
      householdId: 'h1',
      invitationToken: 'tok123',
      invitationExpiresAt: new Date().toISOString(),
    })
    renderAppHomePage()

    await userEvent.type(screen.getByLabelText(/nom du foyer/i), 'Foyer Dupont')
    await userEvent.click(screen.getByRole('button', { name: /créer mon foyer/i }))

    expect(createHouseholdMock).toHaveBeenCalledWith('Foyer Dupont')
    expect(await screen.findByRole('heading', { name: /foyer créé/i })).toBeInTheDocument()

    const linkInput = screen.getByLabelText(/^lien d'invitation$/i) as HTMLInputElement
    expect(linkInput.value).toContain('/rejoindre/tok123')

    await userEvent.click(screen.getByRole('button', { name: /copier le lien d'invitation/i }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(linkInput.value)
    expect(await screen.findByRole('status')).toHaveTextContent('Lien copié !')
  })

  it("affiche un message d'erreur si la création du foyer échoue", async () => {
    createHouseholdMock.mockRejectedValue(new CreateHouseholdError('La création du foyer a échoué. Veuillez réessayer.'))
    renderAppHomePage()

    await userEvent.type(screen.getByLabelText(/nom du foyer/i), 'Foyer Dupont')
    await userEvent.click(screen.getByRole('button', { name: /créer mon foyer/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La création du foyer a échoué')
  })
})
