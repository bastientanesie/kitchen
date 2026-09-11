import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";

describe("RFC 7807 validation error format (issue #27)", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("returns an application/problem+json body with code and errors for an invalid body", async () => {
    app = await buildApp({ databasePath: ":memory:" });

    const response = await app.inject({
      method: "POST",
      url: "/households",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");

    const body = response.json();
    expect(body).toMatchObject({
      type: expect.any(String),
      title: expect.any(String),
      status: 400,
      detail: expect.any(String),
      instance: "/households",
      code: "VALIDATION_FAILED",
    });
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBeGreaterThan(0);
  });
});
