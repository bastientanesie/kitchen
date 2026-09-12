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

export type ParsedIngredient = {
  name: string
  present: boolean
  isNew: boolean
  storage: Storage
}

export async function parseIngredientsTranscript(transcript: string): Promise<ParsedIngredient[]> {
  const response = await fetch('/ingredients/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ transcript }),
  })
  const { ingredients } = await parseIngredientsResponse<{ ingredients: ParsedIngredient[] }>(
    response,
    "L'analyse vocale a échoué, réessayez.",
  )
  return ingredients
}

export async function createIngredients(
  inputs: { name: string; present: boolean; storage: Storage }[],
): Promise<Ingredient[]> {
  const response = await fetch('/ingredients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(inputs),
  })
  return parseIngredientsResponse(response, "L'ajout au stock a échoué. Veuillez réessayer.")
}

export async function applyParsedIngredientsToStock(parsed: ParsedIngredient[]): Promise<void> {
  const newIngredients = parsed.filter((ingredient) => ingredient.isNew)
  const existingIngredients = parsed.filter((ingredient) => !ingredient.isNew)

  const tasks: Promise<unknown>[] = []

  if (newIngredients.length > 0) {
    tasks.push(
      createIngredients(
        newIngredients.map(({ name, present, storage }) => ({ name, present, storage })),
      ),
    )
  }

  if (existingIngredients.length > 0) {
    tasks.push(
      fetchIngredients().then((stock) => {
        const stockByName = new Map(stock.map((ingredient) => [ingredient.name, ingredient]))
        return Promise.all(
          existingIngredients
            .map((ingredient) => stockByName.get(ingredient.name))
            .filter((ingredient): ingredient is Ingredient => ingredient !== undefined && !ingredient.present)
            .map((ingredient) => updateIngredientPresence(ingredient.id, true)),
        )
      }),
    )
  }

  await Promise.all(tasks)
}
