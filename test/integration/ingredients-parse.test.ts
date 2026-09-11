import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { buildApp } from "../../src/app.js";
import { callGemini } from "../../src/services/gemini-client.js";
import { resetGeminiRateLimit } from "../../src/services/gemini-rate-limit.js";

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

vi.mock("../../src/services/gemini-client.js", () => ({
  callGemini: vi.fn(),
}));

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

describe("Ingredients parsing (issue #36)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    resetGeminiRateLimit();
    vi.mocked(callGemini).mockReset();
    app = await buildApp({ databasePath: ":memory:" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns ingredients with isNew computed against the household's existing stock", async () => {
    const { sessionId } = await registerHousehold(app, "Foyer Dupont", "Alex");

    await app.inject({
      method: "POST",
      url: "/ingredients",
      cookies: { session: sessionId },
      payload: [{ name: "Tomate", present: true, storage: "frigo" }],
    });

    vi.mocked(callGemini).mockResolvedValueOnce([
      { name: "Tomate", present: false },
      { name: "Basilic", present: true },
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/ingredients/parse",
      cookies: { session: sessionId },
      payload: { transcript: "il ne reste plus de tomates, il faut acheter du basilic" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ingredients: [
        { name: "tomate", present: false, isNew: false },
        { name: "basilic", present: true, isNew: true },
      ],
    });
  });

  it("returns an empty list (200) when no ingredient is detected", async () => {
    const { sessionId } = await registerHousehold(app, "Foyer Dupont", "Alex");

    vi.mocked(callGemini).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: "POST",
      url: "/ingredients/parse",
      cookies: { session: sessionId },
      payload: { transcript: "bonjour comment ça va" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ingredients: [] });
  });

  it("returns GEMINI_ANALYSIS_FAILED (500) when the Gemini call fails", async () => {
    const { sessionId } = await registerHousehold(app, "Foyer Dupont", "Alex");

    vi.mocked(callGemini).mockRejectedValueOnce(new Error("timeout"));

    const response = await app.inject({
      method: "POST",
      url: "/ingredients/parse",
      cookies: { session: sessionId },
      payload: { transcript: "des tomates" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().code).toBe("GEMINI_ANALYSIS_FAILED");
  });

  it("does not consume the rate-limit slot when the Gemini call fails technically", async () => {
    const { sessionId } = await registerHousehold(app, "Foyer Dupont", "Alex");

    vi.mocked(callGemini).mockRejectedValueOnce(new Error("timeout"));

    const failedResponse = await app.inject({
      method: "POST",
      url: "/ingredients/parse",
      cookies: { session: sessionId },
      payload: { transcript: "des tomates" },
    });
    expect(failedResponse.statusCode).toBe(500);

    vi.mocked(callGemini).mockResolvedValueOnce([]);

    const retryResponse = await app.inject({
      method: "POST",
      url: "/ingredients/parse",
      cookies: { session: sessionId },
      payload: { transcript: "des tomates" },
    });
    expect(retryResponse.statusCode).toBe(200);
  });

  it("returns GEMINI_RATE_LIMITED (429) with retryAfter on a second call within the same minute", async () => {
    const { sessionId } = await registerHousehold(app, "Foyer Dupont", "Alex");

    vi.mocked(callGemini).mockResolvedValue([]);

    const firstResponse = await app.inject({
      method: "POST",
      url: "/ingredients/parse",
      cookies: { session: sessionId },
      payload: { transcript: "des tomates" },
    });
    expect(firstResponse.statusCode).toBe(200);

    const secondResponse = await app.inject({
      method: "POST",
      url: "/ingredients/parse",
      cookies: { session: sessionId },
      payload: { transcript: "des tomates encore" },
    });

    expect(secondResponse.statusCode).toBe(429);
    expect(secondResponse.json().code).toBe("GEMINI_RATE_LIMITED");
    expect(secondResponse.json().retryAfter).toBeGreaterThan(0);
  });

  it("does not rate-limit across different households", async () => {
    const householdA = await registerHousehold(app, "Foyer Dupont", "Alex");
    const householdB = await registerHousehold(app, "Foyer Martin", "Sam");

    vi.mocked(callGemini).mockResolvedValue([]);

    const responseA = await app.inject({
      method: "POST",
      url: "/ingredients/parse",
      cookies: { session: householdA.sessionId },
      payload: { transcript: "des tomates" },
    });
    expect(responseA.statusCode).toBe(200);

    const responseB = await app.inject({
      method: "POST",
      url: "/ingredients/parse",
      cookies: { session: householdB.sessionId },
      payload: { transcript: "des tomates" },
    });
    expect(responseB.statusCode).toBe(200);
  });
});
