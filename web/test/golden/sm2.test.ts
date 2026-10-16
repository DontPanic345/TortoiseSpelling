import { describe, expect, it } from "vitest";
import {
  fuzzedDueDay,
  Grade,
  MAX_INTERVAL_DAYS,
  NEW_WORD_STATE,
  RESET_BELOW_QUALITY,
  sm2Scheduler,
  type SrsState,
} from "../../src/domain/srs";
import { seeded } from "../support/seeded";
import { cases, expectFunctions, expectSame, loadGolden, SEEDS } from "./load";

const file = loadGolden("sm2");

describe("sm2 golden cases", () => {
  it("has a runner for every function", () => {
    expectFunctions(file, ["constants", "next", "sequence", "fuzzedDueDay"]);
  });

  describe.each(cases(file, "constants"))("constants: $name", (c) => {
    it("matches", () => {
      expect(MAX_INTERVAL_DAYS).toBe(c.MAX_INTERVAL_DAYS);
      expect(RESET_BELOW_QUALITY).toBe(c.RESET_BELOW_QUALITY);
      expectSame(NEW_WORD_STATE, c.NEW_WORD_STATE);
      expect(Grade).toEqual(c.Grade);
    });
  });

  describe.each(cases(file, "next"))("next: $name", (c) => {
    it("matches", () => expectSame(sm2Scheduler.next(c.prev, c.quality), c.out));
  });

  describe.each(cases(file, "sequence"))("sequence: $name", (c) => {
    it("matches", () => {
      let state: SrsState = NEW_WORD_STATE;
      for (const quality of c.qualities as number[]) state = sm2Scheduler.next(state, quality);
      expectSame(state, c.out);
    });
  });

  describe.each(cases(file, "fuzzedDueDay"))("fuzzedDueDay: $name", (c) => {
    it("stays within range over every seed", () => {
      const [low, high] = c.within as [number, number];
      const results = SEEDS.map((seed) => fuzzedDueDay(c.today, c.intervalDays, seeded(seed)));
      for (const result of results) {
        expect(result).toBeGreaterThanOrEqual(low);
        expect(result).toBeLessThanOrEqual(high);
      }
      if (c.varies) expect(new Set(results).size).toBeGreaterThan(1);
      if (c.all) {
        const seen = new Set(results);
        for (let day = low; day <= high; day++) expect(seen.has(day)).toBe(true);
      }
    });
  });
});
