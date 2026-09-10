import type Database from "better-sqlite3";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoUint8Array, isoBase64URL } from "@simplewebauthn/server/helpers";
import { AppError } from "../errors.js";
import { generateId } from "./uuid.js";

const CHALLENGE_TTL_MS = 2 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface UserRow {
  id: string;
  household_id: string;
  name: string;
}

export interface WebauthnRpConfig {
  rpId: string;
  rpName: string;
  origin: string;
}

export async function createRegistrationOptions(
  db: Database.Database,
  rp: WebauthnRpConfig,
  input: { userId: string; displayName: string },
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const user = db
    .prepare("SELECT id, household_id, name FROM users WHERE id = ?")
    .get(input.userId) as UserRow | undefined;

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "Utilisateur introuvable.");
  }

  const options = await generateRegistrationOptions({
    rpName: rp.rpName,
    rpID: rp.rpId,
    userName: input.displayName,
    userID: isoUint8Array.fromUTF8String(user.id),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  });

  const now = Date.now();
  db.prepare(
    "INSERT INTO webauthn_challenges (id, challenge, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(
    generateId(),
    options.challenge,
    user.id,
    new Date(now + CHALLENGE_TTL_MS).toISOString(),
    new Date(now).toISOString(),
  );

  return options;
}

export interface VerifyRegistrationResult {
  userId: string;
  householdId: string;
  sessionId: string;
  sessionExpiresAt: Date;
}

export async function verifyRegistration(
  db: Database.Database,
  rp: WebauthnRpConfig,
  input: { credential: RegistrationResponseJSON; deviceName: string },
): Promise<VerifyRegistrationResult> {
  let clientChallenge: string;
  try {
    const clientData = JSON.parse(
      isoBase64URL.toUTF8String(input.credential.response.clientDataJSON),
    ) as { challenge: string };
    clientChallenge = clientData.challenge;
  } catch {
    throw new AppError(
      400,
      "CHALLENGE_EXPIRED_OR_INVALID",
      "Le challenge WebAuthn a expiré ou est invalide.",
    );
  }

  const challengeRow = db
    .prepare(
      "SELECT id, challenge, user_id, expires_at FROM webauthn_challenges WHERE challenge = ?",
    )
    .get(clientChallenge) as
    | { id: string; challenge: string; user_id: string | null; expires_at: string }
    | undefined;

  if (
    !challengeRow ||
    !challengeRow.user_id ||
    new Date(challengeRow.expires_at).getTime() < Date.now()
  ) {
    throw new AppError(
      410,
      "CHALLENGE_EXPIRED_OR_INVALID",
      "Le challenge WebAuthn a expiré ou est invalide.",
    );
  }

  const user = db
    .prepare("SELECT id, household_id, name FROM users WHERE id = ?")
    .get(challengeRow.user_id) as UserRow | undefined;

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "Utilisateur introuvable.");
  }

  const existingCredential = db
    .prepare("SELECT id FROM credentials WHERE credential_id = ?")
    .get(input.credential.id) as { id: string } | undefined;

  if (existingCredential) {
    throw new AppError(
      409,
      "CREDENTIAL_ALREADY_REGISTERED",
      "Cette passkey est déjà enregistrée.",
    );
  }

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response: input.credential,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpId,
    });
  } catch (error) {
    throw new AppError(
      400,
      "CHALLENGE_EXPIRED_OR_INVALID",
      "La vérification de la passkey a échoué.",
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw new AppError(
      400,
      "CHALLENGE_EXPIRED_OR_INVALID",
      "La vérification de la passkey a échoué.",
    );
  }

  const { credential } = verification.registrationInfo;
  const now = new Date();

  db.transaction(() => {
    db.prepare(
      "INSERT INTO credentials (id, user_id, credential_id, public_key, counter, device_name, transports, created_at, updated_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      generateId(),
      user.id,
      credential.id,
      isoBase64URL.fromBuffer(credential.publicKey),
      credential.counter,
      input.deviceName,
      JSON.stringify(credential.transports ?? []),
      now.toISOString(),
      now.toISOString(),
      now.toISOString(),
    );

    db.prepare("DELETE FROM webauthn_challenges WHERE id = ?").run(challengeRow.id);
  })();

  const sessionId = generateId();
  const sessionExpiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  db.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
  ).run(sessionId, user.id, now.toISOString(), sessionExpiresAt.toISOString(), now.toISOString());

  return {
    userId: user.id,
    householdId: user.household_id,
    sessionId,
    sessionExpiresAt,
  };
}
