import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchCookingModes } from '@/lib/cooking-modes'
import { HouseholdError, fetchHousehold, fetchHouseholdPreferences } from '@/lib/household'
import { fetchIngredients } from '@/lib/ingredients'

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

vi.mock('@/lib/ingredients', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ingredients')>('@/lib/ingredients')
  return {
    ...actual,
    fetchIngredients: vi.fn(),
    updateIngredientPresence: vi.fn(),
  }
})

vi.mock('@/lib/cooking-modes', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cooking-modes')>('@/lib/cooking-modes')
  return {
    ...actual,
    fetchCookingModes: vi.fn(),
    updateCookingModePresence: vi.fn(),
    createCookingMode: vi.fn(),
  }
})

const fetchHouseholdMock = vi.mocked(fetchHousehold)
const fetchHouseholdPreferencesMock = vi.mocked(fetchHouseholdPreferences)
const fetchIngredientsMock = vi.mocked(fetchIngredients)
const fetchCookingModesMock = vi.mocked(fetchCookingModes)

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
    fetchIngredientsMock.mockReset()
    fetchIngredientsMock.mockResolvedValue([])
    fetchCookingModesMock.mockReset()
    fetchCookingModesMock.mockResolvedValue([])
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

  it('affiche le stock une fois le foyer chargé', async () => {
    fetchHouseholdMock.mockResolvedValue({ householdId: 'h1', name: 'Foyer Dupont' })
    fetchIngredientsMock.mockResolvedValue([
      { id: '1', name: 'farine', present: true, storage: 'placard' },
    ])
    renderAppHomePage()

    await screen.findByRole('heading', { name: 'Foyer Dupont' })
    expect(await screen.findByText('farine')).toBeInTheDocument()
  })

  it('affiche les modes de cuisson une fois le foyer chargé', async () => {
    fetchHouseholdMock.mockResolvedValue({ householdId: 'h1', name: 'Foyer Dupont' })
    fetchCookingModesMock.mockResolvedValue([{ id: '1', name: 'casserole', present: true }])
    renderAppHomePage()

    await screen.findByRole('heading', { name: 'Foyer Dupont' })
    expect(await screen.findByText('casserole')).toBeInTheDocument()
  })
})
