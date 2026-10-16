import { describe, expect, test } from "vitest";
import { createRepository } from "../../src/data/repository";
import { content, openTestRepository } from "../support/repo";
import { seeded } from "../support/seeded";
import { testClock } from "../support/testClock";

const D = Date.UTC(2026, 2, 2) / 86_400_000;

type Repo = Awaited<ReturnType<typeof openTestRepository>>["repo"];

async function review(repo: Repo, text: string) {
  const card = (await repo.buildSession()).find((c) => c.word.text === text);
  if (!card) throw new Error(`${text} is not in today's session`);
  await repo.recordReview(card.word.id, true, text);
}

describe("reminder settings", () => {
  test("default to on, at 08:00, with no registration", async () => {
    const { repo } = await openTestRepository();
    expect(await repo.settings()).toMatchObject({
      reminderEnabled: true,
      reminderHour: 8,
      reminderMinute: 0,
      pushRegistration: null,
      quietCheckedThrough: null,
    });
  });

  test("the time is clamped like Android's SettingsStore", async () => {
    const { repo } = await openTestRepository();
    await repo.setReminderTime(25, -4);
    expect(await repo.settings()).toMatchObject({ reminderHour: 23, reminderMinute: 0 });
    await repo.setReminderTime(-1, 75.9);
    expect(await repo.settings()).toMatchObject({ reminderHour: 0, reminderMinute: 59 });
    await repo.setReminderTime(7, 30);
    expect(await repo.settings()).toMatchObject({ reminderHour: 7, reminderMinute: 30 });
  });

  test("the switch can be turned off and on", async () => {
    const { repo } = await openTestRepository();
    await repo.setReminderEnabled(false);
    expect((await repo.settings()).reminderEnabled).toBe(false);
    await repo.setReminderEnabled(true);
    expect((await repo.settings()).reminderEnabled).toBe(true);
  });

  test("a registration is kept, cleared, and tells nobody", async () => {
    const { repo } = await openTestRepository();
    let heard = 0;
    repo.subscribe(() => heard++);
    const registration = { endpoint: "https://fcm.googleapis.com/x", publicKey: "k", sent: "{}", sentAt: 5 };
    await repo.setPushRegistration(registration);
    expect((await repo.settings()).pushRegistration).toEqual(registration);
    await repo.setPushRegistration(null);
    expect((await repo.settings()).pushRegistration).toBeNull();
    expect(heard).toBe(0);
  });
});

describe("reminderDay", () => {
  test("is null with no words", async () => {
    const { repo } = await openTestRepository();
    expect(await repo.reminderDay()).toBeNull();
  });

  test("is today with a new word to introduce", async () => {
    const { repo } = await openTestRepository();
    await repo.addWord("necessary", content("Needed.", "It is necessary."));
    expect(await repo.reminderDay()).toBe(D);
  });

  test("is tomorrow when today's allowance is used up and a new word is left", async () => {
    const { repo, db } = await openTestRepository();
    await repo.setNewWordsPerDay(1);
    await repo.addWord("necessary", content("Needed.", "It is necessary."));
    await repo.addWord("separate", content("Apart.", "Keep them separate."));
    await review(repo, "necessary");
    const reviewed = (await repo.wordsWithContent()).find((word) => word.text === "necessary");
    await db.put("words", { ...reviewed!, dueOn: D + 5 });
    expect(await repo.todayPlan()).toEqual({ dueCount: 0, newCount: 0 });
    expect(await repo.reminderDay()).toBe(D + 1);
  });

  test("is the next due day when only scheduled words remain", async () => {
    const { repo } = await openTestRepository();
    await repo.addWord("necessary", content("Needed.", "It is necessary."));
    await review(repo, "necessary");
    expect(await repo.reminderDay()).toBe(D + 1);
  });

  test("ignores suspended words", async () => {
    const { repo } = await openTestRepository();
    await repo.addWord("necessary", content("Needed.", "It is necessary."));
    const [word] = await repo.wordsWithContent();
    await repo.setSuspended(word?.id ?? 0, true);
    expect(await repo.reminderDay()).toBeNull();
  });

  test("is the first day on which the plan would be non-empty, for random word sets", async () => {
    for (let seed = 1; seed <= 25; seed++) {
      const random = seeded(seed);
      const { db, repo } = await openTestRepository();
      const pick = (n: number) => Math.floor(random() * n);
      await repo.setNewWordsPerDay(1 + pick(3));
      for (let i = 0; i < pick(8); i++) await repo.addWord(`word${i}`, content("Meaning.", `A word${i}.`));
      for (const word of await repo.wordsWithContent()) {
        const kind = pick(4);
        await db.put("words", {
          ...word,
          isNew: kind === 0,
          suspended: pick(4) === 0,
          dueOn: D - 3 + pick(60),
          firstReviewedOn: kind === 0 ? null : D - 10 + pick(11),
        });
      }

      const expected = await (async () => {
        for (let day = D; day <= D + 400; day++) {
          const clock = testClock();
          clock.advanceDays(day - D);
          const plan = await createRepository({ db, clock }).todayPlan();
          if (plan.dueCount + plan.newCount > 0) return day;
        }
        return null;
      })();
      expect(await repo.reminderDay(), `seed ${seed}`).toBe(expected);
    }
  });
});

describe("settleQuietDays", () => {
  test("does nothing on its first run but remembers yesterday", async () => {
    const { repo } = await openTestRepository();
    await repo.settleQuietDays();
    expect((await repo.settings()).quietCheckedThrough).toBe(D - 1);
    expect(await repo.currentStreak()).toBe(0);
  });

  test("marks a quiet gap of three days and stops at the first due day", async () => {
    const { repo, clock, db } = await openTestRepository();
    await repo.addWord("necessary", content("Needed.", "It is necessary."));
    await repo.settleQuietDays();
    await review(repo, "necessary");
    const [word] = await repo.wordsWithContent();
    await db.put("words", { ...word!, dueOn: D + 4 });
    clock.nextDay();
    await repo.settleQuietDays();
    await db.delete("settings", "satisfiedDays");

    clock.advanceDays(3);
    await repo.settleQuietDays();
    expect(await db.get("settings", "satisfiedDays")).toEqual([D + 1, D + 2, D + 3]);
    expect((await repo.settings()).quietCheckedThrough).toBe(D + 3);
  });

  test("the streak carries on across the gap", async () => {
    const { repo, clock, db } = await openTestRepository();
    await repo.addWord("necessary", content("Needed.", "It is necessary."));
    await repo.settleQuietDays();
    await review(repo, "necessary");
    const [word] = await repo.wordsWithContent();
    await db.put("words", { ...word!, dueOn: D + 4 });

    clock.advanceDays(4);
    expect(await repo.currentStreak()).toBe(0);
    await repo.settleQuietDays();
    await review(repo, "necessary");
    expect(await repo.currentStreak()).toBe(2);
  });

  test("does not mark a day that had something to practise", async () => {
    const { repo, clock, db } = await openTestRepository();
    await repo.addWord("necessary", content("Needed.", "It is necessary."));
    await repo.settleQuietDays();
    await review(repo, "necessary");
    clock.nextDay();
    await repo.settleQuietDays();
    await db.delete("settings", "satisfiedDays");

    clock.advanceDays(2);
    await repo.settleQuietDays();
    expect(await db.get("settings", "satisfiedDays")).toBeUndefined();
    expect((await repo.settings()).quietCheckedThrough).toBe(D + 2);
  });

  test("marks nothing, but advances, with the reminder off", async () => {
    const { repo, clock, db } = await openTestRepository();
    await repo.settleQuietDays();
    await repo.setReminderEnabled(false);
    clock.advanceDays(3);
    await repo.settleQuietDays();
    expect(await db.get("settings", "satisfiedDays")).toBeUndefined();
    expect((await repo.settings()).quietCheckedThrough).toBe(D + 2);
  });

  test("writes nothing and tells nobody on a second call the same day", async () => {
    const { repo, clock, db } = await openTestRepository();
    await repo.settleQuietDays();
    clock.advanceDays(2);
    let heard = 0;
    repo.subscribe(() => heard++);
    await repo.settleQuietDays();
    const days = await db.get("settings", "satisfiedDays");
    const checked = (await repo.settings()).quietCheckedThrough;
    await repo.settleQuietDays();
    expect(await db.get("settings", "satisfiedDays")).toEqual(days);
    expect((await repo.settings()).quietCheckedThrough).toBe(checked);
    expect(heard).toBe(0);
  });
});
