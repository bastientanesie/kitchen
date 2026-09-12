import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CookingModesError,
  createCookingMode,
  fetchCookingModes,
  updateCookingModePresence,
} from '@/lib/cooking-modes'

import { CookingModesSection } from './cooking-modes-section'

vi.mock('@/lib/cooking-modes', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cooking-modes')>('@/lib/cooking-modes')
  return {
    ...actual,
    fetchCookingModes: vi.fn(),
    updateCookingModePresence: vi.fn(),
    createCookingMode: vi.fn(),
  }
})

const fetchCookingModesMock = vi.mocked(fetchCookingModes)
const updateCookingModePresenceMock = vi.mocked(updateCookingModePresence)
const createCookingModeMock = vi.mocked(createCookingMode)

const cookingModes = [
  { id: '1', name: 'casserole', present: true },
  { id: '2', name: 'poêle', present: true },
  { id: '3', name: 'four', present: true },
  { id: '4', name: 'micro-ondes', present: true },
]

describe('CookingModesSection', () => {
  beforeEach(() => {
    fetchCookingModesMock.mockReset()
    updateCookingModePresenceMock.mockReset()
    createCookingModeMock.mockReset()
  })

  it('affiche les modes de cuisson par défaut comme présents', async () => {
    fetchCookingModesMock.mockResolvedValue(cookingModes)
    render(<CookingModesSection />)

    expect(await screen.findByText('casserole')).toBeInTheDocument()
    for (const name of ['poêle', 'four', 'micro-ondes']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
    for (const cookingMode of cookingModes) {
      expect(screen.getByRole('switch', { name: cookingMode.name })).toHaveAttribute(
        'aria-checked',
        'true',
      )
    }
  })

  it('affiche une erreur si le chargement échoue', async () => {
    fetchCookingModesMock.mockRejectedValue(
      new CookingModesError('Impossible de récupérer les modes de cuisson.'),
    )
    render(<CookingModesSection />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de récupérer les modes de cuisson.',
    )
  })

  it('bascule présent/absent et affiche le libellé en toutes lettres', async () => {
    fetchCookingModesMock.mockResolvedValue(cookingModes)
    updateCookingModePresenceMock.mockResolvedValue({ id: '1', name: 'casserole', present: false })
    const user = userEvent.setup()
    render(<CookingModesSection />)

    const toggle = await screen.findByRole('switch', { name: 'casserole' })
    expect(toggle).toHaveTextContent('Présent')

    await user.click(toggle)

    await waitFor(() => expect(toggle).toHaveTextContent('Absent'))
    expect(updateCookingModePresenceMock).toHaveBeenCalledWith('1', false)
  })

  it('ajoute un mode de cuisson personnalisé via le champ de texte libre', async () => {
    fetchCookingModesMock.mockResolvedValue(cookingModes)
    createCookingModeMock.mockResolvedValue({ id: '5', name: 'plancha', present: true })
    const user = userEvent.setup()
    render(<CookingModesSection />)

    await screen.findByText('casserole')
    await user.type(screen.getByRole('textbox', { name: 'Ajouter un mode de cuisson' }), 'plancha')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(await screen.findByText('plancha')).toBeInTheDocument()
    expect(createCookingModeMock).toHaveBeenCalledWith('plancha')
  })

  it('affiche une erreur si l’ajout échoue', async () => {
    fetchCookingModesMock.mockResolvedValue(cookingModes)
    createCookingModeMock.mockRejectedValue(
      new CookingModesError("L'ajout du mode de cuisson a échoué. Veuillez réessayer."),
    )
    const user = userEvent.setup()
    render(<CookingModesSection />)

    await screen.findByText('casserole')
    await user.type(screen.getByRole('textbox', { name: 'Ajouter un mode de cuisson' }), 'wok')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "L'ajout du mode de cuisson a échoué. Veuillez réessayer.",
    )
  })
})
