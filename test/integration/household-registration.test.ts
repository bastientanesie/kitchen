import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { buildApp } from "../../src/app.js";

vi.mock("@simplewebauthn/server", async () => {
  const actual = await vi.importActual<typeof import("@simplewebauthn/server")>(
    "@simplewebauthn/server",
  );
  return {
    ...actual,
    verifyRegistrationResponse: vi.fn(async () => ({
      verified: true,
      registrationInfo: {
        credential: {
          id: "mock-credential-id",
          publicKey: new Uint8Array([1, 2, 3, 4]),
          counter: 0,
          transports: ["internal"],
        },
      },
    })),
  };
});

describe("Household creation + passkey registration (issue #28)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ databasePath: ":memory:" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates a household and opens a session via the full WebAuthn ceremony", async () => {
    const householdResponse = await app.inject({
      method: "POST",
      url: "/households",
      payload: { name: "Foyer Dupont", displayName: "Alex" },
    });

    expect(householdResponse.statusCode).toBe(201);
    const { userId, householdId } = householdResponse.json();
    expect(userId).toBeTruthy();
    expect(householdId).toBeTruthy();

    const optionsResponse = await app.inject({
      method: "POST",
      url: "/auth/webauthn/register/options",
      payload: { userId, displayName: "Alex" },
    });

    expect(optionsResponse.statusCode).toBe(200);
    const options = optionsResponse.json();
    expect(options.challenge).toBeTruthy();
    expect(options.user.name).toBe("Alex");

    const clientDataJSON = isoBase64URL.fromUTF8String(
      JSON.stringify({
        type: "webauthn.create",
        challenge: options.challenge,
        origin: app.config.origin,
      }),
    );

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/auth/webauthn/register/verify",
      payload: {
        credential: {
          id: "mock-credential-id",
          rawId: "mock-credential-id",
          type: "public-key",
          clientExtensionResults: {},
          response: {
            clientDataJSON,
            attestationObject: isoBase64URL.fromUTF8String("attestation"),
          },
        },
        deviceName: "iPhone de Alex",
      },
    });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json()).toEqual({ userId, householdId });

    const cookies = verifyResponse.cookies;
    const sessionCookie = cookies.find((cookie) => cookie.name === "session");
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie?.httpOnly).toBe(true);

    const householdRow = app.db
      .prepare("SELECT id, name FROM households WHERE id = ?")
      .get(householdId) as { id: string; name: string };
    expect(householdRow.name).toBe("Foyer Dupont");

    const userRow = app.db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as {
      role: string;
    };
    expect(userRow.role).toBe("owner");

    const credentialRow = app.db
      .prepare("SELECT user_id, device_name FROM credentials WHERE credential_id = ?")
      .get("mock-credential-id") as { user_id: string; device_name: string };
    expect(credentialRow.user_id).toBe(userId);
    expect(credentialRow.device_name).toBe("iPhone de Alex");

    const sessionRow = app.db
      .prepare("SELECT user_id FROM sessions WHERE id = ?")
      .get(sessionCookie?.value) as { user_id: string } | undefined;
    expect(sessionRow?.user_id).toBe(userId);

    const remainingChallenges = app.db
      .prepare("SELECT COUNT(*) as count FROM webauthn_challenges")
      .get() as { count: number };
    expect(remainingChallenges.count).toBe(0);
  });

  it("rejects registration with an unknown or expired challenge", async () => {
    const householdResponse = await app.inject({
      method: "POST",
      url: "/households",
      payload: { name: "Foyer Martin", displayName: "Sam" },
    });
    const { userId } = householdResponse.json();

    await app.inject({
      method: "POST",
      url: "/auth/webauthn/register/options",
      payload: { userId, displayName: "Sam" },
    });

    const clientDataJSON = isoBase64URL.fromUTF8String(
      JSON.stringify({
        type: "webauthn.create",
        challenge: "not-the-real-challenge",
        origin: app.config.origin,
      }),
    );

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/auth/webauthn/register/verify",
      payload: {
        credential: {
          id: "another-credential-id",
          rawId: "another-credential-id",
          type: "public-key",
          clientExtensionResults: {},
          response: {
            clientDataJSON,
            attestationObject: isoBase64URL.fromUTF8String("attestation"),
          },
        },
        deviceName: "PC bureau",
      },
    });

    expect(verifyResponse.statusCode).toBe(410);
    expect(verifyResponse.json().code).toBe("CHALLENGE_EXPIRED_OR_INVALID");
  });
});
