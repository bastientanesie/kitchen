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

describe("Household preferences (issue #33)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ databasePath: ":memory:" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("lets a member read and update their household's preferences", async () => {
    const { sessionId } = await registerHouseholdWithPasskey(app);

    const initialResponse = await app.inject({
      method: "GET",
      url: "/households/me/preferences",
      cookies: { session: sessionId },
    });
    expect(initialResponse.statusCode).toBe(200);
    expect(initialResponse.json()).toEqual({ preferences: null });

    const updateResponse = await app.inject({
      method: "PATCH",
      url: "/households/me/preferences",
      cookies: { session: sessionId },
      payload: { preferences: "Sans gluten, pas de fruits de mer" },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toEqual({
      preferences: "Sans gluten, pas de fruits de mer",
    });

    const readAfterUpdateResponse = await app.inject({
      method: "GET",
      url: "/households/me/preferences",
      cookies: { session: sessionId },
    });
    expect(readAfterUpdateResponse.statusCode).toBe(200);
    expect(readAfterUpdateResponse.json()).toEqual({
      preferences: "Sans gluten, pas de fruits de mer",
    });
  });

  it("resets preferences to null when an empty string is sent", async () => {
    const { sessionId } = await registerHouseholdWithPasskey(app);

    await app.inject({
      method: "PATCH",
      url: "/households/me/preferences",
      cookies: { session: sessionId },
      payload: { preferences: "Végétarien" },
    });

    const resetResponse = await app.inject({
      method: "PATCH",
      url: "/households/me/preferences",
      cookies: { session: sessionId },
      payload: { preferences: "" },
    });
    expect(resetResponse.statusCode).toBe(200);
    expect(resetResponse.json()).toEqual({ preferences: null });

    const readResponse = await app.inject({
      method: "GET",
      url: "/households/me/preferences",
      cookies: { session: sessionId },
    });
    expect(readResponse.json()).toEqual({ preferences: null });
  });

  it("returns 401 UNAUTHENTICATED for an unauthenticated user", async () => {
    const getResponse = await app.inject({
      method: "GET",
      url: "/households/me/preferences",
    });
    expect(getResponse.statusCode).toBe(401);
    expect(getResponse.json().code).toBe("UNAUTHENTICATED");

    const patchResponse = await app.inject({
      method: "PATCH",
      url: "/households/me/preferences",
      payload: { preferences: "Peu importe" },
    });
    expect(patchResponse.statusCode).toBe(401);
    expect(patchResponse.json().code).toBe("UNAUTHENTICATED");
  });
});
