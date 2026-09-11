import { createHash, randomBytes } from "node:crypto";
import type Database from "better-sqlite3";
import { AppError } from "../errors.js";
import { generateId } from "./uuid.js";
import { purgeExpired } from "./purge.js";

const INVITATION_TOKEN_BYTES = 24;
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function invitationExpiredError(): AppError {
  return new AppError(
    410,
    "INVITATION_EXPIRED_OR_INVALID",
    "Cette invitation a expiré ou est invalide.",
  );
}

interface InvitationRow {
  household_id: string;
  expires_at: string;
  consumed_at: string | null;
  consumed_by_user_id: string | null;
}

export interface CreateInvitationResult {
  token: string;
  expiresAt: Date;
}

export function createInvitation(
  db: Database.Database,
  householdId: string,
): CreateInvitationResult {
  purgeExpired(db);

  const token = randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);

  db.transaction(() => {
    db.prepare("DELETE FROM invitations WHERE household_id = ?").run(householdId);
    db.prepare(
      "INSERT INTO invitations (token_hash, household_id, expires_at, consumed_at, consumed_by_user_id, created_at) VALUES (?, ?, ?, NULL, NULL, ?)",
    ).run(hashInvitationToken(token), householdId, expiresAt.toISOString(), now.toISOString());
  })();

  return { token, expiresAt };
}

export interface InvitationPreview {
  householdName: string;
  memberCount: number;
}

export function peekInvitation(db: Database.Database, token: string): InvitationPreview {
  const row = db
    .prepare(
      "SELECT household_id, expires_at, consumed_at, consumed_by_user_id FROM invitations WHERE token_hash = ?",
    )
    .get(hashInvitationToken(token)) as InvitationRow | undefined;

  if (!row || row.consumed_at || new Date(row.expires_at).getTime() < Date.now()) {
    throw invitationExpiredError();
  }

  const household = db.prepare("SELECT name FROM households WHERE id = ?").get(row.household_id) as {
    name: string;
  };
  const memberCount = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM users WHERE household_id = ? AND id IN (SELECT user_id FROM credentials)",
      )
      .get(row.household_id) as { count: number }
  ).count;

  return { householdName: household.name, memberCount };
}

export function resolveInvitationUserId(
  db: Database.Database,
  token: string,
  displayName?: string,
): string {
  const tokenHash = hashInvitationToken(token);
  const row = db
    .prepare(
      "SELECT household_id, expires_at, consumed_at, consumed_by_user_id FROM invitations WHERE token_hash = ?",
    )
    .get(tokenHash) as InvitationRow | undefined;

  if (!row) {
    throw invitationExpiredError();
  }

  if (row.consumed_at) {
    if (!row.consumed_by_user_id) {
      throw invitationExpiredError();
    }
    return row.consumed_by_user_id;
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw invitationExpiredError();
  }

  if (!displayName) {
    throw new AppError(
      401,
      "ENROLLMENT_UNAUTHORIZED",
      "Un jeton d'enrôlement ou une session authentifiée est requis.",
    );
  }

  const userId = generateId();
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      "INSERT INTO users (id, household_id, name, role, created_at, updated_at) VALUES (?, ?, ?, 'member', ?, ?)",
    ).run(userId, row.household_id, displayName, now, now);
    db.prepare(
      "UPDATE invitations SET consumed_at = ?, consumed_by_user_id = ? WHERE token_hash = ?",
    ).run(now, userId, tokenHash);
  })();

  return userId;
}
