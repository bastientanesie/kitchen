import { describe, expect, it } from 'vitest'

import { normalizeForSearch } from './normalize-search'

describe('normalizeForSearch', () => {
  it('supprime les accents', () => {
    expect(normalizeForSearch('crème')).toBe('creme')
  })

  it('déligature œ en oe', () => {
    expect(normalizeForSearch('Œufs')).toBe('oeufs')
  })

  it('permet à "oeuf" de matcher "Œufs" (même forme normalisée)', () => {
    expect(normalizeForSearch('Œufs')).toBe(normalizeForSearch('oeufs'))
  })

  it('ignore la casse et les espaces superflus', () => {
    expect(normalizeForSearch('  Épinards  ')).toBe('epinards')
  })
})
