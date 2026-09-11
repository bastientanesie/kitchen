import { createHash, randomBytes } from "node:crypto";
import type Database from "better-sqlite3";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { isoUint8Array, isoBase64URL } from "@simplewebauthn/server/helpers";
import { AppError } from "../errors.js";
import { generateId } from "./uuid.js";
import { resolveInvitationUserId } from "./invitations.js";
import { peekDeviceLinkUserId, consumeDeviceLinkToken } from "./device-link.js";

const CHALLENGE_TTL_MS = 2 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ENROLLMENT_TOKEN_TTL_MS = 10 * 60 * 1000;

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

export interface EnrollmentAuthorization {
  enrollmentToken?: string;
  sessionId?: string;
  invitationToken?: string;
  deviceLinkToken?: string;
}

function hashEnrollmentToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createEnrollmentToken(db: Database.Database, userId: string): string {
  const token = randomBytes(16).toString("base64url");
  const now = new Date();
  db.prepare(
    "INSERT INTO enrollment_tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).run(
    hashEnrollmentToken(token),
    userId,
    new Date(now.getTime() + ENROLLMENT_TOKEN_TTL_MS).toISOString(),
    now.toISOString(),
  );
  return token;
}

function peekEnrollmentToken(db: Database.Database, token: string): string {
  const row = db
    .prepare("SELECT user_id, expires_at FROM enrollment_tokens WHERE token_hash = ?")
    .get(hashEnrollmentToken(token)) as { user_id: string; expires_at: string } | undefined;

  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    throw new AppError(
      401,
      "ENROLLMENT_TOKEN_INVALID",
      "Le jeton d'enrôlement est invalide ou a expiré.",
    );
  }

  return row.user_id;
}

function consumeEnrollmentToken(db: Database.Database, token: string): string {
  const userId = peekEnrollmentToken(db, token);
  db.prepare("DELETE FROM enrollment_tokens WHERE token_hash = ?").run(hashEnrollmentToken(token));
  return userId;
}

function resolveSessionUserId(db: Database.Database, sessionId: string): string {
  const row = db
    .prepare("SELECT user_id, expires_at FROM sessions WHERE id = ?")
    .get(sessionId) as { user_id: string; expires_at: string } | undefined;

  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    throw new AppError(401, "UNAUTHENTICATED", "Session invalide ou expirée.");
  }

  return row.user_id;
}

export interface AuthenticatedSession {
  userId: string;
  householdId: string;
}

export function resolveSession(
  db: Database.Database,
  sessionId: string | undefined,
): AuthenticatedSession {
  if (!sessionId) {
    throw new AppError(401, "UNAUTHENTICATED", "Session invalide ou expirée.");
  }

  const userId = resolveSessionUserId(db, sessionId);
  const user = db.prepare("SELECT household_id FROM users WHERE id = ?").get(userId) as
    | { household_id: string }
    | undefined;

  if (!user) {
    throw new AppError(401, "UNAUTHENTICATED", "Session invalide ou expirée.");
  }

  return { userId, householdId: user.household_id };
}

function resolveEnrollmentUserId(
  db: Database.Database,
  auth: EnrollmentAuthorization,
  displayName?: string,
): string {
  if (auth.sessionId) {
    return resolveSessionUserId(db, auth.sessionId);
  }
  if (auth.invitationToken) {
    return resolveInvitationUserId(db, auth.invitationToken, displayName);
  }
  if (auth.enrollmentToken) {
    return peekEnrollmentToken(db, auth.enrollmentToken);
  }
  if (auth.deviceLinkToken) {
    return peekDeviceLinkUserId(db, auth.deviceLinkToken);
  }
  throw new AppError(
    401,
    "ENROLLMENT_UNAUTHORIZED",
    "Un jeton d'enrôlement ou une session authentifiée est requis.",
  );
}

export async function createRegistrationOptions(
  db: Database.Database,
  rp: WebauthnRpConfig,
  input: EnrollmentAuthorization & { displayName: string },
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const userId = resolveEnrollmentUserId(db, input, input.displayName);
  const user = db
    .prepare("SELECT id, household_id, name FROM users WHERE id = ?")
    .get(userId) as UserRow | undefined;

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
  input: EnrollmentAuthorization & { credential: RegistrationResponseJSON; deviceName: string },
): Promise<VerifyRegistrationResult> {
  const authorizedUserId = resolveEnrollmentUserId(db, input);

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
    new Date(challengeRow.expires_at).getTime() < Date.now() ||
    challengeRow.user_id !== authorizedUserId
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

    if (input.enrollmentToken) {
      consumeEnrollmentToken(db, input.enrollmentToken);
    }

    if (input.deviceLinkToken) {
      consumeDeviceLinkToken(db, input.deviceLinkToken, input.deviceName);
    }
  })();

  const session = createSession(db, user.id, now);

  return {
    userId: user.id,
    householdId: user.household_id,
    ...session,
  };
}

function createSession(
  db: Database.Database,
  userId: string,
  now: Date,
): { sessionId: string; sessionExpiresAt: Date } {
  const sessionId = randomBytes(32).toString("base64url");
  const sessionExpiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  db.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
  ).run(sessionId, userId, now.toISOString(), sessionExpiresAt.toISOString(), now.toISOString());
  return { sessionId, sessionExpiresAt };
}

interface CredentialRow {
  id: string;
  user_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
}

export async function createAuthenticationOptions(
  db: Database.Database,
  rp: WebauthnRpConfig,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const options = await generateAuthenticationOptions({
    rpID: rp.rpId,
    userVerification: "preferred",
  });

  const now = Date.now();
  db.prepare(
    "INSERT INTO webauthn_challenges (id, challenge, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(
    generateId(),
    options.challenge,
    null,
    new Date(now + CHALLENGE_TTL_MS).toISOString(),
    new Date(now).toISOString(),
  );

  return options;
}

export interface VerifyAuthenticationResult {
  userId: string;
  householdId: string;
  sessionId: string;
  sessionExpiresAt: Date;
}

export async function verifyAuthentication(
  db: Database.Database,
  rp: WebauthnRpConfig,
  input: { credential: AuthenticationResponseJSON },
): Promise<VerifyAuthenticationResult> {
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
    .prepare("SELECT id, challenge, expires_at FROM webauthn_challenges WHERE challenge = ?")
    .get(clientChallenge) as { id: string; challenge: string; expires_at: string } | undefined;

  if (!challengeRow || new Date(challengeRow.expires_at).getTime() < Date.now()) {
    throw new AppError(
      410,
      "CHALLENGE_EXPIRED_OR_INVALID",
      "Le challenge WebAuthn a expiré ou est invalide.",
    );
  }

  const credentialRow = db
    .prepare(
      "SELECT id, user_id, public_key, counter, transports FROM credentials WHERE credential_id = ?",
    )
    .get(input.credential.id) as CredentialRow | undefined;

  if (!credentialRow) {
    throw new AppError(
      404,
      "CREDENTIAL_NOT_FOUND",
      "Cette passkey n'est pas reconnue par le serveur.",
    );
  }

  const user = db
    .prepare("SELECT id, household_id, name FROM users WHERE id = ?")
    .get(credentialRow.user_id) as UserRow | undefined;

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "Utilisateur introuvable.");
  }

  let verification: VerifiedAuthenticationResponse;
  try {
    verification = await verifyAuthenticationResponse({
      response: input.credential,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpId,
      credential: {
        id: input.credential.id,
        publicKey: isoBase64URL.toBuffer(credentialRow.public_key),
        counter: credentialRow.counter,
        transports: credentialRow.transports
          ? (JSON.parse(credentialRow.transports) as AuthenticatorTransportFuture[])
          : undefined,
      },
    });
  } catch {
    throw new AppError(400, "AUTHENTICATION_FAILED", "La vérification de la passkey a échoué.");
  }

  if (!verification.verified) {
    throw new AppError(400, "AUTHENTICATION_FAILED", "La vérification de la passkey a échoué.");
  }

  const now = new Date();

  db.transaction(() => {
    db.prepare(
      "UPDATE credentials SET counter = ?, updated_at = ?, last_used_at = ? WHERE id = ?",
    ).run(
      verification.authenticationInfo.newCounter,
      now.toISOString(),
      now.toISOString(),
      credentialRow.id,
    );
    db.prepare("DELETE FROM webauthn_challenges WHERE id = ?").run(challengeRow.id);
  })();

  const session = createSession(db, user.id, now);

  return {
    userId: user.id,
    householdId: user.household_id,
    ...session,
  };
}
