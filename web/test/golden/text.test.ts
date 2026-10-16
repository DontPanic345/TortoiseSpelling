import { describe, expect, it } from "vitest";
import { ktIsBlank, ktTrim, normalizeWord } from "../../src/domain/text";
import { cases, expectFunctions, loadGolden } from "./load";

const file = loadGolden("text");

describe("text golden cases", () => {
  it("has a runner for every function", () => {
    expectFunctions(file, ["normalizeWord", "ktTrim", "ktIsBlank"]);
  });

  describe.each(cases(file, "normalizeWord"))("normalizeWord: $name", (c) => {
    it("matches", () => expect(normalizeWord(c.in)).toBe(c.out));
  });
  describe.each(cases(file, "ktTrim"))("ktTrim: $name", (c) => {
    it("matches", () => expect(ktTrim(c.in)).toBe(c.out));
  });
  describe.each(cases(file, "ktIsBlank"))("ktIsBlank: $name", (c) => {
    it("matches", () => expect(ktIsBlank(c.in)).toBe(c.out));
  });
});
