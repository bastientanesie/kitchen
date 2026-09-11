import { createHash, randomInt } from "node:crypto";
import type Database from "better-sqlite3";
import { AppError } from "../errors.js";
import { purgeExpired } from "./purge.js";

const DEVICE_LINK_TOKEN_TTL_MS = 5 * 60 * 1000;
const CODE_LENGTH = 8;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function hashDeviceLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export function deviceLinkExpiredError(): AppError {
  return new AppError(
    410,
    "DEVICE_LINK_TOKEN_EXPIRED_OR_INVALID",
    "Ce jeton d'appairage a expiré ou est invalide.",
  );
}

interface DeviceLinkTokenRow {
  user_id: string;
  expires_at: string;
  used_at: string | null;
  device_name: string | null;
}

export interface CreateDeviceLinkTokenResult {
  token: string;
  code: string;
  expiresAt: Date;
}

export function createDeviceLinkToken(
  db: Database.Database,
  userId: string,
): CreateDeviceLinkTokenResult {
  purgeExpired(db);

  const code = generateCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEVICE_LINK_TOKEN_TTL_MS);

  db.prepare(
    "INSERT INTO device_link_tokens (token_hash, user_id, expires_at, used_at, device_name, created_at) VALUES (?, ?, ?, NULL, NULL, ?)",
  ).run(hashDeviceLinkToken(code), userId, expiresAt.toISOString(), now.toISOString());

  return { token: code, code, expiresAt };
}

function getDeviceLinkTokenRow(
  db: Database.Database,
  token: string,
): DeviceLinkTokenRow | undefined {
  return db
    .prepare(
      "SELECT user_id, expires_at, used_at, device_name FROM device_link_tokens WHERE token_hash = ?",
    )
    .get(hashDeviceLinkToken(token)) as DeviceLinkTokenRow | undefined;
}

function isExpired(row: DeviceLinkTokenRow): boolean {
  return new Date(row.expires_at).getTime() < Date.now();
}

export function peekDeviceLinkUserId(db: Database.Database, token: string): string {
  const row = getDeviceLinkTokenRow(db, token);

  if (!row || row.used_at || isExpired(row)) {
    throw deviceLinkExpiredError();
  }

  return row.user_id;
}

export function consumeDeviceLinkToken(
  db: Database.Database,
  token: string,
  deviceName: string,
): string {
  const userId = peekDeviceLinkUserId(db, token);
  db.prepare(
    "UPDATE device_link_tokens SET used_at = ?, device_name = ? WHERE token_hash = ?",
  ).run(new Date().toISOString(), deviceName, hashDeviceLinkToken(token));
  return userId;
}

export type DeviceLinkStatus =
  | { kind: "pending" }
  | { kind: "paired"; deviceName: string }
  | { kind: "expired" };

export function getDeviceLinkStatusForOwner(
  db: Database.Database,
  token: string,
  ownerUserId: string,
): DeviceLinkStatus {
  const row = getDeviceLinkTokenRow(db, token);

  if (!row || row.user_id !== ownerUserId) {
    throw deviceLinkExpiredError();
  }

  if (row.used_at) {
    return { kind: "paired", deviceName: row.device_name ?? "" };
  }

  if (isExpired(row)) {
    return { kind: "expired" };
  }

  return { kind: "pending" };
}
