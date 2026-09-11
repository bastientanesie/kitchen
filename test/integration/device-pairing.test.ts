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
    verifyRegistrationResponse: vi.fn(async ({ response }: { response: { id: string } }) => ({
      verified: true,
      registrationInfo: {
        credential: {
          id: response.id,
          publicKey: new Uint8Array([1, 2, 3, 4]),
          counter: 0,
          transports: ["internal"],
        },
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

  const verifyResponse = await app.inject({
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

  const sessionCookie = verifyResponse.cookies.find((cookie) => cookie.name === "session");

  return { userId, householdId, sessionId: sessionCookie!.value };
}

function registerOnNewDevice(
  app: FastifyInstance,
  deviceLinkToken: string,
  credentialId: string,
  deviceName: string,
) {
  return (async () => {
    const optionsResponse = await app.inject({
      method: "POST",
      url: "/auth/webauthn/register/options",
      payload: { deviceLinkToken, displayName: "ignoré" },
    });
    const options = optionsResponse.json();

    const clientDataJSON = isoBase64URL.fromUTF8String(
      JSON.stringify({ type: "webauthn.create", challenge: options.challenge, origin: app.config.origin }),
    );

    return app.inject({
      method: "POST",
      url: "/auth/webauthn/register/verify",
      payload: {
        deviceLinkToken,
        credential: {
          id: credentialId,
          rawId: credentialId,
          type: "public-key",
          clientExtensionResults: {},
          response: {
            clientDataJSON,
            attestationObject: isoBase64URL.fromUTF8String("attestation"),
          },
        },
        deviceName,
      },
    });
  })();
}

describe("Device pairing (issue #31)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ databasePath: ":memory:" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("requires an authenticated session to create a device link token", async () => {
    const response = await app.inject({ method: "POST", url: "/device-pairing/tokens" });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHENTICATED");
  });

  it("creates a device link token with an 8-character code equal to the token", async () => {
    const { sessionId } = await registerHouseholdWithPasskey(app);

    const response = await app.inject({
      method: "POST",
      url: "/device-pairing/tokens",
      cookies: { session: sessionId },
    });

    expect(response.statusCode).toBe(201);
    const { token, code, expiresAt } = response.json();
    expect(token).toBe(code);
    expect(code).toHaveLength(8);
    expect(expiresAt).toBeTruthy();
  });

  it("lets a second device register a new passkey for the same existing user, emitting a paired SSE event", async () => {
    const { sessionId, userId } = await registerHouseholdWithPasskey(app);

    const tokenResponse = await app.inject({
      method: "POST",
      url: "/device-pairing/tokens",
      cookies: { session: sessionId },
    });
    const { token } = tokenResponse.json();

    const [eventsResponse, verifyResponse] = await Promise.all([
      app.inject({
        method: "GET",
        url: `/device-pairing/tokens/${token}/events`,
        cookies: { session: sessionId },
      }),
      registerOnNewDevice(app, token, "second-device-credential", "iPad d'Alex"),
    ]);

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json().userId).toBe(userId);

    expect(eventsResponse.statusCode).toBe(200);
    expect(eventsResponse.payload).toContain("event: paired");
    expect(eventsResponse.payload).toContain("iPad d'Alex");

    const credentialCount = (
      app.db.prepare("SELECT COUNT(*) as count FROM credentials WHERE user_id = ?").get(userId) as {
        count: number;
      }
    ).count;
    expect(credentialCount).toBe(2);
  });

  it("emits an expired SSE event once the token has expired", async () => {
    const { sessionId } = await registerHouseholdWithPasskey(app);

    const tokenResponse = await app.inject({
      method: "POST",
      url: "/device-pairing/tokens",
      cookies: { session: sessionId },
    });
    const { token } = tokenResponse.json();

    app.db
      .prepare(
        "UPDATE device_link_tokens SET expires_at = ? WHERE token_hash = (SELECT token_hash FROM device_link_tokens LIMIT 1)",
      )
      .run(new Date(Date.now() - 1000).toISOString());

    const eventsResponse = await app.inject({
      method: "GET",
      url: `/device-pairing/tokens/${token}/events`,
      cookies: { session: sessionId },
    });

    expect(eventsResponse.statusCode).toBe(200);
    expect(eventsResponse.payload).toContain("event: expired");
  });

  it("returns a uniform 410 DEVICE_LINK_TOKEN_EXPIRED_OR_INVALID for an unknown token", async () => {
    const { sessionId } = await registerHouseholdWithPasskey(app);

    const response = await app.inject({
      method: "GET",
      url: "/device-pairing/tokens/not-a-real-token/events",
      cookies: { session: sessionId },
    });

    expect(response.statusCode).toBe(410);
    expect(response.json().code).toBe("DEVICE_LINK_TOKEN_EXPIRED_OR_INVALID");
  });

  it("returns the same uniform error when a different user tries to read someone else's token events", async () => {
    const { sessionId: ownerSessionId } = await registerHouseholdWithPasskey(app);
    const tokenResponse = await app.inject({
      method: "POST",
      url: "/device-pairing/tokens",
      cookies: { session: ownerSessionId },
    });
    const { token } = tokenResponse.json();

    const otherHouseholdResponse = await app.inject({
      method: "POST",
      url: "/households",
      payload: { name: "Foyer Martin", displayName: "Sam" },
    });
    const { sessionId: otherSessionId } = await (async () => {
      const { enrollmentToken } = otherHouseholdResponse.json();
      const optionsResponse = await app.inject({
        method: "POST",
        url: "/auth/webauthn/register/options",
        payload: { enrollmentToken, displayName: "Sam" },
      });
      const options = optionsResponse.json();
      const clientDataJSON = isoBase64URL.fromUTF8String(
        JSON.stringify({ type: "webauthn.create", challenge: options.challenge, origin: app.config.origin }),
      );
      const verifyResponse = await app.inject({
        method: "POST",
        url: "/auth/webauthn/register/verify",
        payload: {
          enrollmentToken,
          credential: {
            id: "sam-credential-id",
            rawId: "sam-credential-id",
            type: "public-key",
            clientExtensionResults: {},
            response: {
              clientDataJSON,
              attestationObject: isoBase64URL.fromUTF8String("attestation"),
            },
          },
          deviceName: "Téléphone de Sam",
        },
      });
      const sessionCookie = verifyResponse.cookies.find((cookie) => cookie.name === "session");
      return { sessionId: sessionCookie!.value };
    })();

    const response = await app.inject({
      method: "GET",
      url: `/device-pairing/tokens/${token}/events`,
      cookies: { session: otherSessionId },
    });

    expect(response.statusCode).toBe(410);
    expect(response.json().code).toBe("DEVICE_LINK_TOKEN_EXPIRED_OR_INVALID");
  });

  it("does not invalidate a previously issued unused token when a new one is generated", async () => {
    const { sessionId } = await registerHouseholdWithPasskey(app);

    await app.inject({
      method: "POST",
      url: "/device-pairing/tokens",
      cookies: { session: sessionId },
    });
    await app.inject({
      method: "POST",
      url: "/device-pairing/tokens",
      cookies: { session: sessionId },
    });

    const count = (
      app.db.prepare("SELECT COUNT(*) as count FROM device_link_tokens").get() as {
        count: number;
      }
    ).count;
    expect(count).toBe(2);
  });

  it("opportunistically purges expired device-link tokens when a new one is created (issue #32)", async () => {
    const { sessionId, userId } = await registerHouseholdWithPasskey(app);

    app.db
      .prepare(
        "INSERT INTO device_link_tokens (token_hash, user_id, expires_at, used_at, device_name, created_at) VALUES ('stale', ?, ?, NULL, NULL, ?)",
      )
      .run(userId, new Date(Date.now() - 1000).toISOString(), new Date().toISOString());

    await app.inject({
      method: "POST",
      url: "/device-pairing/tokens",
      cookies: { session: sessionId },
    });

    expect(
      app.db.prepare("SELECT token_hash FROM device_link_tokens WHERE token_hash = 'stale'").get(),
    ).toBeUndefined();
  });
});
