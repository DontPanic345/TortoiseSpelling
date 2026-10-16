import { describe, expect, it } from "vitest";
import { interleaveSession, remainingNewToday } from "../../src/domain/session";
import { seeded } from "../support/seeded";
import { cases, expectFunctions, loadGolden, SEEDS, wordFrom } from "./load";

const file = loadGolden("session");

describe("session golden cases", () => {
  it("has a runner for every function", () => {
    expectFunctions(file, ["remainingNewToday", "interleaveSession"]);
  });

  describe.each(cases(file, "remainingNewToday"))("remainingNewToday: $name", (c) => {
    it("matches", () => expect(remainingNewToday(c.newWordsPerDay, c.introducedToday)).toBe(c.out));
  });

  describe.each(cases(file, "interleaveSession"))("interleaveSession: $name", (c) => {
    it("is a permutation with the new words at the expected places over every seed", () => {
      const due = (c.due as number[]).map((id) => wordFrom({ id }));
      const fresh = (c.fresh as number[]).map((id) => wordFrom({ id }));
      const freshIds = new Set(c.fresh as number[]);
      const orders = new Set<string>();
      for (const seed of SEEDS) {
        const ids = interleaveSession(due, fresh, seeded(seed)).map((w) => w.id);
        expect([...ids].sort((a, b) => a - b)).toEqual([...c.due, ...c.fresh].sort((a: number, b: number) => a - b));
        const at = ids.flatMap((id, index) => (freshIds.has(id) ? [index] : []));
        expect(at).toEqual(c.freshAt);
        orders.add(ids.join(","));
      }
      if (c.varies) expect(orders.size).toBeGreaterThan(1);
    });
  });
});
