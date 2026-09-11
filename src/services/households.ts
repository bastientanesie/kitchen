import type Database from "better-sqlite3";
import { generateId } from "./uuid.js";
import { createEnrollmentToken } from "./auth.js";

export interface CreateHouseholdInput {
  name: string;
  displayName: string;
}

export interface CreateHouseholdResult {
  householdId: string;
  userId: string;
  enrollmentToken: string;
}

export function createHousehold(
  db: Database.Database,
  input: CreateHouseholdInput,
): CreateHouseholdResult {
  const householdId = generateId();
  const userId = generateId();
  const now = new Date().toISOString();

  const insertHousehold = db.prepare(
    "INSERT INTO households (id, name, preferences, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)",
  );
  const insertUser = db.prepare(
    "INSERT INTO users (id, household_id, name, role, created_at, updated_at) VALUES (?, ?, ?, 'owner', ?, ?)",
  );

  let enrollmentToken = "";
  db.transaction(() => {
    insertHousehold.run(householdId, input.name, now, now);
    insertUser.run(userId, householdId, input.displayName, now, now);
    enrollmentToken = createEnrollmentToken(db, userId);
  })();

  return { householdId, userId, enrollmentToken };
}

export function getHouseholdPreferences(
  db: Database.Database,
  householdId: string,
): string | null {
  const row = db
    .prepare("SELECT preferences FROM households WHERE id = ?")
    .get(householdId) as { preferences: string | null } | undefined;

  return row?.preferences ?? null;
}

export function updateHouseholdPreferences(
  db: Database.Database,
  householdId: string,
  preferences: string,
): string | null {
  const normalized = preferences === "" ? null : preferences;
  const now = new Date().toISOString();

  db.prepare("UPDATE households SET preferences = ?, updated_at = ? WHERE id = ?").run(
    normalized,
    now,
    householdId,
  );

  return normalized;
}
