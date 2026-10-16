import { describe, expect, it } from "vitest";
import { spellingDiff } from "../../src/domain/spellingDiff";
import { cases, expectFunctions, loadGolden } from "./load";

const file = loadGolden("diff");

describe("diff golden cases", () => {
  it("has a runner for every function", () => expectFunctions(file, ["spellingDiff"]));

  describe.each(cases(file, "spellingDiff"))("spellingDiff: $name", (c) => {
    it("matches", () => {
      const diff = spellingDiff(c.expected, c.actual);
      expect(diff.firstDivergence).toBe(c.firstDivergence);
      expect(diff.matches).toBe(c.matches);
      expect(diff.correctPrefixLength).toBe(c.correctPrefixLength);
    });
  });
});
