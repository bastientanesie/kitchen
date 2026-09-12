import { Loader2, Mic, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'
import {
  IngredientsError,
  applyParsedIngredientsToStock,
  parseIngredientsTranscript,
  type ParsedIngredient,
} from '@/lib/ingredients'

type Phase =
  | { status: 'ready' }
  | { status: 'listening' }
  | { status: 'analyzing'; transcript: string }
  | { status: 'result'; transcript: string; ingredients: ParsedIngredient[] }
  | { status: 'analysis-error'; transcript: string; message: string }
  | { status: 'adding'; transcript: string; ingredients: ParsedIngredient[] }
  | { status: 'add-error'; transcript: string; ingredients: ParsedIngredient[]; message: string }

export function VoiceDictationSheet({
  onIngredientsAdded,
}: {
  onIngredientsAdded: () => void
}) {
  const speech = useSpeechRecognition()
  const [phase, setPhase] = useState<Phase>({ status: 'ready' })
  const [draftText, setDraftText] = useState('')
  const wasListeningRef = useRef(false)

  useEffect(() => {
    if (phase.status === 'listening') setDraftText(speech.transcript)
  }, [speech.transcript, phase.status])

  useEffect(() => {
    if (wasListeningRef.current && !speech.isListening && phase.status === 'listening') {
      analyze(speech.transcript)
    }
    wasListeningRef.current = speech.isListening
  }, [speech.isListening])

  async function analyze(transcript: string) {
    const trimmed = transcript.trim()
    if (!trimmed) {
      setPhase({ status: 'ready' })
      return
    }
    setPhase({ status: 'analyzing', transcript })
    try {
      const ingredients = await parseIngredientsTranscript(trimmed)
      setPhase({ status: 'result', transcript, ingredients })
    } catch (err) {
      setPhase({
        status: 'analysis-error',
        transcript,
        message: err instanceof IngredientsError ? err.message : "L'analyse vocale a échoué, réessayez.",
      })
    }
  }

  async function handleAddToStock(ingredients: ParsedIngredient[], transcript: string) {
    setPhase({ status: 'adding', transcript, ingredients })
    try {
      await applyParsedIngredientsToStock(ingredients)
      onIngredientsAdded()
    } catch {
      setPhase({
        status: 'add-error',
        transcript,
        ingredients,
        message: "L'ajout au stock a échoué. Veuillez réessayer.",
      })
    }
  }

  function handleRestart() {
    speech.stop()
    setDraftText('')
    setPhase({ status: 'ready' })
  }

  function handleStartListening() {
    setDraftText('')
    setPhase({ status: 'listening' })
    speech.start()
  }

  return (
    <div className="flex flex-col gap-4">
      {phase.status === 'ready' && (
        <>
          {speech.supported && (
            <div className="flex flex-col items-center gap-2">
              <Button type="button" size="lg" aria-label="Écouter" onClick={handleStartListening}>
                <Mic className="h-5 w-5" aria-hidden="true" />
                Écouter
              </Button>
              {speech.error && (
                <p role="alert" className="text-sm text-destructive">
                  {speech.error}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="voice-dictation-text" className="text-sm font-medium text-muted-foreground">
              Saisir le texte
            </label>
            <textarea
              id="voice-dictation-text"
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder="Il reste des œufs, du beurre et un peu de farine dans le frigo…"
            />
            <Button type="button" onClick={() => analyze(draftText)} disabled={draftText.trim().length === 0}>
              Analyser
            </Button>
          </div>
        </>
      )}

      {phase.status === 'listening' && (
        <div className="flex flex-col items-center gap-3">
          <Button
            type="button"
            size="lg"
            variant="destructive"
            aria-label="Arrêter l'écoute"
            onClick={() => speech.stop()}
          >
            <Square className="h-5 w-5" aria-hidden="true" />
            Arrêter l'écoute
          </Button>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Écoute en cours…
          </p>
          {draftText && <p className="text-sm">{draftText}</p>}
        </div>
      )}

      {phase.status === 'analyzing' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Analyse des ingrédients…
        </p>
      )}

      {phase.status === 'analysis-error' && (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-sm text-destructive">
            {phase.message}
          </p>
          <div className="flex flex-col gap-2">
            <label htmlFor="voice-dictation-text" className="text-sm font-medium text-muted-foreground">
              Saisir le texte
            </label>
            <textarea
              id="voice-dictation-text"
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={phase.transcript}
              readOnly
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => analyze(phase.transcript)}>
              Réessayer l'analyse
            </Button>
            <Button type="button" variant="outline" onClick={handleRestart}>
              Recommencer
            </Button>
          </div>
        </div>
      )}

      {(phase.status === 'result' || phase.status === 'adding' || phase.status === 'add-error') && (
        <div className="flex flex-col gap-3">
          {phase.ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun ingrédient détecté.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {phase.ingredients.map((ingredient) => (
                <li
                  key={ingredient.name}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                >
                  <span className="font-medium">{ingredient.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {ingredient.present ? 'Présent' : 'Absent'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {phase.status === 'add-error' && (
            <p role="alert" className="text-sm text-destructive">
              {phase.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => handleAddToStock(phase.ingredients, phase.transcript)}
              disabled={phase.status === 'adding' || phase.ingredients.length === 0}
            >
              {phase.status === 'adding' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {phase.status === 'add-error' ? "Réessayer l'ajout" : 'Ajouter au stock'}
            </Button>
            <Button type="button" variant="outline" onClick={handleRestart} disabled={phase.status === 'adding'}>
              Recommencer
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
