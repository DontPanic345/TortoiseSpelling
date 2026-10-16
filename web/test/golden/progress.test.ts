import { describe, expect, it } from "vitest";
import {
  greeting,
  KNOWN_INTERVAL_DAYS,
  learningStage,
  matches,
  recentDays,
  WORD_FILTER_LABELS,
  WORD_FILTERS,
  wordFilterCounts,
  wordProgress,
  type WordFilter,
} from "../../src/domain/progress";
import { cases, expectFunctions, loadGolden, wordFrom } from "./load";

const file = loadGolden("progress");

describe("progress golden cases", () => {
  it("has a runner for every function", () => {
    expectFunctions(file, [
      "constants",
      "learningStage",
      "wordProgress",
      "matches",
      "wordFilterCounts",
      "recentDays",
      "greeting",
    ]);
  });

  describe.each(cases(file, "constants"))("constants: $name", (c) => {
    it("matches", () => {
      expect(KNOWN_INTERVAL_DAYS).toBe(c.KNOWN_INTERVAL_DAYS);
      expect(WORD_FILTERS).toEqual(c.filters);
      expect(WORD_FILTER_LABELS).toEqual(c.labels);
    });
  });
  describe.each(cases(file, "learningStage"))("learningStage: $name", (c) => {
    it("matches", () => expect(learningStage(wordFrom(c.word))).toBe(c.out));
  });
  describe.each(cases(file, "wordProgress"))("wordProgress: $name", (c) => {
    it("matches", () => expect(wordProgress(c.words.map(wordFrom))).toEqual(c.out));
  });
  describe.each(cases(file, "matches"))("matches: $name", (c) => {
    it("matches", () => {
      expect(matches(c.filter as WordFilter, wordFrom(c.word), c.today)).toBe(c.out);
    });
  });
  describe.each(cases(file, "wordFilterCounts"))("wordFilterCounts: $name", (c) => {
    it("matches", () => expect(wordFilterCounts(c.words.map(wordFrom), c.today)).toEqual(c.out));
  });
  describe.each(cases(file, "recentDays"))("recentDays: $name", (c) => {
    it("matches", () => {
      const days = recentDays(c.today, new Set(c.studyDays), new Set(c.satisfiedDays), c.firstDay, c.count);
      expect(days.map((d) => d.day)).toEqual(c.days);
      expect(days.map((d) => d.mark)).toEqual(c.marks);
    });
  });
  describe.each(cases(file, "greeting"))("greeting: $name", (c) => {
    it("matches", () => expect(greeting(c.hour)).toBe(c.out));
  });
});
