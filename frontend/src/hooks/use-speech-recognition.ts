import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type SpeechRecognitionResultLike = {
  isFinal: boolean
  0: { transcript: string }
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const globalWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition
}

export function useSpeechRecognition() {
  const SpeechRecognitionCtor = useMemo(() => getSpeechRecognitionConstructor(), [])
  const supported = SpeechRecognitionCtor !== undefined
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  const start = useCallback(() => {
    if (!SpeechRecognitionCtor) return

    setError(null)
    setTranscript('')

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''
      let previousFinalSegment = ''
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i]
        const segment = result[0].transcript
        if (result.isFinal) {
          if (segment.trim() !== previousFinalSegment.trim()) {
            finalTranscript += segment
          }
          previousFinalSegment = segment
        } else {
          interimTranscript += segment
        }
      }
      setTranscript(finalTranscript + interimTranscript)
    }

    recognition.onerror = () => {
      setError('La reconnaissance vocale a échoué.')
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [SpeechRecognitionCtor])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  return { supported, isListening, transcript, error, start, stop }
}
