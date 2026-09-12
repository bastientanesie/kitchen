import { useEffect, useState } from 'react'

const RADIUS = 28
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function CountdownRing({
  expiresAt,
  totalMs,
  onExpire,
}: {
  expiresAt: string
  totalMs: number
  onExpire: () => void
}) {
  const [remainingMs, setRemainingMs] = useState(() => Date.parse(expiresAt) - Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      const next = Date.parse(expiresAt) - Date.now()
      setRemainingMs(next)
      if (next <= 0) {
        clearInterval(interval)
        onExpire()
      }
    }, 250)
    return () => clearInterval(interval)
  }, [expiresAt, onExpire])

  const clampedMs = Math.max(0, remainingMs)
  const fraction = clampedMs / totalMs
  const remainingSeconds = Math.ceil(clampedMs / 1000)

  return (
    <div className="relative flex h-16 w-16 items-center justify-center" role="timer" aria-live="polite">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={RADIUS} className="fill-none stroke-muted" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          className="fill-none stroke-primary transition-[stroke-dashoffset] duration-200 ease-linear"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
        />
      </svg>
      <span className="absolute text-xs font-medium tabular-nums">{remainingSeconds}s</span>
    </div>
  )
}
