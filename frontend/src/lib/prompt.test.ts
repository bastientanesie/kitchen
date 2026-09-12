import { describe, expect, it } from 'vitest'

import { buildRecipePrompt } from '@/lib/prompt'

describe('buildRecipePrompt', () => {
  it('assemble les ingrédients présents, les modes actifs, les préférences et les instructions dans des sections distinctes', () => {
    const prompt = buildRecipePrompt({
      presentIngredients: ['Tomates', 'Riz'],
      activeCookingModes: ['Four', 'Poêle'],
      preferences: 'Sans gluten',
      instructions: 'Repas rapide ce soir',
    })

    expect(prompt).toContain('Tomates')
    expect(prompt).toContain('Riz')
    expect(prompt).toContain('Four')
    expect(prompt).toContain('Poêle')
    expect(prompt).toContain('Sans gluten')
    expect(prompt).toContain('Repas rapide ce soir')
    expect(prompt).toContain('au moins 3 recettes')
    expect(prompt).toContain('deux temps')
  })

  it('inclut toujours les préférences du foyer même vides', () => {
    const prompt = buildRecipePrompt({
      presentIngredients: ['Tomates'],
      activeCookingModes: ['Four'],
      preferences: null,
      instructions: undefined,
    })

    expect(prompt).toContain('Préférences du foyer')
    expect(prompt).toContain('Aucune préférence renseignée.')
  })

  it('omet la section instructions ponctuelles quand elle est absente ou vide', () => {
    const withoutInstructions = buildRecipePrompt({
      presentIngredients: ['Tomates'],
      activeCookingModes: ['Four'],
      preferences: 'Sans gluten',
    })
    const withBlankInstructions = buildRecipePrompt({
      presentIngredients: ['Tomates'],
      activeCookingModes: ['Four'],
      preferences: 'Sans gluten',
      instructions: '   ',
    })

    expect(withoutInstructions).not.toContain('Instructions ponctuelles')
    expect(withBlankInstructions).not.toContain('Instructions ponctuelles')
  })

  it('ne conserve que les ingrédients présents et les modes actifs fournis en entrée, sans les fusionner', () => {
    const prompt = buildRecipePrompt({
      presentIngredients: ['Tomates'],
      activeCookingModes: ['Four'],
      preferences: 'Sans gluten',
    })

    const ingredientsIndex = prompt.indexOf('Ingrédients disponibles')
    const modesIndex = prompt.indexOf('Modes de cuisson disponibles')
    const preferencesIndex = prompt.indexOf('Préférences du foyer')

    expect(ingredientsIndex).toBeGreaterThanOrEqual(0)
    expect(modesIndex).toBeGreaterThan(ingredientsIndex)
    expect(preferencesIndex).toBeGreaterThan(modesIndex)
  })

  it('signale une liste vide plutôt que de sauter la section', () => {
    const prompt = buildRecipePrompt({
      presentIngredients: [],
      activeCookingModes: [],
      preferences: 'Sans gluten',
    })

    expect(prompt).toContain('Aucun.')
  })
})
