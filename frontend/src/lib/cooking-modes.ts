export class CookingModesError extends Error {}

export type CookingMode = {
  id: string
  name: string
  present: boolean
}

async function parseCookingModesResponse<T>(response: Response, failureMessage: string): Promise<T> {
  if (!response.ok) throw new CookingModesError(failureMessage)
  return response.json()
}

export async function fetchCookingModes(): Promise<CookingMode[]> {
  const response = await fetch('/cooking-modes', { credentials: 'include' })
  return parseCookingModesResponse(response, 'Impossible de récupérer les modes de cuisson.')
}

export async function updateCookingModePresence(id: string, present: boolean): Promise<CookingMode> {
  const response = await fetch(`/cooking-modes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ present }),
  })
  return parseCookingModesResponse(response, 'La mise à jour du mode de cuisson a échoué. Veuillez réessayer.')
}

export async function createCookingMode(name: string): Promise<CookingMode> {
  // L'endpoint ne supporte que la création par lot ; on envoie un tableau d'un seul élément.
  const response = await fetch('/cooking-modes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify([{ name, present: true }]),
  })
  const [created] = await parseCookingModesResponse<CookingMode[]>(
    response,
    "L'ajout du mode de cuisson a échoué. Veuillez réessayer.",
  )
  return created
}
