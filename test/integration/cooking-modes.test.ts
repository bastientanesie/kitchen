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

async function registerHousehold(app: FastifyInstance, name: string, displayName: string) {
  const householdResponse = await app.inject({
    method: "POST",
    url: "/households",
    payload: { name, displayName },
  });
  const { userId, householdId, enrollmentToken } = householdResponse.json();

  const optionsResponse = await app.inject({
    method: "POST",
    url: "/auth/webauthn/register/options",
    payload: { enrollmentToken, displayName },
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
        id: `mock-credential-${userId}`,
        rawId: `mock-credential-${userId}`,
        type: "public-key",
        clientExtensionResults: {},
        response: {
          clientDataJSON,
          attestationObject: isoBase64URL.fromUTF8String("attestation"),
        },
      },
      deviceName: `Appareil de ${displayName}`,
    },
  });

  const sessionCookie = verifyResponse.cookies.find((cookie) => cookie.name === "session");

  return { userId, householdId, sessionId: sessionCookie!.value };
}

describe("Cooking modes (issue #35)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ databasePath: ":memory:" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("seeds the 4 default cooking modes when a household is created", async () => {
    const { sessionId } = await registerHousehold(app, "Foyer Dupont", "Alex");

    const listResponse = await app.inject({
      method: "GET",
      url: "/cooking-modes",
      cookies: { session: sessionId },
    });
    expect(listResponse.statusCode).toBe(200);
    const modes = listResponse.json();
    expect(modes.map((mode: { name: string }) => mode.name).sort()).toEqual(
      ["casserole", "four", "micro-ondes", "poêle"].sort(),
    );
    expect(modes.every((mode: { present: boolean }) => mode.present === true)).toBe(true);
  });

  it("supports the full CRUD lifecycle for a household's cooking modes", async () => {
    const { sessionId } = await registerHousehold(app, "Foyer Dupont", "Alex");

    const createResponse = await app.inject({
      method: "POST",
      url: "/cooking-modes",
      cookies: { session: sessionId },
      payload: [{ name: "Barbecue", present: false }],
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ name: "barbecue", present: false });

    const cookingModeId = created[0].id;

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/cooking-modes/${cookingModeId}`,
      cookies: { session: sessionId },
      payload: { name: "Plancha", present: true },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json()).toMatchObject({
      id: cookingModeId,
      name: "plancha",
      present: true,
    });

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/cooking-modes/${cookingModeId}`,
      cookies: { session: sessionId },
    });
    expect(deleteResponse.statusCode).toBe(204);

    const finalListResponse = await app.inject({
      method: "GET",
      url: "/cooking-modes",
      cookies: { session: sessionId },
    });
    expect(finalListResponse.json()).toHaveLength(4);
  });

  it("allows deleting a default cooking mode like any other", async () => {
    const { sessionId } = await registerHousehold(app, "Foyer Dupont", "Alex");

    const listResponse = await app.inject({
      method: "GET",
      url: "/cooking-modes",
      cookies: { session: sessionId },
    });
    const defaultModeId = listResponse.json()[0].id;

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/cooking-modes/${defaultModeId}`,
      cookies: { session: sessionId },
    });
    expect(deleteResponse.statusCode).toBe(204);

    const finalListResponse = await app.inject({
      method: "GET",
      url: "/cooking-modes",
      cookies: { session: sessionId },
    });
    expect(finalListResponse.json()).toHaveLength(3);
  });

  it("returns DUPLICATE_NAME (409) when creating a cooking mode with a name already used in the household", async () => {
    const { sessionId } = await registerHousehold(app, "Foyer Dupont", "Alex");

    const duplicateResponse = await app.inject({
      method: "POST",
      url: "/cooking-modes",
      cookies: { session: sessionId },
      payload: [{ name: "  FOUR ", present: true }],
    });

    expect(duplicateResponse.statusCode).toBe(409);
    expect(duplicateResponse.json().code).toBe("DUPLICATE_NAME");
  });

  it("returns DUPLICATE_NAME (409) when renaming a cooking mode to a name already used in the household", async () => {
    const { sessionId } = await registerHousehold(app, "Foyer Dupont", "Alex");

    const listResponse = await app.inject({
      method: "GET",
      url: "/cooking-modes",
      cookies: { session: sessionId },
    });
    const modes = listResponse.json();
    const four = modes.find((mode: { name: string }) => mode.name === "four");
    const poele = modes.find((mode: { name: string }) => mode.name === "poêle");

    const renameResponse = await app.inject({
      method: "PATCH",
      url: `/cooking-modes/${poele.id}`,
      cookies: { session: sessionId },
      payload: { name: "  FOUR " },
    });

    expect(renameResponse.statusCode).toBe(409);
    expect(renameResponse.json().code).toBe("DUPLICATE_NAME");
    expect(four.id).not.toBe(poele.id);
  });

  it("isolates cooking modes by household: another household's member gets 404 on access", async () => {
    const householdA = await registerHousehold(app, "Foyer Dupont", "Alex");
    const householdB = await registerHousehold(app, "Foyer Martin", "Sam");

    const listAsA = await app.inject({
      method: "GET",
      url: "/cooking-modes",
      cookies: { session: householdA.sessionId },
    });
    const cookingModeId = listAsA.json()[0].id;

    const patchAsB = await app.inject({
      method: "PATCH",
      url: `/cooking-modes/${cookingModeId}`,
      cookies: { session: householdB.sessionId },
      payload: { name: "autre" },
    });
    expect(patchAsB.statusCode).toBe(404);
    expect(patchAsB.json().code).toBe("COOKING_MODE_NOT_FOUND");

    const deleteAsB = await app.inject({
      method: "DELETE",
      url: `/cooking-modes/${cookingModeId}`,
      cookies: { session: householdB.sessionId },
    });
    expect(deleteAsB.statusCode).toBe(404);
    expect(deleteAsB.json().code).toBe("COOKING_MODE_NOT_FOUND");
  });

  it("returns 401 UNAUTHENTICATED for unauthenticated requests", async () => {
    const getResponse = await app.inject({ method: "GET", url: "/cooking-modes" });
    expect(getResponse.statusCode).toBe(401);
    expect(getResponse.json().code).toBe("UNAUTHENTICATED");
  });
});
