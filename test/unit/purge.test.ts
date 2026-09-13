import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createDatabase } from "../../src/db/index.js";
import { purgeExpired } from "../../src/services/purge.js";
import { generateId } from "../../src/services/uuid.js";

const HOUR_MS = 60 * 60 * 1000;

function insertHousehold(db: Database.Database): string {
  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO households (id, name, preferences, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)",
  ).run(id, "Foyer", now, now);
  return id;
}

function insertUser(db: Database.Database, householdId: string, createdAt: Date): string {
  const id = generateId();
  db.prepare(
    "INSERT INTO users (id, household_id, name, role, created_at, updated_at) VALUES (?, ?, 'member', 'member', ?, ?)",
  ).run(id, householdId, createdAt.toISOString(), createdAt.toISOString());
  return id;
}

function insertCredential(db: Database.Database, userId: string): void {
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO credentials (id, user_id, credential_id, public_key, counter, device_name, transports, created_at, updated_at, last_used_at) VALUES (?, ?, ?, 'key', 0, 'device', NULL, ?, ?, ?)",
  ).run(generateId(), userId, generateId(), now, now, now);
}

describe("purgeExpired (issue #32)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("removes expired invitations, device-link tokens, and webauthn challenges", () => {
    const householdId = insertHousehold(db);
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + HOUR_MS).toISOString();
    const now = new Date().toISOString();
    const ownerId = insertUser(db, householdId, new Date());
    insertCredential(db, ownerId);

    db.prepare(
      "INSERT INTO invitations (token_hash, household_id, expires_at, consumed_at, consumed_by_user_id, created_at) VALUES ('expired', ?, ?, NULL, NULL, ?)",
    ).run(householdId, past, now);
    db.prepare(
      "INSERT INTO invitations (token_hash, household_id, expires_at, consumed_at, consumed_by_user_id, created_at) VALUES ('alive', ?, ?, NULL, NULL, ?)",
    ).run(householdId, future, now);

    db.prepare(
      "INSERT INTO device_link_tokens (token_hash, user_id, expires_at, used_at, device_name, created_at) VALUES ('expired', ?, ?, NULL, NULL, ?)",
    ).run(ownerId, past, now);
    db.prepare(
      "INSERT INTO device_link_tokens (token_hash, user_id, expires_at, used_at, device_name, created_at) VALUES ('alive', ?, ?, NULL, NULL, ?)",
    ).run(ownerId, future, now);

    db.prepare(
      "INSERT INTO webauthn_challenges (id, challenge, user_id, expires_at, created_at) VALUES ('expired', 'c1', ?, ?, ?)",
    ).run(ownerId, past, now);
    db.prepare(
      "INSERT INTO webauthn_challenges (id, challenge, user_id, expires_at, created_at) VALUES ('alive', 'c2', ?, ?, ?)",
    ).run(ownerId, future, now);

    purgeExpired(db);

    expect(
      db.prepare("SELECT token_hash FROM invitations").all().map((r: any) => r.token_hash),
    ).toEqual(["alive"]);
    expect(
      db.prepare("SELECT token_hash FROM device_link_tokens").all().map((r: any) => r.token_hash),
    ).toEqual(["alive"]);
    expect(
      db.prepare("SELECT id FROM webauthn_challenges").all().map((r: any) => r.id),
    ).toEqual(["alive"]);
  });

  it("removes orphaned users older than 1h without ever completing WebAuthn ceremony", () => {
    const householdId = insertHousehold(db);
    const oldOrphanId = insertUser(db, householdId, new Date(Date.now() - 2 * HOUR_MS));
    const recentOrphanId = insertUser(db, householdId, new Date());
    const memberId = insertUser(db, householdId, new Date(Date.now() - 2 * HOUR_MS));
    insertCredential(db, memberId);

    purgeExpired(db);

    const remainingIds = db
      .prepare("SELECT id FROM users")
      .all()
      .map((r: any) => r.id);

    expect(remainingIds).not.toContain(oldOrphanId);
    expect(remainingIds).toContain(recentOrphanId);
    expect(remainingIds).toContain(memberId);
  });

  it("never counts an orphaned user as a member, purged or not", () => {
    const householdId = insertHousehold(db);
    insertUser(db, householdId, new Date());

    const memberCount = (
      db
        .prepare(
          "SELECT COUNT(*) as count FROM users WHERE household_id = ? AND id IN (SELECT user_id FROM credentials)",
        )
        .get(householdId) as { count: number }
    ).count;

    expect(memberCount).toBe(0);
  });

  it("deletes a consumed invitation referencing a purged orphaned user, avoiding a foreign key violation", () => {
    const householdId = insertHousehold(db);
    const orphanId = insertUser(db, householdId, new Date(Date.now() - 2 * HOUR_MS));
    const now = new Date().toISOString();
    const future = new Date(Date.now() + HOUR_MS).toISOString();

    db.prepare(
      "INSERT INTO invitations (token_hash, household_id, expires_at, consumed_at, consumed_by_user_id, created_at) VALUES ('consumed', ?, ?, ?, ?, ?)",
    ).run(householdId, future, now, orphanId, now);

    expect(() => purgeExpired(db)).not.toThrow();

    expect(db.prepare("SELECT id FROM users WHERE id = ?").get(orphanId)).toBeUndefined();
    expect(
      db.prepare("SELECT token_hash FROM invitations WHERE token_hash = 'consumed'").get(),
    ).toBeUndefined();
  });

  it("deletes a live webauthn challenge, enrollment token, device-link token, and session referencing a purged orphaned user, avoiding a foreign key violation", () => {
    const householdId = insertHousehold(db);
    const orphanId = insertUser(db, householdId, new Date(Date.now() - 2 * HOUR_MS));
    const now = new Date().toISOString();
    const future = new Date(Date.now() + HOUR_MS).toISOString();

    db.prepare(
      "INSERT INTO webauthn_challenges (id, challenge, user_id, expires_at, created_at) VALUES ('live', 'c', ?, ?, ?)",
    ).run(orphanId, future, now);
    db.prepare(
      "INSERT INTO enrollment_tokens (token_hash, user_id, expires_at, created_at) VALUES ('live', ?, ?, ?)",
    ).run(orphanId, future, now);
    db.prepare(
      "INSERT INTO device_link_tokens (token_hash, user_id, expires_at, used_at, device_name, created_at) VALUES ('live', ?, ?, NULL, NULL, ?)",
    ).run(orphanId, future, now);
    db.prepare(
      "INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
    ).run(generateId(), orphanId, now, future, now);

    expect(() => purgeExpired(db)).not.toThrow();

    expect(db.prepare("SELECT id FROM users WHERE id = ?").get(orphanId)).toBeUndefined();
    expect(
      db.prepare("SELECT id FROM webauthn_challenges WHERE id = 'live'").get(),
    ).toBeUndefined();
    expect(
      db.prepare("SELECT token_hash FROM enrollment_tokens WHERE token_hash = 'live'").get(),
    ).toBeUndefined();
    expect(
      db.prepare("SELECT token_hash FROM device_link_tokens WHERE token_hash = 'live'").get(),
    ).toBeUndefined();
    expect(
      db.prepare("SELECT id FROM sessions WHERE user_id = ?").get(orphanId),
    ).toBeUndefined();
  });
});
