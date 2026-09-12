import type Database from "better-sqlite3";
import { AppError } from "../errors.js";
import { generateId } from "./uuid.js";
import { createEnrollmentToken } from "./auth.js";
import { seedDefaultCookingModes } from "./cooking-modes.js";
import { createInvitation, type CreateInvitationResult } from "./invitations.js";

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
    seedDefaultCookingModes(db, householdId);
    enrollmentToken = createEnrollmentToken(db, userId);
  })();

  return { householdId, userId, enrollmentToken };
}

export interface CreateHouseholdForUserResult {
  householdId: string;
  invitationToken: string;
  invitationExpiresAt: Date;
}

export function createHouseholdForUser(
  db: Database.Database,
  userId: string,
  input: { name: string },
): CreateHouseholdForUserResult {
  const currentUser = db
    .prepare("SELECT household_id FROM users WHERE id = ?")
    .get(userId) as { household_id: string };
  const otherMemberCount = (
    db
      .prepare("SELECT COUNT(*) as count FROM users WHERE household_id = ? AND id != ?")
      .get(currentUser.household_id, userId) as { count: number }
  ).count;

  if (otherMemberCount > 0) {
    throw new AppError(
      409,
      "HOUSEHOLD_NOT_EMPTY",
      "Vous ne pouvez pas créer un nouveau foyer tant que d'autres membres font partie du vôtre.",
    );
  }

  const householdId = generateId();
  const now = new Date().toISOString();

  const insertHousehold = db.prepare(
    "INSERT INTO households (id, name, preferences, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)",
  );
  const attachUser = db.prepare(
    "UPDATE users SET household_id = ?, role = 'owner', updated_at = ? WHERE id = ?",
  );

  let invitation: CreateInvitationResult | undefined;
  db.transaction(() => {
    insertHousehold.run(householdId, input.name, now, now);
    attachUser.run(householdId, now, userId);
    seedDefaultCookingModes(db, householdId);
    invitation = createInvitation(db, householdId);
  })();

  return {
    householdId,
    invitationToken: invitation!.token,
    invitationExpiresAt: invitation!.expiresAt,
  };
}

export interface HouseholdSummary {
  householdId: string;
  name: string;
}

export function getHouseholdSummary(db: Database.Database, householdId: string): HouseholdSummary {
  const row = db.prepare("SELECT name FROM households WHERE id = ?").get(householdId) as {
    name: string;
  };

  return { householdId, name: row.name };
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
