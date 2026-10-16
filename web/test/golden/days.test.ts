import { describe, expect, it } from "vitest";
import type { Clock } from "../../src/domain/clock";
import { currentStreak, dayOf, relativeLabel, today } from "../../src/domain/days";
import { cases, expectFunctions, loadGolden } from "./load";

const file = loadGolden("days");

describe("days golden cases", () => {
  it("has a runner for every function", () => {
    expectFunctions(file, ["today", "dayOf", "relativeLabel", "currentStreak"]);
  });

  describe.each(cases(file, "today"))("today: $name", (c) => {
    it("matches", () => {
      const clock: Clock = { millis: () => c.millis, timeZone: () => c.zone };
      expect(today(clock)).toBe(c.out);
    });
  });
  describe.each(cases(file, "dayOf"))("dayOf: $name", (c) => {
    it("matches", () => expect(dayOf(c.millis, c.zone)).toBe(c.out));
  });
  describe.each(cases(file, "relativeLabel"))("relativeLabel: $name", (c) => {
    it("matches", () => expect(relativeLabel(c.day, c.today)).toBe(c.out));
  });
  describe.each(cases(file, "currentStreak"))("currentStreak: $name", (c) => {
    it("matches", () => {
      const streak = currentStreak(new Set(c.studyDays), c.today, new Set(c.satisfiedDays ?? []));
      expect(streak).toBe(c.out);
    });
  });
});
