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

describe("Ingredients (issue #34)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ databasePath: ":memory:" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("supports the full CRUD lifecycle for a household's ingredients", async () => {
    const { sessionId } = await registerHousehold(app, "Foyer Dupont", "Alex");

    const emptyListResponse = await app.inject({
      method: "GET",
      url: "/ingredients",
      cookies: { session: sessionId },
    });
    expect(emptyListResponse.statusCode).toBe(200);
    expect(emptyListResponse.json()).toEqual([]);

    const createResponse = await app.inject({
      method: "POST",
      url: "/ingredients",
      cookies: { session: sessionId },
      payload: [
        { name: "Tomate", present: true, storage: "frigo" },
        { name: "Farine", present: false, storage: "placard" },
      ],
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({ name: "tomate", present: true, storage: "frigo" });
    expect(created[1]).toMatchObject({ name: "farine", present: false, storage: "placard" });

    const listResponse = await app.inject({
      method: "GET",
      url: "/ingredients",
      cookies: { session: sessionId },
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().map((ingredient: { name: string }) => ingredient.name)).toEqual([
      "farine",
      "tomate",
    ]);

    const tomatoId = created[0].id;

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/ingredients/${tomatoId}`,
      cookies: { session: sessionId },
      payload: { present: false },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json()).toMatchObject({
      id: tomatoId,
      name: "tomate",
      present: false,
      storage: "frigo",
    });

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/ingredients/${tomatoId}`,
      cookies: { session: sessionId },
    });
    expect(deleteResponse.statusCode).toBe(204);

    const finalListResponse = await app.inject({
      method: "GET",
      url: "/ingredients",
      cookies: { session: sessionId },
    });
    expect(finalListResponse.json()).toHaveLength(1);
  });

  it("returns DUPLICATE_NAME (409) when creating an ingredient with a name already used in the household", async () => {
    const { sessionId } = await registerHousehold(app, "Foyer Dupont", "Alex");

    await app.inject({
      method: "POST",
      url: "/ingredients",
      cookies: { session: sessionId },
      payload: [{ name: "Tomate", present: true, storage: "frigo" }],
    });

    const duplicateResponse = await app.inject({
      method: "POST",
      url: "/ingredients",
      cookies: { session: sessionId },
      payload: [{ name: "  TOMATE ", present: false, storage: "placard" }],
    });

    expect(duplicateResponse.statusCode).toBe(409);
    expect(duplicateResponse.json().code).toBe("DUPLICATE_NAME");

    const listResponse = await app.inject({
      method: "GET",
      url: "/ingredients",
      cookies: { session: sessionId },
    });
    expect(listResponse.json()).toHaveLength(1);
  });

  it("returns DUPLICATE_NAME (409) when renaming an ingredient to a name already used in the household", async () => {
    const { sessionId } = await registerHousehold(app, "Foyer Dupont", "Alex");

    const createResponse = await app.inject({
      method: "POST",
      url: "/ingredients",
      cookies: { session: sessionId },
      payload: [
        { name: "Tomate", present: true, storage: "frigo" },
        { name: "Farine", present: false, storage: "placard" },
      ],
    });
    const farineId = createResponse.json()[1].id;

    const renameResponse = await app.inject({
      method: "PATCH",
      url: `/ingredients/${farineId}`,
      cookies: { session: sessionId },
      payload: { name: "  TOMATE " },
    });

    expect(renameResponse.statusCode).toBe(409);
    expect(renameResponse.json().code).toBe("DUPLICATE_NAME");

    const listResponse = await app.inject({
      method: "GET",
      url: "/ingredients",
      cookies: { session: sessionId },
    });
    expect(listResponse.json().map((ingredient: { name: string }) => ingredient.name)).toEqual([
      "farine",
      "tomate",
    ]);
  });

  it("isolates ingredients by household: another household's member gets 404 on access", async () => {
    const householdA = await registerHousehold(app, "Foyer Dupont", "Alex");
    const householdB = await registerHousehold(app, "Foyer Martin", "Sam");

    const createResponse = await app.inject({
      method: "POST",
      url: "/ingredients",
      cookies: { session: householdA.sessionId },
      payload: [{ name: "Tomate", present: true, storage: "frigo" }],
    });
    const ingredientId = createResponse.json()[0].id;

    const listAsB = await app.inject({
      method: "GET",
      url: "/ingredients",
      cookies: { session: householdB.sessionId },
    });
    expect(listAsB.json()).toEqual([]);

    const patchAsB = await app.inject({
      method: "PATCH",
      url: `/ingredients/${ingredientId}`,
      cookies: { session: householdB.sessionId },
      payload: { present: false },
    });
    expect(patchAsB.statusCode).toBe(404);
    expect(patchAsB.json().code).toBe("INGREDIENT_NOT_FOUND");

    const deleteAsB = await app.inject({
      method: "DELETE",
      url: `/ingredients/${ingredientId}`,
      cookies: { session: householdB.sessionId },
    });
    expect(deleteAsB.statusCode).toBe(404);
    expect(deleteAsB.json().code).toBe("INGREDIENT_NOT_FOUND");
  });

  it("returns 401 UNAUTHENTICATED for unauthenticated requests", async () => {
    const getResponse = await app.inject({ method: "GET", url: "/ingredients" });
    expect(getResponse.statusCode).toBe(401);
    expect(getResponse.json().code).toBe("UNAUTHENTICATED");
  });
});
