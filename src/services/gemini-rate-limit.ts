import { AppError } from "../errors.js";

const RATE_LIMIT_WINDOW_MS = 60_000;

const lastCallByHousehold = new Map<string, number>();

function rateLimitedError(retryAfter: number): AppError {
  return new AppError(429, "GEMINI_RATE_LIMITED", "Trop d'appels à l'analyse vocale, réessayez plus tard.", {
    retryAfter,
  });
}

export function checkGeminiRateLimit(householdId: string, now: number = Date.now()): void {
  const lastCall = lastCallByHousehold.get(householdId);

  if (lastCall !== undefined) {
    const elapsedMs = now - lastCall;
    if (elapsedMs < RATE_LIMIT_WINDOW_MS) {
      throw rateLimitedError(Math.ceil((RATE_LIMIT_WINDOW_MS - elapsedMs) / 1000));
    }
  }
}

export function recordGeminiCall(householdId: string, now: number = Date.now()): void {
  lastCallByHousehold.set(householdId, now);
}

export function resetGeminiRateLimit(): void {
  lastCallByHousehold.clear();
}
