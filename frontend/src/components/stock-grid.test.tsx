import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { IngredientsError, fetchIngredients, updateIngredientPresence } from '@/lib/ingredients'

import { StockGrid } from './stock-grid'

vi.mock('@/lib/ingredients', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ingredients')>('@/lib/ingredients')
  return {
    ...actual,
    fetchIngredients: vi.fn(),
    updateIngredientPresence: vi.fn(),
  }
})

const fetchIngredientsMock = vi.mocked(fetchIngredients)
const updateIngredientPresenceMock = vi.mocked(updateIngredientPresence)

const ingredients = [
  { id: '1', name: 'œufs', present: true, storage: 'frigo' as const },
  { id: '2', name: 'farine', present: false, storage: 'placard' as const },
  { id: '3', name: 'glace', present: true, storage: 'congelateur' as const },
]

describe('StockGrid', () => {
  beforeEach(() => {
    fetchIngredientsMock.mockReset()
    updateIngredientPresenceMock.mockReset()
  })

  it('affiche la liste des ingrédients une fois chargée', async () => {
    fetchIngredientsMock.mockResolvedValue(ingredients)
    render(<StockGrid />)

    expect(await screen.findByText('œufs')).toBeInTheDocument()
    expect(screen.getByText('farine')).toBeInTheDocument()
    expect(screen.getByText('glace')).toBeInTheDocument()
  })

  it('affiche une erreur si le chargement échoue', async () => {
    fetchIngredientsMock.mockRejectedValue(new IngredientsError('Impossible de récupérer le stock.'))
    render(<StockGrid />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de récupérer le stock.')
  })

  it('filtre les ingrédients de façon tolérante aux accents/ligatures', async () => {
    fetchIngredientsMock.mockResolvedValue(ingredients)
    const user = userEvent.setup()
    render(<StockGrid />)

    await screen.findByText('œufs')
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher un ingrédient' }), 'oeuf')

    expect(screen.getByText('œufs')).toBeInTheDocument()
    expect(screen.queryByText('farine')).not.toBeInTheDocument()
    expect(screen.getByText(/2 ingrédients masqués/)).toBeInTheDocument()
  })

  it('efface la recherche via le bouton clear', async () => {
    fetchIngredientsMock.mockResolvedValue(ingredients)
    const user = userEvent.setup()
    render(<StockGrid />)

    await screen.findByText('œufs')
    const input = screen.getByRole('searchbox', { name: 'Rechercher un ingrédient' })
    await user.type(input, 'oeuf')
    await user.click(screen.getByRole('button', { name: 'Effacer la recherche' }))

    expect(input).toHaveValue('')
    expect(screen.getByText('farine')).toBeInTheDocument()
  })

  it('bascule présent/absent et met à jour le libellé', async () => {
    fetchIngredientsMock.mockResolvedValue(ingredients)
    updateIngredientPresenceMock.mockResolvedValue({ ...ingredients[1], present: true })
    const user = userEvent.setup()
    render(<StockGrid />)

    await screen.findByText('farine')
    const toggle = screen.getByRole('switch', { name: 'farine' })
    expect(toggle).toHaveTextContent('Absent')

    await user.click(toggle)

    await waitFor(() => expect(toggle).toHaveTextContent('Présent'))
    expect(updateIngredientPresenceMock).toHaveBeenCalledWith('2', true)
  })

  it('annule le changement local si la mise à jour échoue', async () => {
    fetchIngredientsMock.mockResolvedValue(ingredients)
    updateIngredientPresenceMock.mockRejectedValue(new IngredientsError('échec'))
    const user = userEvent.setup()
    render(<StockGrid />)

    await screen.findByText('farine')
    const toggle = screen.getByRole('switch', { name: 'farine' })

    await user.click(toggle)

    await waitFor(() => expect(toggle).toHaveTextContent('Absent'))
    expect(await screen.findByRole('alert')).toHaveTextContent('échec')
  })
})
