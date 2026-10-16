import { describe, expect, test } from "vitest";
import type { StoredWord } from "../../src/data/model";
import type { WordContent } from "../../src/domain/wordContent";
import { content, openTestRepository } from "../support/repo";

const D = Date.UTC(2026, 2, 2) / 86_400_000;

type Repo = Awaited<ReturnType<typeof openTestRepository>>["repo"];

async function word(repo: Repo, text: string): Promise<StoredWord> {
  const found = (await repo.wordsWithContent()).find((w) => w.text === text);
  if (!found) throw new Error(`no word ${text}`);
  return found;
}

/** The session's card for `text`, spelt right or wrong, as Review would record it. */
async function review(repo: Repo, text: string, correctFirstTry: boolean, typed = text) {
  const card = (await repo.buildSession()).find((c) => c.word.text === text);
  if (!card) throw new Error(`${text} is not in today's session`);
  await repo.markShown(card);
  await repo.recordReview(card.word.id, correctFirstTry, typed);
}

describe("scheduling", () => {
  test("a word added on day D comes back on D+1, then D+7", async () => {
    const { repo, clock, db } = await openTestRepository();
    await repo.addWord("necessary", content("Needed.", "It is necessary to rest."));
    expect(await repo.todayPlan()).toEqual({ dueCount: 0, newCount: 1 });

    await review(repo, "necessary", true);
    expect(await word(repo, "necessary")).toMatchObject({ dueOn: D + 1, repetitions: 1, isNew: false, firstReviewedOn: D });

    clock.nextDay();
    expect(await repo.todayPlan()).toEqual({ dueCount: 1, newCount: 0 });
    await review(repo, "necessary", true);

    expect(await word(repo, "necessary")).toMatchObject({ dueOn: D + 1 + 6, repetitions: 2, intervalDays: 6 });
    const logs = await db.getAll("reviewLog");
    expect(logs.map((l) => [l.reviewedOn, l.grade, l.correct])).toEqual([
      [D, 5, true],
      [D + 1, 5, true],
    ]);
  });
});

describe("lapse", () => {
  test("a wrong first try resets to tomorrow and logs the typed answer", async () => {
    const { repo, db } = await openTestRepository();
    await repo.addWord("rhythm", content("A pattern.", "The rhythm held."));
    const seeded = await word(repo, "rhythm");
    await db.put("words", {
      ...seeded,
      repetitions: 2,
      intervalDays: 6,
      dueOn: D,
      isNew: false,
      firstReviewedOn: D - 10,
    });

    await review(repo, "rhythm", false, " rythm ");

    expect(await word(repo, "rhythm")).toMatchObject({ repetitions: 0, lapses: 1, dueOn: D + 1, intervalDays: 1 });
    const logs = await db.getAll("reviewLog");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ correct: false, grade: 2, typedAnswer: "rythm" });
  });
});

describe("practice", () => {
  test("never changes scheduling or the log", async () => {
    const { repo, db } = await openTestRepository();
    await repo.addWord("necessary", content("Needed.", "It is necessary."));
    await review(repo, "necessary", true);
    expect(await repo.buildSession()).toHaveLength(0);
    const before = await repo.wordsWithContent();
    const logs = await db.count("reviewLog");

    const pool = await repo.practicePool();
    expect(pool).toHaveLength(1);
    await repo.markShown(pool[0]!);

    const after = await repo.wordsWithContent();
    const scheduling = ({ content: _c, ...rest }: StoredWord) => rest;
    expect(after.map(scheduling)).toEqual(before.map(scheduling));
    expect(await db.count("reviewLog")).toBe(logs);
  });
});

describe("allowance", () => {
  test("two new words a day, and a heavy review day doesn't use it", async () => {
    const { repo, clock } = await openTestRepository();
    await repo.setNewWordsPerDay(2);
    for (const text of ["alpha", "beta", "gamma"]) await repo.addWord(text, content(`About ${text}.`));
    expect(await repo.todayPlan()).toEqual({ dueCount: 0, newCount: 2 });

    const session = await repo.buildSession();
    expect(session).toHaveLength(2);
    for (const card of session) await repo.recordReview(card.word.id, true, card.answer);
    expect(await repo.todayPlan()).toEqual({ dueCount: 0, newCount: 0 });

    clock.nextDay();
    expect(await repo.todayPlan()).toEqual({ dueCount: 2, newCount: 1 });
    expect(await repo.buildSession()).toHaveLength(3);
  });
});

describe("streak", () => {
  test("a day with nothing due bridges the streak rather than breaking it", async () => {
    const { repo, clock } = await openTestRepository();
    await repo.addWord("necessary", content("Needed.", "It is necessary."));
    await review(repo, "necessary", true);
    clock.nextDay();
    await review(repo, "necessary", true);
    expect(await repo.currentStreak()).toBe(2);

    clock.nextDay();
    expect(await repo.currentStreak()).toBe(2);
    await repo.markTodaySatisfied();
    expect(await repo.currentStreak()).toBe(2);
    clock.nextDay();
    expect(await repo.currentStreak()).toBe(2);
  });

  test("an unmarked day with nothing studied breaks it", async () => {
    const { repo, clock } = await openTestRepository();
    await repo.addWord("necessary", content("Needed.", "It is necessary."));
    await review(repo, "necessary", true);
    clock.advanceDays(2);
    expect(await repo.currentStreak()).toBe(0);
  });

  test("the week strip marks studied, satisfied and pending days", async () => {
    const { repo, clock } = await openTestRepository();
    await repo.addWord("necessary", content("Needed.", "It is necessary."));
    await review(repo, "necessary", true);
    clock.nextDay();
    await repo.markTodaySatisfied();

    const week = await repo.lastWeek();
    expect(week).toHaveLength(7);
    expect(week.slice(-2).map((d) => d.mark)).toEqual(["PRACTICED", "NOTHING_DUE"]);
    expect(week[0]?.mark).toBe("BEFORE_START");
  });
});

describe("rotation", () => {
  test("a word's sentences take turns", async () => {
    const { repo, clock } = await openTestRepository();
    const weekAgo = clock.millis() - 7 * 86_400_000;
    const necessary: WordContent = {
      definitions: [
        {
          text: "Needed.",
          partOfSpeech: "",
          forms: [
            {
              text: "necessary",
              label: "",
              examples: [
                { text: "It is necessary to rest.", shownAt: weekAgo },
                { text: "Water is necessary for life.", shownAt: null },
              ],
            },
          ],
        },
      ],
    };
    await repo.addWord("necessary", necessary);

    const [first] = await repo.buildSession();
    expect(first?.example?.text).toBe("Water is necessary for life.");
    await review(repo, "necessary", true);

    clock.nextDay();
    const [second] = await repo.buildSession();
    expect(second?.example?.text).toBe("It is necessary to rest.");
  });
});
