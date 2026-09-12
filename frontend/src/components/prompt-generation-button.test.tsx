import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchCookingModes } from '@/lib/cooking-modes'
import { fetchHouseholdPreferences } from '@/lib/household'
import { fetchIngredients } from '@/lib/ingredients'

import { PromptGenerationButton } from './prompt-generation-button'

vi.mock('@/lib/ingredients', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ingredients')>('@/lib/ingredients')
  return { ...actual, fetchIngredients: vi.fn() }
})
vi.mock('@/lib/cooking-modes', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cooking-modes')>('@/lib/cooking-modes')
  return { ...actual, fetchCookingModes: vi.fn() }
})
vi.mock('@/lib/household', async () => {
  const actual = await vi.importActual<typeof import('@/lib/household')>('@/lib/household')
  return { ...actual, fetchHouseholdPreferences: vi.fn() }
})

const fetchIngredientsMock = vi.mocked(fetchIngredients)
const fetchCookingModesMock = vi.mocked(fetchCookingModes)
const fetchHouseholdPreferencesMock = vi.mocked(fetchHouseholdPreferences)

async function openModal(onEditPreferences = vi.fn()) {
  render(<PromptGenerationButton onEditPreferences={onEditPreferences} />)
  await userEvent.click(screen.getByRole('button', { name: 'Générer' }))
  return onEditPreferences
}

describe('PromptGenerationButton', () => {
  beforeEach(() => {
    fetchIngredientsMock.mockReset()
    fetchCookingModesMock.mockReset()
    fetchHouseholdPreferencesMock.mockReset()
    fetchIngredientsMock.mockResolvedValue([
      { id: '1', name: 'Tomates', present: true, storage: 'frigo' },
      { id: '2', name: 'Farine', present: false, storage: 'placard' },
    ])
    fetchCookingModesMock.mockResolvedValue([
      { id: '1', name: 'Four', present: true },
      { id: '2', name: 'Wok', present: false },
    ])
    fetchHouseholdPreferencesMock.mockResolvedValue('Sans gluten')
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('ouvre une modale centrée avec le rappel des préférences et les 4 accès directs', async () => {
    await openModal()

    expect(await screen.findByRole('dialog', { name: 'Générer des recettes' })).toBeInTheDocument()
    expect(screen.getByText(/préférences du foyer prises en compte/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Claude' })).toHaveAttribute('href', 'https://claude.ai')
    expect(screen.getByRole('link', { name: 'ChatGPT' })).toHaveAttribute('href', 'https://chatgpt.com')
    expect(screen.getByRole('link', { name: 'Gemini' })).toHaveAttribute('href', 'https://gemini.google.com')
    expect(screen.getByRole('link', { name: 'Perplexity' })).toHaveAttribute('href', 'https://www.perplexity.ai')
  })

  it('copie le prompt assemblé avec les ingrédients présents, modes actifs, préférences et instructions', async () => {
    await openModal()
    await screen.findByRole('button', { name: /copier le prompt/i })

    await userEvent.type(screen.getByLabelText(/instructions ponctuelles/i), 'Repas rapide')
    await userEvent.click(screen.getByRole('button', { name: /copier le prompt/i }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]
    expect(copied).toContain('Tomates')
    expect(copied).not.toContain('Farine')
    expect(copied).toContain('Four')
    expect(copied).not.toContain('Wok')
    expect(copied).toContain('Sans gluten')
    expect(copied).toContain('Repas rapide')
  })

  it('ouvre les préférences du foyer via le lien "modifier"', async () => {
    const onEditPreferences = await openModal()
    await screen.findByRole('button', { name: /copier le prompt/i })

    await userEvent.click(screen.getByRole('button', { name: 'modifier' }))

    expect(onEditPreferences).toHaveBeenCalledTimes(1)
  })

  it('affiche une erreur si le chargement des données échoue', async () => {
    fetchIngredientsMock.mockRejectedValue(new Error('boom'))
    await openModal()

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de préparer le prompt')
  })

  it('affiche une erreur si la copie échoue', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    await openModal()

    await userEvent.click(await screen.findByRole('button', { name: /copier le prompt/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de copier le prompt')
  })
})
