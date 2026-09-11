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

describe("Create own household (issue #41)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ databasePath: ":memory:" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("lets an authenticated user create a household, becomes its owner, and receives an invitation link", async () => {
    const { sessionId, userId } = await registerHouseholdWithPasskey(app);

    const response = await app.inject({
      method: "POST",
      url: "/households/mine",
      cookies: { session: sessionId },
      payload: { name: "Foyer Martin" },
    });

    expect(response.statusCode).toBe(201);
    const { householdId, invitationToken, invitationExpiresAt } = response.json();
    expect(householdId).toBeTruthy();
    expect(invitationToken).toBeTruthy();
    expect(invitationExpiresAt).toBeTruthy();

    const userRow = app.db
      .prepare("SELECT household_id, role FROM users WHERE id = ?")
      .get(userId) as { household_id: string; role: string };
    expect(userRow.household_id).toBe(householdId);
    expect(userRow.role).toBe("owner");

    const previewResponse = await app.inject({
      method: "GET",
      url: `/households/invitations/${invitationToken}`,
    });
    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json()).toEqual({ householdName: "Foyer Martin", memberCount: 1 });
  });

  it("requires an authenticated session", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/households/mine",
      payload: { name: "Foyer Martin" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHENTICATED");
  });

  it("refuses to move a user away from a household that has other members", async () => {
    const { sessionId, householdId } = await registerHouseholdWithPasskey(app);

    await app.inject({
      method: "POST",
      url: "/households/invitations",
      cookies: { session: sessionId },
    });
    app.db
      .prepare(
        "INSERT INTO users (id, household_id, name, role, created_at, updated_at) VALUES ('other-user', ?, 'Sam', 'member', datetime('now'), datetime('now'))",
      )
      .run(householdId);

    const response = await app.inject({
      method: "POST",
      url: "/households/mine",
      cookies: { session: sessionId },
      payload: { name: "Foyer Martin" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("HOUSEHOLD_NOT_EMPTY");
  });

  it("rejects an empty household name", async () => {
    const { sessionId } = await registerHouseholdWithPasskey(app);

    const response = await app.inject({
      method: "POST",
      url: "/households/mine",
      cookies: { session: sessionId },
      payload: { name: "  " },
    });

    expect(response.statusCode).toBe(400);
  });
});
