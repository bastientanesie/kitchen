import type Database from "better-sqlite3";
import { AppError } from "../errors.js";
import type { ParsedIngredient } from "../schemas/ingredients.js";
import { callGemini, type GeminiIngredient } from "./gemini-client.js";
import { checkGeminiRateLimit, recordGeminiCall } from "./gemini-rate-limit.js";
import { listIngredients, normalizeName } from "./ingredients.js";

function geminiAnalysisFailedError(): AppError {
  return new AppError(500, "GEMINI_ANALYSIS_FAILED", "L'analyse vocale a échoué, réessayez.");
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
  } catch {
    throw geminiAnalysisFailedError();
  }

  recordGeminiCall(householdId);

  const existingNames = new Set(listIngredients(db, householdId).map((ingredient) => ingredient.name));

  return buildParsedIngredients(geminiIngredients, existingNames);
}
