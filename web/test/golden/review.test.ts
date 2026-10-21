import { describe, it } from "vitest";
import { reviewed, undone } from "../../src/domain/review";
import { cases, expectFunctions, expectSame, loadGolden, wordFrom } from "./load";

const file = loadGolden("review");

describe("review golden cases", () => {
  it("has a runner for every function", () => {
    expectFunctions(file, ["reviewed", "undone"]);
  });

  describe.each(cases(file, "reviewed"))("reviewed: $name", (c) => {
    it("matches", () => {
      const result = reviewed(wordFrom(c.word), c.correctFirstTry, c.typedAnswer, c.today, c.now, (t, i) => t + i);
      // Only the word fields the case lists.
      const word = Object.fromEntries(Object.keys(c.out.word).map((k) => [k, (result.word as any)[k]]));
      expectSame(word, c.out.word);
      expectSame(result.log, c.out.log);
    });
  });

  describe.each(cases(file, "undone"))("undone: $name", (c) => {
    it("matches", () => {
      const result = undone(wordFrom(c.current), wordFrom(c.before));
      // Only the word fields the case lists.
      const word = Object.fromEntries(Object.keys(c.out).map((k) => [k, (result as any)[k]]));
      expectSame(word, c.out);
    });
  });
});
