export class IngredientsError extends Error {}

export type Storage = 'frigo' | 'placard' | 'congelateur'

export type Ingredient = {
  id: string
  name: string
  present: boolean
  storage: Storage
}

async function parseIngredientsResponse<T>(response: Response, failureMessage: string): Promise<T> {
  if (!response.ok) throw new IngredientsError(failureMessage)
  return response.json()
}

export async function fetchIngredients(): Promise<Ingredient[]> {
  const response = await fetch('/ingredients', { credentials: 'include' })
  return parseIngredientsResponse(response, 'Impossible de récupérer le stock.')
}

export async function updateIngredientPresence(id: string, present: boolean): Promise<Ingredient> {
  const response = await fetch(`/ingredients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ present }),
  })
  return parseIngredientsResponse(response, "La mise à jour de l'ingrédient a échoué. Veuillez réessayer.")
}
