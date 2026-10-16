import { describe, expect, it } from "vitest";
import { lookupPrompt } from "../../src/domain/lookupPrompt";
import { cases, expectFunctions, loadGolden } from "./load";

const file = loadGolden("prompt");

describe("prompt golden cases", () => {
  it("has a runner for every function", () => {
    expectFunctions(file, ["lookupPrompt"]);
  });

  describe.each(cases(file, "lookupPrompt"))("lookupPrompt: $name", (c) => {
    it("matches", () => expect(lookupPrompt(c.word)).toBe(c.out));
  });
});
