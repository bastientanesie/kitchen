import type Database from "better-sqlite3";
import { AppError } from "../errors.js";
import { generateId } from "./uuid.js";
import type { CreateCookingModeInput, PatchCookingModeBody } from "../schemas/cooking-modes.js";

interface CookingModeRow {
  id: string;
  name: string;
  present: number;
}

export interface CookingMode {
  id: string;
  name: string;
  present: boolean;
}

export const DEFAULT_COOKING_MODES = ["casserole", "poêle", "four", "micro-ondes"];

function toCookingMode(row: CookingModeRow): CookingMode {
  return { id: row.id, name: row.name, present: row.present === 1 };
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function duplicateNameError(): AppError {
  return new AppError(409, "DUPLICATE_NAME", "Un mode de cuisson porte déjà ce nom dans ce foyer.");
}

function cookingModeNotFoundError(): AppError {
  return new AppError(404, "COOKING_MODE_NOT_FOUND", "Mode de cuisson introuvable.");
}

function runOrDuplicateNameError<T>(write: () => T): T {
  try {
    return write();
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw duplicateNameError();
    }
    throw error;
  }
}

export function seedDefaultCookingModes(
  db: Database.Database,
  householdId: string,
): void {
  const insert = db.prepare(
    "INSERT INTO cooking_modes (id, household_id, name, present, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
  );
  const now = new Date().toISOString();

  for (const name of DEFAULT_COOKING_MODES) {
    insert.run(generateId(), householdId, normalizeName(name), now, now);
  }
}

export function listCookingModes(db: Database.Database, householdId: string): CookingMode[] {
  const rows = db
    .prepare("SELECT id, name, present FROM cooking_modes WHERE household_id = ? ORDER BY name")
    .all(householdId) as CookingModeRow[];

  return rows.map(toCookingMode);
}

export function createCookingModes(
  db: Database.Database,
  householdId: string,
  inputs: CreateCookingModeInput[],
): CookingMode[] {
  const insert = db.prepare(
    "INSERT INTO cooking_modes (id, household_id, name, present, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const now = new Date().toISOString();

  const created: CookingMode[] = [];

  runOrDuplicateNameError(() =>
    db.transaction(() => {
      for (const input of inputs) {
        const id = generateId();
        const name = normalizeName(input.name);
        insert.run(id, householdId, name, input.present ? 1 : 0, now, now);
        created.push({ id, name, present: input.present });
      }
    })(),
  );

  return created;
}

export function updateCookingMode(
  db: Database.Database,
  householdId: string,
  cookingModeId: string,
  patch: PatchCookingModeBody,
): CookingMode {
  const existing = db
    .prepare("SELECT id, name, present FROM cooking_modes WHERE id = ? AND household_id = ?")
    .get(cookingModeId, householdId) as CookingModeRow | undefined;

  if (!existing) {
    throw cookingModeNotFoundError();
  }

  const name = patch.name !== undefined ? normalizeName(patch.name) : existing.name;
  const present = patch.present !== undefined ? (patch.present ? 1 : 0) : existing.present;
  const now = new Date().toISOString();

  runOrDuplicateNameError(() =>
    db
      .prepare("UPDATE cooking_modes SET name = ?, present = ?, updated_at = ? WHERE id = ?")
      .run(name, present, now, cookingModeId),
  );

  return { id: cookingModeId, name, present: present === 1 };
}

export function deleteCookingMode(
  db: Database.Database,
  householdId: string,
  cookingModeId: string,
): void {
  const result = db
    .prepare("DELETE FROM cooking_modes WHERE id = ? AND household_id = ?")
    .run(cookingModeId, householdId);

  if (result.changes === 0) {
    throw cookingModeNotFoundError();
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code: string }).code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}
