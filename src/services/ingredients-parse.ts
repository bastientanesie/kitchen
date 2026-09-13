import type Database from "better-sqlite3";
import { AppError } from "../errors.js";
import type { ParsedIngredient } from "../schemas/ingredients.js";
import {
  callGemini,
  GeminiFormatError,
  GeminiHttpError,
  GeminiNetworkError,
  GeminiTimeoutError,
  type GeminiIngredient,
} from "./gemini-client.js";
import { checkGeminiRateLimit, recordGeminiCall } from "./gemini-rate-limit.js";
import { listIngredients, normalizeName } from "./ingredients.js";

function geminiAnalysisFailedError(cause: unknown): AppError {
  const options = { cause };

  if (cause instanceof GeminiTimeoutError) {
    return new AppError(
      504,
      "GEMINI_TIMEOUT",
      "L'analyse vocale a pris trop de temps, réessayez.",
      undefined,
      options,
    );
  }

  if (cause instanceof GeminiHttpError && cause.status === 429) {
    return new AppError(
      503,
      "GEMINI_QUOTA_EXCEEDED",
      "Le service d'analyse vocale est momentanément saturé, réessayez plus tard.",
      undefined,
      options,
    );
  }

  if (cause instanceof GeminiHttpError) {
    return new AppError(
      502,
      "GEMINI_UNAVAILABLE",
      "Le service d'analyse vocale est indisponible, réessayez plus tard.",
      undefined,
      options,
    );
  }

  if (cause instanceof GeminiNetworkError) {
    return new AppError(
      502,
      "GEMINI_UNREACHABLE",
      "Impossible de contacter le service d'analyse vocale, réessayez.",
      undefined,
      options,
    );
  }

  if (cause instanceof GeminiFormatError) {
    return new AppError(
      502,
      "GEMINI_INVALID_RESPONSE",
      "L'analyse vocale a renvoyé une réponse inattendue, réessayez.",
      undefined,
      options,
    );
  }

  return new AppError(
    500,
    "GEMINI_ANALYSIS_FAILED",
    "L'analyse vocale a échoué, réessayez.",
    undefined,
    options,
  );
}

export function buildParsedIngredients(
  geminiIngredients: GeminiIngredient[],
  existingNames: ReadonlySet<string>,
): ParsedIngredient[] {
  return geminiIngredients.map((ingredient) => {
    const name = normalizeName(ingredient.name);
    return {
      name,
      present: ingredient.present,
      isNew: !existingNames.has(name),
      storage: ingredient.storage,
    };
  });
}

export async function parseTranscript(
  db: Database.Database,
  householdId: string,
  transcript: string,
  geminiApiKey: string,
): Promise<ParsedIngredient[]> {
  checkGeminiRateLimit(householdId);

  let geminiIngredients: GeminiIngredient[];
  try {
    geminiIngredients = await callGemini(transcript, geminiApiKey);
  } catch (error) {
    throw geminiAnalysisFailedError(error);
  }

  recordGeminiCall(householdId);

  const existingNames = new Set(listIngredients(db, householdId).map((ingredient) => ingredient.name));

  return buildParsedIngredients(geminiIngredients, existingNames);
}
