import { describe, expect, it } from "vitest";
import { buildParsedIngredients } from "../../src/services/ingredients-parse.js";

describe("buildParsedIngredients", () => {
  it("marks known ingredients as not new and unknown ones as new", () => {
    const result = buildParsedIngredients(
      [
        { name: "Tomate", present: false },
        { name: "Basilic", present: true },
      ],
      new Set(["tomate"]),
    );

    expect(result).toEqual([
      { name: "tomate", present: false, isNew: false },
      { name: "basilic", present: true, isNew: true },
    ]);
  });

  it("normalizes names the same way as the ingredients CRUD (trim/lowercase)", () => {
    const result = buildParsedIngredients([{ name: "  Farine COMPLÈTE ", present: true }], new Set());

    expect(result).toEqual([{ name: "farine complète", present: true, isNew: true }]);
  });

  it("returns an empty list when nothing is detected", () => {
    expect(buildParsedIngredients([], new Set(["tomate"]))).toEqual([]);
  });
});
