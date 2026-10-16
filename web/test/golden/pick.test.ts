import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import { pickCard, reviewCard } from "../../src/domain/cardPick";
import { seeded } from "../support/seeded";
import { cases, contentFrom, expectFunctions, loadGolden, SEEDS, wordFrom } from "./load";

const file = loadGolden("pick");

describe("pick golden cases", () => {
  it("has a runner for every function", () => {
    expectFunctions(file, ["pickCard", "answer", "hint"]);
  });

  describe.each(cases(file, "pickCard"))("pickCard: $name", (c) => {
    it("gives only the expected cards over every seed", () => {
      const word = wordFrom(c.word);
      const content = contentFrom(c.content);
      const members = c.oneOf as Record<string, unknown>[];
      const seen = new Set<number>();
      for (const seed of SEEDS) {
        const card = pickCard(word, content, seeded(seed)) as unknown as Record<string, unknown>;
        const matches = members.flatMap((member, i) =>
          Object.entries(member).every(([key, expected]) => isDeepStrictEqual(card[key], expected)) ? [i] : [],
        );
        expect(matches.length, `seed ${seed} gave ${card.form} / ${JSON.stringify(card.example)}`).toBeGreaterThan(0);
        matches.forEach((i) => seen.add(i));
      }
      if (c.all) expect([...seen].sort()).toEqual(members.map((_, i) => i));
    });
  });
  describe.each(cases(file, "answer"))("answer: $name", (c) => {
    it("matches", () => expect(reviewCard(wordFrom(), "d", null, c.form, null, null).answer).toBe(c.out));
  });
  describe.each(cases(file, "hint"))("hint: $name", (c) => {
    it("matches", () => {
      expect(reviewCard(wordFrom(), "d", c.partOfSpeech, "ran", c.label, null).hint).toBe(c.out);
    });
  });
});
