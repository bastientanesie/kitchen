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

describe("Invitations (issue #30)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ databasePath: ":memory:" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("lets a member generate an invitation and a new user join via that invitation with their own passkey", async () => {
    const { sessionId, householdId } = await registerHouseholdWithPasskey(app);

    const invitationResponse = await app.inject({
      method: "POST",
      url: "/households/invitations",
      cookies: { session: sessionId },
    });

    expect(invitationResponse.statusCode).toBe(201);
    const { token, expiresAt } = invitationResponse.json();
    expect(token).toBeTruthy();
    expect(expiresAt).toBeTruthy();

    const previewResponse = await app.inject({
      method: "GET",
      url: `/households/invitations/${token}`,
    });

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json()).toEqual({ householdName: "Foyer Dupont", memberCount: 1 });

    const optionsResponse = await app.inject({
      method: "POST",
      url: "/auth/webauthn/register/options",
      payload: { invitationToken: token, displayName: "Sam" },
    });

    expect(optionsResponse.statusCode).toBe(200);
    const options = optionsResponse.json();
    expect(options.user.name).toBe("Sam");

    const clientDataJSON = isoBase64URL.fromUTF8String(
      JSON.stringify({ type: "webauthn.create", challenge: options.challenge, origin: app.config.origin }),
    );

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/auth/webauthn/register/verify",
      payload: {
        invitationToken: token,
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

    expect(verifyResponse.statusCode).toBe(200);
    const { userId: samUserId, householdId: samHouseholdId } = verifyResponse.json();
    expect(samHouseholdId).toBe(householdId);

    const userRow = app.db
      .prepare("SELECT household_id, role, name FROM users WHERE id = ?")
      .get(samUserId) as { household_id: string; role: string; name: string };
    expect(userRow.household_id).toBe(householdId);
    expect(userRow.role).toBe("member");
    expect(userRow.name).toBe("Sam");
  });

  it("revokes the previous invitation when a new one is generated", async () => {
    const { sessionId } = await registerHouseholdWithPasskey(app);

    const firstInvitation = await app.inject({
      method: "POST",
      url: "/households/invitations",
      cookies: { session: sessionId },
    });
    const { token: firstToken } = firstInvitation.json();

    const secondInvitation = await app.inject({
      method: "POST",
      url: "/households/invitations",
      cookies: { session: sessionId },
    });
    const { token: secondToken } = secondInvitation.json();

    const firstPreview = await app.inject({
      method: "GET",
      url: `/households/invitations/${firstToken}`,
    });
    expect(firstPreview.statusCode).toBe(410);
    expect(firstPreview.json().code).toBe("INVITATION_EXPIRED_OR_INVALID");

    const secondPreview = await app.inject({
      method: "GET",
      url: `/households/invitations/${secondToken}`,
    });
    expect(secondPreview.statusCode).toBe(200);
  });

  it("returns 410 INVITATION_EXPIRED_OR_INVALID for an unknown or already consumed token", async () => {
    const { sessionId } = await registerHouseholdWithPasskey(app);

    const unknownPreview = await app.inject({
      method: "GET",
      url: "/households/invitations/not-a-real-token",
    });
    expect(unknownPreview.statusCode).toBe(410);
    expect(unknownPreview.json().code).toBe("INVITATION_EXPIRED_OR_INVALID");

    const invitationResponse = await app.inject({
      method: "POST",
      url: "/households/invitations",
      cookies: { session: sessionId },
    });
    const { token } = invitationResponse.json();

    await app.inject({
      method: "POST",
      url: "/auth/webauthn/register/options",
      payload: { invitationToken: token, displayName: "Sam" },
    });

    const consumedPreview = await app.inject({
      method: "GET",
      url: `/households/invitations/${token}`,
    });
    expect(consumedPreview.statusCode).toBe(410);
    expect(consumedPreview.json().code).toBe("INVITATION_EXPIRED_OR_INVALID");
  });

  it("requires an authenticated session to generate an invitation", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/households/invitations",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHENTICATED");
  });
});
