import { describe, expect, it } from "vitest";
import type { Word } from "../../src/data/model";
import {
  availableNewCount,
  dueCount,
  dueWords,
  firstCreatedAt,
  introducedOn,
  newWords,
  nextDueDay,
  randomWords,
  recentStudyDays,
} from "../../src/domain/queries";
import { seeded } from "../support/seeded";
import { wordFrom } from "../golden/load";

function word(id: number, fields: Partial<Word> = {}): Word {
  return { ...wordFrom({ id, text: `word${id}` }), ...fields };
}

const ids = (words: Word[]) => words.map((w) => w.id);

describe("dueWords and dueCount", () => {
  const words = [
    word(1, { isNew: false, dueOn: 5 }),
    word(2, { isNew: false, dueOn: 3 }),
    word(3, { isNew: false, dueOn: 10 }),
    word(4, { isNew: true, dueOn: 1 }),
    word(5, { isNew: false, dueOn: 2, suspended: true }),
    word(6, { isNew: false, dueOn: 5 }),
  ];

  it("returns unsuspended, non-new words due on or before today, soonest first", () => {
    expect(ids(dueWords(words, 5))).toEqual([2, 1, 6]);
  });

  it("leaves out a word due tomorrow", () => {
    expect(ids(dueWords(words, 4))).toEqual([2]);
  });

  it("counts what it returns", () => {
    expect(dueCount(words, 5)).toBe(3);
    expect(dueCount(words, 0)).toBe(0);
  });
});

describe("newWords and availableNewCount", () => {
  const words = [
    word(1, { createdAt: 30 }),
    word(2, { createdAt: 10 }),
    word(3, { createdAt: 20, suspended: true }),
    word(4, { createdAt: 10 }),
    word(5, { createdAt: 5, isNew: false }),
  ];

  it("returns unsuspended new words oldest first, ties by id", () => {
    expect(ids(newWords(words, 10))).toEqual([2, 4, 1]);
  });

  it("honours the limit", () => {
    expect(ids(newWords(words, 2))).toEqual([2, 4]);
    expect(newWords(words, 0)).toEqual([]);
  });

  it("counts unsuspended new words", () => {
    expect(availableNewCount(words)).toBe(3);
  });
});

describe("introducedOn", () => {
  it("counts words first reviewed on that day, suspended or not", () => {
    const words = [
      word(1, { firstReviewedOn: 7 }),
      word(2, { firstReviewedOn: 7, suspended: true }),
      word(3, { firstReviewedOn: 6 }),
      word(4, { firstReviewedOn: null }),
    ];
    expect(introducedOn(words, 7)).toBe(2);
    expect(introducedOn(words, 8)).toBe(0);
  });
});

describe("nextDueDay", () => {
  it("is the soonest due day among scheduled words", () => {
    const words = [word(1, { isNew: false, dueOn: 9 }), word(2, { isNew: false, dueOn: 4 })];
    expect(nextDueDay(words)).toBe(4);
  });

  it("ignores new and suspended words", () => {
    const words = [
      word(1, { isNew: true, dueOn: 1 }),
      word(2, { isNew: false, dueOn: 2, suspended: true }),
      word(3, { isNew: false, dueOn: 8 }),
    ];
    expect(nextDueDay(words)).toBe(8);
  });

  it("is null when nothing is scheduled", () => {
    expect(nextDueDay([])).toBeNull();
    expect(nextDueDay([word(1)])).toBeNull();
  });
});

describe("randomWords", () => {
  const words = [1, 2, 3, 4, 5, 6].map((id) => word(id, { suspended: id === 3 }));

  it("never includes a suspended word and respects the limit", () => {
    for (let seed = 0; seed < 50; seed++) {
      const picked = randomWords(words, 4, seeded(seed));
      expect(picked).toHaveLength(4);
      expect(ids(picked)).not.toContain(3);
      expect(new Set(ids(picked)).size).toBe(4);
    }
  });

  it("returns every unsuspended word when the limit is larger", () => {
    expect(ids(randomWords(words, 10, seeded(1))).sort()).toEqual([1, 2, 4, 5, 6]);
  });

  it("varies with the seed", () => {
    const orders = new Set(Array.from({ length: 20 }, (_, s) => ids(randomWords(words, 4, seeded(s))).join()));
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe("firstCreatedAt", () => {
  it("is the oldest createdAt", () => {
    expect(firstCreatedAt([word(1, { createdAt: 50 }), word(2, { createdAt: 20 })])).toBe(20);
  });

  it("is null with no words", () => {
    expect(firstCreatedAt([])).toBeNull();
  });
});

describe("recentStudyDays", () => {
  const logs = [{ reviewedOn: 5 }, { reviewedOn: 9 }, { reviewedOn: 5 }, { reviewedOn: 7 }, { reviewedOn: 9 }];

  it("is distinct days, newest first", () => {
    expect(recentStudyDays(logs, 10)).toEqual([9, 7, 5]);
  });

  it("honours the limit", () => {
    expect(recentStudyDays(logs, 2)).toEqual([9, 7]);
  });

  it("is empty with no logs", () => {
    expect(recentStudyDays([], 400)).toEqual([]);
  });
});
