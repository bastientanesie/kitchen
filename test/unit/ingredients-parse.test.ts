import { describe, expect, it } from "vitest";
import { buildParsedIngredients } from "../../src/services/ingredients-parse.js";

describe("buildParsedIngredients", () => {
  it("marks known ingredients as not new and unknown ones as new", () => {
    const result = buildParsedIngredients(
      [
        { name: "Tomate", present: false, storage: "frigo" },
        { name: "Basilic", present: true, storage: "placard" },
      ],
      new Set(["tomate"]),
    );

    expect(result).toEqual([
      { name: "tomate", present: false, isNew: false, storage: "frigo" },
      { name: "basilic", present: true, isNew: true, storage: "placard" },
    ]);
  });

  it("normalizes names the same way as the ingredients CRUD (trim/lowercase)", () => {
    const result = buildParsedIngredients(
      [{ name: "  Farine COMPLÈTE ", present: true, storage: "placard" }],
      new Set(),
    );

    expect(result).toEqual([{ name: "farine complète", present: true, isNew: true, storage: "placard" }]);
  });

  it("returns an empty list when nothing is detected", () => {
    expect(buildParsedIngredients([], new Set(["tomate"]))).toEqual([]);
  });
});
