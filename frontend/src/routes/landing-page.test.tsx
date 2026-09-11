import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { LandingPage } from './landing-page'

describe('LandingPage', () => {
  it('affiche les deux CTA menant vers connexion et création de foyer', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/connexion',
    )
    expect(screen.getByRole('link', { name: 'Créer un foyer' })).toHaveAttribute(
      'href',
      '/foyer/creer',
    )
  })

  it('affiche la démonstration visuelle du parcours voix → transcription → prompt', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('group', { name: 'Démonstration du parcours voix vers prompt recette' }),
    ).toBeInTheDocument()
  })
})
