import { describe, expect, it } from "vitest";
import { blankWordIn, hideWordInDefinition } from "../../src/domain/wordBlank";
import { cases, expectFunctions, loadGolden } from "./load";

const file = loadGolden("blank");

describe("blank golden cases", () => {
  it("has a runner for every function", () => {
    expectFunctions(file, ["blankWordIn", "hideWordInDefinition"]);
  });

  describe.each(cases(file, "blankWordIn"))("blankWordIn: $name", (c) => {
    it("matches", () => {
      expect(blankWordIn(c.sentence, c.word)).toEqual({ text: c.text, didBlank: c.didBlank });
    });
  });
  describe.each(cases(file, "hideWordInDefinition"))("hideWordInDefinition: $name", (c) => {
    it("matches", () => expect(hideWordInDefinition(c.definition, c.word)).toBe(c.out));
  });
});
