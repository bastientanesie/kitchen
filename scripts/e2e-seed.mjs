import { randomBytes, randomUUID, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import Database from "better-sqlite3";

const databasePath = process.env.DATABASE_PATH ?? "./data/kitchen.db";
const fixturesPath = process.env.E2E_FIXTURES_PATH ?? "./frontend/e2e/.fixtures.json";

const db = new Database(databasePath);
db.pragma("foreign_keys = ON");

function hash(token) {
  return createHash("sha256").update(token).digest("hex");
}

const now = new Date();
const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

const householdId = randomUUID();
const userId = randomUUID();
const invitationToken = randomBytes(24).toString("base64url");
const deviceLinkToken = randomBytes(24).toString("base64url");

db.transaction(() => {
  db.prepare(
    "INSERT INTO households (id, name, preferences, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)",
  ).run(householdId, "Foyer e2e", now.toISOString(), now.toISOString());

  db.prepare(
    "INSERT INTO users (id, household_id, name, role, created_at, updated_at) VALUES (?, ?, ?, 'member', ?, ?)",
  ).run(userId, householdId, "Membre e2e", now.toISOString(), now.toISOString());

  db.prepare(
    "INSERT INTO invitations (token_hash, household_id, expires_at, consumed_at, consumed_by_user_id, created_at) VALUES (?, ?, ?, NULL, NULL, ?)",
  ).run(hash(invitationToken), householdId, in7Days, now.toISOString());

  db.prepare(
    "INSERT INTO device_link_tokens (token_hash, user_id, expires_at, used_at, device_name, created_at) VALUES (?, ?, ?, NULL, NULL, ?)",
  ).run(hash(deviceLinkToken), userId, in7Days, now.toISOString());
})();

db.close();

writeFileSync(
  fixturesPath,
  JSON.stringify({ householdId, userId, invitationToken, deviceLinkToken }, null, 2),
);

console.log(`Fixtures écrites dans ${fixturesPath}`);
