import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyParsedIngredientsToStock, IngredientsError, parseIngredientsTranscript } from '@/lib/ingredients'

import { VoiceDictationSheet } from './voice-dictation-sheet'

vi.mock('@/lib/ingredients', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ingredients')>('@/lib/ingredients')
  return {
    ...actual,
    parseIngredientsTranscript: vi.fn(),
    applyParsedIngredientsToStock: vi.fn(),
  }
})

const parseIngredientsTranscriptMock = vi.mocked(parseIngredientsTranscript)
const applyParsedIngredientsToStockMock = vi.mocked(applyParsedIngredientsToStock)

const useSpeechRecognitionMock = vi.fn()
vi.mock('@/hooks/use-speech-recognition', () => ({
  useSpeechRecognition: () => useSpeechRecognitionMock(),
}))

function baseSpeechRecognition(overrides: Partial<ReturnType<typeof useSpeechRecognitionMock>> = {}) {
  return {
    supported: true,
    isListening: false,
    transcript: '',
    error: null,
    start: vi.fn(),
    stop: vi.fn(),
    ...overrides,
  }
}

describe('VoiceDictationSheet', () => {
  beforeEach(() => {
    parseIngredientsTranscriptMock.mockReset()
    applyParsedIngredientsToStockMock.mockReset()
    useSpeechRecognitionMock.mockReset()
    useSpeechRecognitionMock.mockReturnValue(baseSpeechRecognition())
  })

  it("montre l'état Prêt avec un micro et un repli texte", () => {
    render(<VoiceDictationSheet onIngredientsAdded={vi.fn()} />)

    expect(screen.getByRole('button', { name: /écouter/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/saisir le texte/i)).toBeInTheDocument()
  })

  it('propose uniquement le repli texte quand le navigateur ne supporte pas la dictée', () => {
    useSpeechRecognitionMock.mockReturnValue(baseSpeechRecognition({ supported: false }))

    render(<VoiceDictationSheet onIngredientsAdded={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /écouter/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/saisir le texte/i)).toBeInTheDocument()
  })

  it('passe en Écoute au clic sur le micro puis lance automatiquement l’analyse à l’arrêt', async () => {
    const user = userEvent.setup()
    const start = vi.fn()
    const stop = vi.fn()
    useSpeechRecognitionMock.mockReturnValue(baseSpeechRecognition({ start, stop }))
    parseIngredientsTranscriptMock.mockResolvedValue([
      { name: 'tomate', present: true, isNew: true, storage: 'frigo' },
    ])

    const { rerender } = render(<VoiceDictationSheet onIngredientsAdded={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /écouter/i }))
    expect(start).toHaveBeenCalled()

    useSpeechRecognitionMock.mockReturnValue(
      baseSpeechRecognition({ start, stop, isListening: true, transcript: 'il reste des tomates' }),
    )
    rerender(<VoiceDictationSheet onIngredientsAdded={vi.fn()} />)
    expect(screen.getByRole('button', { name: /arrêter l'écoute/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /arrêter l'écoute/i }))
    expect(stop).toHaveBeenCalled()

    useSpeechRecognitionMock.mockReturnValue(
      baseSpeechRecognition({ start, stop, isListening: false, transcript: 'il reste des tomates' }),
    )
    rerender(<VoiceDictationSheet onIngredientsAdded={vi.fn()} />)

    expect(await screen.findByText('tomate')).toBeInTheDocument()
    expect(parseIngredientsTranscriptMock).toHaveBeenCalledWith('il reste des tomates')
  })

  it("envoie le texte du repli à l'analyse et affiche le résultat", async () => {
    const user = userEvent.setup()
    parseIngredientsTranscriptMock.mockResolvedValue([
      { name: 'tomate', present: true, isNew: true, storage: 'frigo' },
    ])

    render(<VoiceDictationSheet onIngredientsAdded={vi.fn()} />)

    await user.type(screen.getByLabelText(/saisir le texte/i), 'il reste des tomates')
    await user.click(screen.getByRole('button', { name: /analyser/i }))

    expect(await screen.findByText('tomate')).toBeInTheDocument()
    expect(parseIngredientsTranscriptMock).toHaveBeenCalledWith('il reste des tomates')
  })

  it("affiche l'état Erreur d'analyse en conservant la transcription et permet de réessayer", async () => {
    const user = userEvent.setup()
    parseIngredientsTranscriptMock.mockRejectedValueOnce(new IngredientsError("L'analyse vocale a échoué, réessayez."))
    parseIngredientsTranscriptMock.mockResolvedValueOnce([
      { name: 'basilic', present: true, isNew: true, storage: 'placard' },
    ])

    render(<VoiceDictationSheet onIngredientsAdded={vi.fn()} />)

    await user.type(screen.getByLabelText(/saisir le texte/i), 'du basilic')
    await user.click(screen.getByRole('button', { name: /analyser/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent("L'analyse vocale a échoué, réessayez.")
    expect(screen.getByLabelText(/saisir le texte/i)).toHaveValue('du basilic')

    await user.click(screen.getByRole('button', { name: /réessayer l'analyse/i }))

    expect(await screen.findByText('basilic')).toBeInTheDocument()
    expect(parseIngredientsTranscriptMock).toHaveBeenCalledTimes(2)
  })

  it('ajoute au stock puis notifie le parent', async () => {
    const user = userEvent.setup()
    const onIngredientsAdded = vi.fn()
    parseIngredientsTranscriptMock.mockResolvedValue([
      { name: 'tomate', present: true, isNew: true, storage: 'frigo' },
    ])
    applyParsedIngredientsToStockMock.mockResolvedValue(undefined)

    render(<VoiceDictationSheet onIngredientsAdded={onIngredientsAdded} />)

    await user.type(screen.getByLabelText(/saisir le texte/i), 'il reste des tomates')
    await user.click(screen.getByRole('button', { name: /analyser/i }))
    await screen.findByText('tomate')

    await user.click(screen.getByRole('button', { name: /ajouter au stock/i }))

    await waitFor(() => expect(onIngredientsAdded).toHaveBeenCalled())
    expect(applyParsedIngredientsToStockMock).toHaveBeenCalledWith([
      { name: 'tomate', present: true, isNew: true, storage: 'frigo' },
    ])
  })

  it("affiche une erreur d'ajout et permet de réessayer l'ajout sans ré-analyser", async () => {
    const user = userEvent.setup()
    const onIngredientsAdded = vi.fn()
    parseIngredientsTranscriptMock.mockResolvedValue([
      { name: 'tomate', present: true, isNew: true, storage: 'frigo' },
    ])
    applyParsedIngredientsToStockMock.mockRejectedValueOnce(new Error('boom'))
    applyParsedIngredientsToStockMock.mockResolvedValueOnce(undefined)

    render(<VoiceDictationSheet onIngredientsAdded={onIngredientsAdded} />)

    await user.type(screen.getByLabelText(/saisir le texte/i), 'il reste des tomates')
    await user.click(screen.getByRole('button', { name: /analyser/i }))
    await screen.findByText('tomate')

    await user.click(screen.getByRole('button', { name: /ajouter au stock/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "L'ajout au stock a échoué. Veuillez réessayer.",
    )

    await user.click(screen.getByRole('button', { name: /réessayer l'ajout/i }))

    await waitFor(() => expect(onIngredientsAdded).toHaveBeenCalled())
    expect(parseIngredientsTranscriptMock).toHaveBeenCalledTimes(1)
  })

  it('revient à Prêt sur Recommencer', async () => {
    const user = userEvent.setup()
    parseIngredientsTranscriptMock.mockResolvedValue([
      { name: 'tomate', present: true, isNew: true, storage: 'frigo' },
    ])

    render(<VoiceDictationSheet onIngredientsAdded={vi.fn()} />)

    await user.type(screen.getByLabelText(/saisir le texte/i), 'il reste des tomates')
    await user.click(screen.getByRole('button', { name: /analyser/i }))
    await screen.findByText('tomate')

    await user.click(screen.getByRole('button', { name: /recommencer/i }))

    expect(screen.getByLabelText(/saisir le texte/i)).toHaveValue('')
  })
})
