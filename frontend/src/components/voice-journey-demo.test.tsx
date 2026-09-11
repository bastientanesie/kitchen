import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VoiceJourneyDemo } from './voice-journey-demo'

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('VoiceJourneyDemo', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('affiche les trois étapes du parcours voix → transcription → prompt', () => {
    mockMatchMedia(false)

    render(<VoiceJourneyDemo />)

    expect(screen.getByText('Dictée')).toBeInTheDocument()
    expect(screen.getByText('Transcription')).toBeInTheDocument()
    expect(screen.getByText('Prompt')).toBeInTheDocument()
    expect(screen.getByText(/Générer le prompt recette/)).toBeInTheDocument()
  })

  it("n'anime aucune étape quand prefers-reduced-motion est actif", () => {
    mockMatchMedia(true)

    render(<VoiceJourneyDemo />)

    const activeSteps = document.querySelectorAll('[data-active="true"]')
    expect(activeSteps).toHaveLength(0)
  })
})
