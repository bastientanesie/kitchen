export type BuildRecipePromptInput = {
  presentIngredients: string[]
  activeCookingModes: string[]
  preferences: string | null
  instructions?: string
}

export function buildRecipePrompt({
  presentIngredients,
  activeCookingModes,
  preferences,
  instructions,
}: BuildRecipePromptInput): string {
  const sections = [
    'Propose au moins 3 recettes réalisables avec les informations ci-dessous. Réponds sur un ton neutre et factuel, en deux temps : d\'abord la liste des recettes proposées avec un court descriptif, puis le détail complet (ingrédients et étapes) de chacune.',
    `Ingrédients disponibles :\n${formatList(presentIngredients)}`,
    `Modes de cuisson disponibles :\n${formatList(activeCookingModes)}`,
    `Préférences du foyer :\n${preferences && preferences.trim() !== '' ? preferences : 'Aucune préférence renseignée.'}`,
  ]

  if (instructions && instructions.trim() !== '') {
    sections.push(`Instructions ponctuelles :\n${instructions.trim()}`)
  }

  return sections.join('\n\n')
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : 'Aucun.'
}
