import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";

describe("health endpoint (issue #27)", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("responds 200 to demonstrate the app starts", async () => {
    app = await buildApp({ databasePath: ":memory:" });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
