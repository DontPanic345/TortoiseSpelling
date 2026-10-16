import { describe, expect, it } from "vitest";
import { isBlank, parsePastedLookup, summary } from "../../src/domain/pastedLookup";
import { cases, contentFrom, expectFunctions, loadGolden, textFrom } from "./load";

const file = loadGolden("paste");

describe("paste golden cases", () => {
  it("has a runner for every function", () => {
    expectFunctions(file, ["parsePastedLookup", "summary", "isBlank"]);
  });

  describe.each(cases(file, "parsePastedLookup"))("parsePastedLookup: $name", (c) => {
    it("matches", () => {
      const result = parsePastedLookup(textFrom(c.text), c.typedWord ?? "practice");
      if (c.out.kind === "invalid") {
        expect(result).toEqual({ kind: "invalid", message: c.out.message });
        return;
      }
      expect(c.out.kind).toBe("valid");
      expect("content" in c.out || "summary" in c.out, "a valid case checks its content or its summary").toBe(true);
      if (result.kind !== "valid") throw new Error(`expected a valid answer but got ${JSON.stringify(result)}`);
      expect(result.word).toBe(c.out.word);
      expect(result.renames).toBe(c.out.renames);
      if ("content" in c.out) expect(result.content).toEqual(contentFrom(c.out.content));
      if ("summary" in c.out) expect(summary(result.content)).toBe(c.out.summary);
    });
  });
  describe.each(cases(file, "summary"))("summary: $name", (c) => {
    it("matches", () => expect(summary(contentFrom(c.content))).toBe(c.out));
  });
  describe.each(cases(file, "isBlank"))("isBlank: $name", (c) => {
    it("matches", () => expect(isBlank(contentFrom(c.content))).toBe(c.out));
  });
});
