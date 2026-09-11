import type Database from "better-sqlite3";
import { AppError } from "../errors.js";
import { generateId } from "./uuid.js";
import type {
  CreateIngredientInput,
  PatchIngredientBody,
  Storage,
} from "../schemas/ingredients.js";

interface IngredientRow {
  id: string;
  name: string;
  present: number;
  storage: Storage;
}

export interface Ingredient {
  id: string;
  name: string;
  present: boolean;
  storage: Storage;
}

function toIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    name: row.name,
    present: row.present === 1,
    storage: row.storage,
  };
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function duplicateNameError(): AppError {
  return new AppError(409, "DUPLICATE_NAME", "Un ingrédient porte déjà ce nom dans ce foyer.");
}

function ingredientNotFoundError(): AppError {
  return new AppError(404, "INGREDIENT_NOT_FOUND", "Ingrédient introuvable.");
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

export function listIngredients(db: Database.Database, householdId: string): Ingredient[] {
  const rows = db
    .prepare("SELECT id, name, present, storage FROM ingredients WHERE household_id = ? ORDER BY name")
    .all(householdId) as IngredientRow[];

  return rows.map(toIngredient);
}

export function createIngredients(
  db: Database.Database,
  householdId: string,
  inputs: CreateIngredientInput[],
): Ingredient[] {
  const insert = db.prepare(
    "INSERT INTO ingredients (id, household_id, name, present, storage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const now = new Date().toISOString();

  const created: Ingredient[] = [];

  runOrDuplicateNameError(() =>
    db.transaction(() => {
      for (const input of inputs) {
        const id = generateId();
        const name = normalizeName(input.name);
        insert.run(id, householdId, name, input.present ? 1 : 0, input.storage, now, now);
        created.push({ id, name, present: input.present, storage: input.storage });
      }
    })(),
  );

  return created;
}

export function updateIngredient(
  db: Database.Database,
  householdId: string,
  ingredientId: string,
  patch: PatchIngredientBody,
): Ingredient {
  const existing = db
    .prepare("SELECT id, name, present, storage FROM ingredients WHERE id = ? AND household_id = ?")
    .get(ingredientId, householdId) as IngredientRow | undefined;

  if (!existing) {
    throw ingredientNotFoundError();
  }

  const name = patch.name !== undefined ? normalizeName(patch.name) : existing.name;
  const present = patch.present !== undefined ? (patch.present ? 1 : 0) : existing.present;
  const storage = patch.storage !== undefined ? patch.storage : existing.storage;
  const now = new Date().toISOString();

  runOrDuplicateNameError(() =>
    db
      .prepare("UPDATE ingredients SET name = ?, present = ?, storage = ?, updated_at = ? WHERE id = ?")
      .run(name, present, storage, now, ingredientId),
  );

  return { id: ingredientId, name, present: present === 1, storage };
}

export function deleteIngredient(
  db: Database.Database,
  householdId: string,
  ingredientId: string,
): void {
  const result = db
    .prepare("DELETE FROM ingredients WHERE id = ? AND household_id = ?")
    .run(ingredientId, householdId);

  if (result.changes === 0) {
    throw ingredientNotFoundError();
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code: string }).code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}
