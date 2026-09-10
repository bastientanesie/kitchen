import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { generateId } from "../../src/services/uuid.js";

describe("authenticate middleware (issue #29)", () => {
  let app: FastifyInstance;
  let userId: string;
  let householdId: string;

  beforeEach(async () => {
    app = await buildApp({ databasePath: ":memory:" });
    app.get("/__protected", { preHandler: app.authenticate }, async (request) => {
      return request.auth;
    });
    await app.ready();

    const now = new Date().toISOString();
    householdId = generateId();
    userId = generateId();
    app.db
      .prepare("INSERT INTO households (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run(householdId, "Foyer Test", now, now);
    app.db
      .prepare(
        "INSERT INTO users (id, household_id, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(userId, householdId, "Alex", "owner", now, now);
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 401 with the standard problem+json format when no session cookie is sent", async () => {
    const response = await app.inject({ method: "GET", url: "/__protected" });

    expect(response.statusCode).toBe(401);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    const body = response.json();
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(body.status).toBe(401);
  });

  it("returns 401 when the session is expired", async () => {
    const sessionId = "expired-session";
    const now = new Date();
    app.db
      .prepare(
        "INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        sessionId,
        userId,
        now.toISOString(),
        new Date(now.getTime() - 1000).toISOString(),
        now.toISOString(),
      );

    const response = await app.inject({
      method: "GET",
      url: "/__protected",
      cookies: { session: sessionId },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 when the session id is unknown", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/__protected",
      cookies: { session: "does-not-exist" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHENTICATED");
  });

  it("lets the request through and exposes request.auth for a valid session", async () => {
    const sessionId = "valid-session";
    const now = new Date();
    app.db
      .prepare(
        "INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        sessionId,
        userId,
        now.toISOString(),
        new Date(now.getTime() + 60_000).toISOString(),
        now.toISOString(),
      );

    const response = await app.inject({
      method: "GET",
      url: "/__protected",
      cookies: { session: sessionId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId, householdId });
  });
});
