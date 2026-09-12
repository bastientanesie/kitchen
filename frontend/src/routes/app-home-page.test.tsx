import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HouseholdError, fetchHousehold, fetchHouseholdPreferences } from '@/lib/household'

import { AppHomePage } from './app-home-page'

vi.mock('@/lib/household', async () => {
  const actual = await vi.importActual<typeof import('@/lib/household')>('@/lib/household')
  return {
    ...actual,
    fetchHousehold: vi.fn(),
    fetchHouseholdPreferences: vi.fn(),
    createInvitation: vi.fn(),
    updateHouseholdPreferences: vi.fn(),
  }
})

const fetchHouseholdMock = vi.mocked(fetchHousehold)
const fetchHouseholdPreferencesMock = vi.mocked(fetchHouseholdPreferences)

function renderAppHomePage() {
  render(
    <MemoryRouter>
      <AppHomePage />
    </MemoryRouter>,
  )
}

describe('AppHomePage', () => {
  beforeEach(() => {
    fetchHouseholdMock.mockReset()
    fetchHouseholdPreferencesMock.mockReset()
    fetchHouseholdPreferencesMock.mockResolvedValue(null)
  })

  it('affiche le nom du foyer une fois chargé', async () => {
    fetchHouseholdMock.mockResolvedValue({ householdId: 'h1', name: 'Foyer Dupont' })
    renderAppHomePage()

    expect(await screen.findByRole('heading', { name: 'Foyer Dupont' })).toBeInTheDocument()
  })

  it('affiche une erreur si la récupération du foyer échoue', async () => {
    fetchHouseholdMock.mockRejectedValue(new HouseholdError('Impossible de récupérer les informations du foyer.'))
    renderAppHomePage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de récupérer les informations du foyer.',
    )
  })

  it('ouvre le drawer via le bouton menu et le referme avec Escape', async () => {
    fetchHouseholdMock.mockResolvedValue({ householdId: 'h1', name: 'Foyer Dupont' })
    renderAppHomePage()

    await screen.findByRole('heading', { name: 'Foyer Dupont' })

    await userEvent.click(screen.getByRole('button', { name: /ouvrir le menu/i }))
    expect(await screen.findByRole('dialog', { name: /menu/i })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /menu/i })).not.toBeInTheDocument()
  })
})
