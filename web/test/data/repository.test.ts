import { describe, expect, test } from "vitest";
import { BackupFormatError, exportBackup } from "../../src/data/backup";
import type { StoredWord } from "../../src/data/model";
import { apply, type WordContent } from "../../src/domain/wordContent";
import { content, openTestRepository } from "../support/repo";

const logCount = async (db: Awaited<ReturnType<typeof openTestRepository>>["db"]) => db.count("reviewLog");

async function wordNamed(repo: Awaited<ReturnType<typeof openTestRepository>>["repo"], text: string) {
  const word = (await repo.wordsWithContent()).find((w) => w.text === text);
  if (!word) throw new Error(`no word ${text}`);
  return word;
}

describe("addWord", () => {
  test("trims, rejects blanks and duplicates differing in case and spacing", async () => {
    const { repo, clock } = await openTestRepository();
    expect(await repo.addWord("   ", content("Nothing."))).toEqual({ kind: "blank" });

    const added = await repo.addWord("  Necessary ", content("Needed.", "It is necessary."));
    expect(added.kind).toBe("added");
    const [word] = await repo.wordsWithContent();
    expect(word).toMatchObject({
      text: "Necessary",
      normalizedText: "necessary",
      createdAt: clock.millis(),
      repetitions: 0,
      easeFactor: 2.5,
      intervalDays: 0,
      dueOn: 20_514,
      lapses: 0,
      lastReviewedAt: null,
      firstReviewedOn: null,
      isNew: true,
      suspended: false,
    });
    expect(word?.content.definitions[0]?.forms[0]?.text).toBe("Necessary");

    const again = await repo.addWord("necessary", content("Other."));
    expect(again.kind).toBe("duplicate");
    expect(again.kind === "duplicate" && again.existing.text).toBe("Necessary");
    expect(await repo.wordCount()).toBe(1);
  });

  test("scrubs a form's text out of the definition", async () => {
    const { repo } = await openTestRepository();
    const practice: WordContent = {
      definitions: [
        {
          text: "To practise a skill; practice makes perfect.",
          partOfSpeech: "",
          forms: [
            { text: "practice", label: "", examples: [] },
            { text: "practise", label: "", examples: [] },
          ],
        },
      ],
    };
    await repo.addWord("practice", practice);

    const [saved] = await repo.wordsWithContent();
    const definition = saved?.content.definitions[0];
    expect(definition?.text).toBe("To _____ a skill; _____ makes perfect.");
    expect(definition?.forms.map((f) => f.text)).toEqual(["practice", "practise"]);
  });
});

describe("updateWord", () => {
  test("renaming onto another word changes nothing", async () => {
    const { repo } = await openTestRepository();
    await repo.addWord("alpha", content("First."));
    await repo.addWord("beta", content("Second."));
    const beta = await wordNamed(repo, "beta");

    const result = await repo.updateWord(beta.id, " Alpha ", beta.content);

    expect(result.kind).toBe("duplicate");
    expect(await repo.wordById(beta.id)).toEqual(beta);
  });

  test("a rename renames the base form", async () => {
    const { repo } = await openTestRepository();
    await repo.addWord("recieve", content("To get.", "I recieve mail."));
    const word = await wordNamed(repo, "recieve");

    const result = await repo.updateWord(word.id, "receive", word.content);

    expect(result).toEqual({ kind: "updated" });
    const saved = await repo.wordById(word.id);
    expect(saved?.text).toBe("receive");
    expect(saved?.normalizedText).toBe("receive");
    expect(saved?.content.definitions[0]?.forms[0]?.text).toBe("receive");
  });

  test("an update keeps scheduling and shownAt", async () => {
    const { repo, db } = await openTestRepository();
    await repo.addWord("rhythm", content("A pattern.", "The rhythm held."));
    const word = await wordNamed(repo, "rhythm");
    await db.put("words", { ...word, repetitions: 4, intervalDays: 15, isNew: false });
    const [card] = await repo.practicePool(1);
    await repo.markShown(card!);
    const shownAt = (await repo.wordById(word.id))?.content.definitions[0]?.forms[0]?.examples[0]?.shownAt;
    expect(shownAt).not.toBeNull();

    const stored = (await repo.wordById(word.id)) as StoredWord;
    await repo.updateWord(word.id, stored.text, apply(stored.content, { edit: "DefinitionText", definition: 0, value: "A beat." }));

    const saved = (await repo.wordById(word.id)) as StoredWord;
    expect(saved).toMatchObject({ repetitions: 4, intervalDays: 15, isNew: false });
    expect(saved.content.definitions[0]?.text).toBe("A beat.");
    expect(saved.content.definitions[0]?.forms[0]?.examples[0]?.shownAt).toBe(shownAt);
  });

  test("a later write to the row is kept, since only text and content are written", async () => {
    const { repo } = await openTestRepository();
    await repo.addWord("rhythm", content("A pattern."));
    const stale = await wordNamed(repo, "rhythm");

    await repo.setSuspended(stale.id, true);
    await repo.updateWord(stale.id, "rhythm", apply(stale.content, { edit: "DefinitionText", definition: 0, value: "A beat." }));

    expect(await repo.wordById(stale.id)).toMatchObject({ suspended: true });
  });

  test("a word deleted meanwhile is reported missing and not brought back", async () => {
    const { repo } = await openTestRepository();
    await repo.addWord("rhythm", content("A pattern."));
    const word = await wordNamed(repo, "rhythm");
    await repo.deleteWord(word.id);

    expect(await repo.updateWord(word.id, "rhythm", word.content)).toEqual({ kind: "missing" });
    expect(await repo.wordCount()).toBe(0);
  });
});

describe("deleteWord", () => {
  test("takes its log rows and no one else's", async () => {
    const { repo, db } = await openTestRepository();
    await repo.addWord("alpha", content("First."));
    await repo.addWord("beta", content("Second."));
    const alpha = await wordNamed(repo, "alpha");
    const beta = await wordNamed(repo, "beta");
    await repo.recordReview(alpha.id, true, "alpha");
    await repo.recordReview(alpha.id, false, "alpa");
    await repo.recordReview(beta.id, true, "beta");

    await repo.deleteWord(alpha.id)

    expect(await repo.wordById(alpha.id)).toBeUndefined();
    const logs = await db.getAll("reviewLog");
    expect(logs.map((l) => l.wordId)).toEqual([beta.id]);
  });
});

describe("importBackup", () => {
  const backupOf = (...words: object[]) => JSON.stringify({ version: 1, exportedAt: 1, words });
  const flat = (text: string, extra: object = {}) => ({
    text,
    definition: "A definition.",
    example: "Use it.",
    partOfSpeech: "noun",
    dueOn: 0,
    ...extra,
  });

  test("adds, skips blanks, duplicates and repeats within the file, and keeps local progress", async () => {
    const { repo, db } = await openTestRepository();
    await repo.addWord("known", content("Known."));
    const known = await wordNamed(repo, "known");
    await db.put("words", {
      ...known,
      repetitions: 4,
      intervalDays: 15,
      dueOn: 99,
      isNew: false,
      lastReviewedAt: 5,
      firstReviewedOn: 20,
    });
    const before = await repo.wordById(known.id);

    const summary = await repo.importBackup(
      backupOf(flat("fresh"), flat("Known", { repetitions: 0 }), flat("   "), flat("FRESH"), flat("other")),
    );

    expect(summary).toEqual({ added: 2, skipped: 3 });
    expect(await repo.wordById(known.id)).toEqual(before);
    expect(await repo.wordCount()).toBe(3);
    const fresh = await wordNamed(repo, "fresh");
    expect(fresh.content.definitions[0]).toEqual({
      text: "A definition.",
      partOfSpeech: "noun",
      forms: [{ text: "fresh", label: "", examples: [{ text: "Use it.", shownAt: null }] }],
    });
  });

  test("writes nothing for a refused file", async () => {
    const { repo } = await openTestRepository();
    await expect(repo.importBackup(backupOf(flat("fresh"), { text: "no due day", definition: "x" }))).rejects.toBeInstanceOf(
      BackupFormatError,
    );
    await expect(repo.importBackup("not json")).rejects.toThrow("That file isn't a Tortoise Spelling backup.");
    expect(await repo.wordCount()).toBe(0);
  });

  test("an export imports into a fresh repository as equal words and content", async () => {
    const source = await openTestRepository();
    await source.repo.addWord("necessary", content("Needed.", "It is necessary."));
    source.clock.nextDay();
    await source.repo.addWord("rhythm", content("A pattern.", "The rhythm held.", "noun"));
    const [first] = await source.repo.buildSession();
    await source.repo.markShown(first!);
    await source.repo.recordReview(first!.word.id, false, "typo");
    await source.repo.setSuspended((await wordNamed(source.repo, "rhythm")).id, true);

    const target = await openTestRepository();
    const summary = await target.repo.importBackup(await source.repo.exportBackup());

    expect(summary).toEqual({ added: 2, skipped: 0 });
    const strip = (words: StoredWord[]) => words.map(({ id: _id, ...rest }) => rest);
    expect(strip(await target.repo.wordsWithContent())).toEqual(strip(await source.repo.wordsWithContent()));
  });

  test("the export lists words oldest first with the exported time", async () => {
    const { repo, clock } = await openTestRepository();
    await repo.addWord("beta", content("Second."));
    clock.nextDay();
    await repo.addWord("alpha", content("First.", "", "noun"));
    const exported = JSON.parse(await repo.exportBackup());
    expect(exported.exportedAt).toBe(clock.millis());
    expect(exported.words.map((w: { text: string }) => w.text)).toEqual(["beta", "alpha"]);
    expect(exported).toEqual(JSON.parse(exportBackup((await repo.wordsWithContent()).reverse(), clock.millis())));
  });
});

describe("markShown", () => {
  const two: WordContent = {
    definitions: [
      {
        text: "Needed.",
        partOfSpeech: "",
        forms: [
          {
            text: "",
            label: "",
            examples: [
              { text: "It is necessary to rest.", shownAt: 1 },
              { text: "Water is necessary for life.", shownAt: null },
            ],
          },
        ],
      },
    ],
  };

  test("stamps one example and no other", async () => {
    const { repo, clock } = await openTestRepository();
    await repo.addWord("necessary", two);
    const [card] = await repo.practicePool(1);
    expect(card?.example?.text).toBe("Water is necessary for life.");

    await repo.markShown(card!);

    const examples = (await repo.wordsWithContent())[0]?.content.definitions[0]?.forms[0]?.examples;
    expect(examples?.map((e) => e.shownAt)).toEqual([1, clock.millis()]);
  });

  test("ignores a card whose example text has changed", async () => {
    const { repo } = await openTestRepository();
    await repo.addWord("necessary", two);
    const [card] = await repo.practicePool(1);
    const word = (await wordNamed(repo, "necessary"));
    await repo.updateWord(
      word.id,
      word.text,
      apply(word.content, { edit: "ExampleText", definition: 0, form: 0, example: 1, value: "Changed elsewhere." }),
    );

    await repo.markShown(card!);

    const examples = (await repo.wordById(word.id))?.content.definitions[0]?.forms[0]?.examples;
    expect(examples?.map((e) => e.shownAt)).toEqual([1, null]);
  });

  test("a card with no example is a no-op", async () => {
    const { repo } = await openTestRepository();
    await repo.addWord("rhythm", content("A pattern."));
    const [card] = await repo.practicePool(1);
    expect(card?.example).toBeNull();
    await repo.markShown(card!);
    expect(await repo.wordCount()).toBe(1);
  });
});

describe("recordReview", () => {
  test("for a deleted word writes no log row", async () => {
    const { repo, db } = await openTestRepository();
    await repo.addWord("rhythm", content("A pattern."));
    const word = await wordNamed(repo, "rhythm");
    await repo.deleteWord(word.id);

    await repo.recordReview(word.id, true, "rhythm");

    expect(await logCount(db)).toBe(0);
    expect(await repo.wordCount()).toBe(0);
  });

  test("reads the current row, so a later write is kept", async () => {
    const { repo, clock } = await openTestRepository();
    await repo.addWord("rhythm", content("A definition."));
    const stale = await wordNamed(repo, "rhythm");

    await repo.setSuspended(stale.id, true);
    await repo.recordReview(stale.id, true, "  rhythm ");

    const saved = (await repo.wordById(stale.id)) as StoredWord;
    expect(saved).toMatchObject({
      suspended: true,
      repetitions: 1,
      isNew: false,
      firstReviewedOn: 20_514,
      lastReviewedAt: clock.millis(),
    });
    expect(await repo.reviewedToday()).toBe(1);
  });

  test("reviewedToday counts words, not log rows", async () => {
    const { repo } = await openTestRepository();
    await repo.addWord("rhythm", content("A definition."));
    await repo.addWord("cat", content("An animal."));
    const rhythm = await wordNamed(repo, "rhythm");
    const cat = await wordNamed(repo, "cat");

    await repo.recordReview(rhythm.id, false, "rythm");
    await repo.recordReview(rhythm.id, true, "rhythm");
    await repo.recordReview(cat.id, true, "cat");

    expect(await repo.reviewedToday()).toBe(2);
  });
});

describe("settings", () => {
  test("default to 10 new words a day and clamp to 1..100", async () => {
    const { repo } = await openTestRepository();
    expect(await repo.settings()).toEqual({ newWordsPerDay: 10 });
    await repo.setNewWordsPerDay(0);
    expect((await repo.settings()).newWordsPerDay).toBe(1);
    await repo.setNewWordsPerDay(500);
    expect((await repo.settings()).newWordsPerDay).toBe(100);
    await repo.setNewWordsPerDay(25);
    expect((await repo.settings()).newWordsPerDay).toBe(25);
  });

  test("satisfied days keep a rolling 400-day window", async () => {
    const { repo, clock, db } = await openTestRepository();
    await repo.markTodaySatisfied();
    clock.advanceDays(399);
    await repo.markTodaySatisfied();
    expect((await db.get("settings", "satisfiedDays")) as number[]).toHaveLength(2);
    clock.advanceDays(1);
    await repo.markTodaySatisfied();
    expect((await db.get("settings", "satisfiedDays")) as number[]).toEqual([20_514 + 399, 20_514 + 400]);
  });
});

describe("subscribe", () => {
  test("tells listeners after a write and stops once unsubscribed", async () => {
    const { repo } = await openTestRepository();
    let calls = 0;
    const stop = repo.subscribe(() => calls++);

    await repo.addWord("rhythm", content("A pattern."));
    expect(calls).toBe(1);
    await repo.wordCount();
    expect(calls).toBe(1);

    stop();
    await repo.addWord("other", content("Another."));
    expect(calls).toBe(1);
  });
});
