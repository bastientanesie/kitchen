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
    verifyAuthenticationResponse: vi.fn(async () => ({
      verified: true,
      authenticationInfo: {
        newCounter: 1,
      },
    })),
  };
});

async function registerHouseholdWithPasskey(app: FastifyInstance) {
  const householdResponse = await app.inject({
    method: "POST",
    url: "/households",
    payload: { name: "Foyer Dupont", displayName: "Alex" },
  });
  const { userId, householdId, enrollmentToken } = householdResponse.json();

  const optionsResponse = await app.inject({
    method: "POST",
    url: "/auth/webauthn/register/options",
    payload: { enrollmentToken, displayName: "Alex" },
  });
  const options = optionsResponse.json();

  const clientDataJSON = isoBase64URL.fromUTF8String(
    JSON.stringify({ type: "webauthn.create", challenge: options.challenge, origin: app.config.origin }),
  );

  await app.inject({
    method: "POST",
    url: "/auth/webauthn/register/verify",
    payload: {
      enrollmentToken,
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

  return { userId, householdId };
}

describe("Passkey login (issue #29)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ databasePath: ":memory:" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("logs an existing owner back in via login/options -> login/verify", async () => {
    const { userId, householdId } = await registerHouseholdWithPasskey(app);

    const optionsResponse = await app.inject({
      method: "POST",
      url: "/auth/webauthn/login/options",
    });

    expect(optionsResponse.statusCode).toBe(200);
    const options = optionsResponse.json();
    expect(options.challenge).toBeTruthy();
    expect(options.allowCredentials ?? []).toEqual([]);

    const clientDataJSON = isoBase64URL.fromUTF8String(
      JSON.stringify({ type: "webauthn.get", challenge: options.challenge, origin: app.config.origin }),
    );

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/auth/webauthn/login/verify",
      payload: {
        credential: {
          id: "mock-credential-id",
          rawId: "mock-credential-id",
          type: "public-key",
          clientExtensionResults: {},
          response: {
            clientDataJSON,
            authenticatorData: isoBase64URL.fromUTF8String("authenticator-data"),
            signature: isoBase64URL.fromUTF8String("signature"),
          },
        },
      },
    });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json()).toEqual({ userId, householdId });

    const sessionCookie = verifyResponse.cookies.find((cookie) => cookie.name === "session");
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie?.httpOnly).toBe(true);

    const credentialRow = app.db
      .prepare("SELECT counter, last_used_at FROM credentials WHERE credential_id = ?")
      .get("mock-credential-id") as { counter: number; last_used_at: string };
    expect(credentialRow.counter).toBe(1);
    expect(credentialRow.last_used_at).toBeTruthy();
  });

  it("rejects login for a credential the server does not know", async () => {
    await registerHouseholdWithPasskey(app);

    const optionsResponse = await app.inject({
      method: "POST",
      url: "/auth/webauthn/login/options",
    });
    const options = optionsResponse.json();

    const clientDataJSON = isoBase64URL.fromUTF8String(
      JSON.stringify({ type: "webauthn.get", challenge: options.challenge, origin: app.config.origin }),
    );

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/auth/webauthn/login/verify",
      payload: {
        credential: {
          id: "deleted-credential-id",
          rawId: "deleted-credential-id",
          type: "public-key",
          clientExtensionResults: {},
          response: {
            clientDataJSON,
            authenticatorData: isoBase64URL.fromUTF8String("authenticator-data"),
            signature: isoBase64URL.fromUTF8String("signature"),
          },
        },
      },
    });

    expect(verifyResponse.statusCode).toBe(404);
    expect(verifyResponse.json().code).toBe("CREDENTIAL_NOT_FOUND");
  });

  it("rejects login with an unknown or expired challenge", async () => {
    await registerHouseholdWithPasskey(app);

    const clientDataJSON = isoBase64URL.fromUTF8String(
      JSON.stringify({ type: "webauthn.get", challenge: "not-the-real-challenge", origin: app.config.origin }),
    );

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/auth/webauthn/login/verify",
      payload: {
        credential: {
          id: "mock-credential-id",
          rawId: "mock-credential-id",
          type: "public-key",
          clientExtensionResults: {},
          response: {
            clientDataJSON,
            authenticatorData: isoBase64URL.fromUTF8String("authenticator-data"),
            signature: isoBase64URL.fromUTF8String("signature"),
          },
        },
      },
    });

    expect(verifyResponse.statusCode).toBe(410);
    expect(verifyResponse.json().code).toBe("CHALLENGE_EXPIRED_OR_INVALID");
  });
});
