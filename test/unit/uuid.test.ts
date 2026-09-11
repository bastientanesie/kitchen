import { describe, expect, it } from "vitest";
import { generateId } from "../../src/services/uuid.js";

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateId (issue #27)", () => {
  it("generates a valid UUID v7", () => {
    expect(generateId()).toMatch(UUID_V7_PATTERN);
  });

  it("generates unique, monotonically sortable ids", () => {
    const ids = Array.from({ length: 20 }, () => generateId());

    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
  });
});
