import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSpeechRecognition } from './use-speech-recognition'

class FakeSpeechRecognition {
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((event: unknown) => void) | null = null
  onerror: (() => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
}

describe('useSpeechRecognition', () => {
  let originalSpeechRecognition: unknown

  beforeEach(() => {
    originalSpeechRecognition = (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
  })

  afterEach(() => {
    ;(window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = originalSpeechRecognition
  })

  it('reports unsupported when the Web Speech API is unavailable', () => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition

    const { result } = renderHook(() => useSpeechRecognition())

    expect(result.current.supported).toBe(false)
  })

  it('starts listening and accumulates the live transcript', () => {
    ;(window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeSpeechRecognition

    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.supported).toBe(true)

    act(() => result.current.start())
    expect(result.current.isListening).toBe(true)
  })

  it('marks an error and stops listening on recognition failure', () => {
    let createdInstance: FakeSpeechRecognition | undefined
    class TrackedFakeSpeechRecognition extends FakeSpeechRecognition {
      constructor() {
        super()
        createdInstance = this
      }
    }
    ;(window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = TrackedFakeSpeechRecognition

    const { result } = renderHook(() => useSpeechRecognition())
    act(() => result.current.start())

    act(() => createdInstance?.onerror?.())

    expect(result.current.error).toBe('La reconnaissance vocale a échoué.')
    expect(result.current.isListening).toBe(false)
  })

  it('accumulates transcript from recognition results', () => {
    let createdInstance: FakeSpeechRecognition | undefined
    class TrackedFakeSpeechRecognition extends FakeSpeechRecognition {
      constructor() {
        super()
        createdInstance = this
      }
    }
    ;(window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = TrackedFakeSpeechRecognition

    const { result } = renderHook(() => useSpeechRecognition())
    act(() => result.current.start())

    act(() =>
      createdInstance?.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: 'des œufs et du beurre' } }],
      }),
    )

    expect(result.current.transcript).toBe('des œufs et du beurre')
  })
})
