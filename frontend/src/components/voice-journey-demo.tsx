import { Mic, Sparkles, Type } from 'lucide-react'
import { useEffect, useState } from 'react'

import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    icon: Mic,
    label: 'Dictée',
    detail: '« Il reste des œufs, du beurre et un peu de farine »',
  },
  {
    icon: Type,
    label: 'Transcription',
    detail: 'Œufs, beurre, farine détectés',
  },
  {
    icon: Sparkles,
    label: 'Prompt',
    detail: 'Prompt recette prêt pour votre IA préférée',
  },
] as const

const STEP_DURATION_MS = 2600

export function VoiceJourneyDemo() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion) return

    const interval = setInterval(() => {
      setActiveStep((step) => (step + 1) % STEPS.length)
    }, STEP_DURATION_MS)

    return () => clearInterval(interval)
  }, [prefersReducedMotion])

  return (
    <div
      role="group"
      aria-label="Démonstration du parcours voix vers prompt recette"
      className="flex w-full flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      {STEPS.map((step, index) => {
        const isActive = !prefersReducedMotion && index === activeStep
        const Icon = step.icon

        return (
          <div
            key={step.label}
            data-active={isActive}
            className={cn(
              'flex items-center gap-3 rounded-lg border border-transparent p-3 transition-colors',
              isActive && 'border-present bg-present/10',
            )}
          >
            <span
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground',
                isActive && 'bg-present text-present-foreground',
              )}
              aria-hidden="true"
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{step.label}</span>
              <span className="text-sm text-muted-foreground">{step.detail}</span>
            </div>
          </div>
        )
      })}
      <span
        aria-hidden="true"
        className="mt-2 inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Générer le prompt recette →
      </span>
    </div>
  )
}
