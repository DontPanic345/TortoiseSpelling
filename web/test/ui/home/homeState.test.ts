import { describe, expect, test } from "vitest";
import { dateLabel, loadHome, shouldNudgeBackup } from "../../../src/ui/home/homeState";
import { fakePlatform } from "../../support/fakePlatform";
import { content, openTestRepository } from "../../support/repo";
import { today } from "../../../src/domain/days";

describe("loadHome", () => {
  test("a clear plan with words marks today satisfied", async () => {
    const { repo, clock, db } = await openTestRepository();
    await repo.addWord("cat", content("a pet"));
    const id = (await repo.wordsWithContent())[0]!.id;
    await repo.recordReview(id, true, "cat");
    const state = await loadHome(repo, clock, fakePlatform());
    expect(state.plan).toEqual({ dueCount: 0, newCount: 0 });
    expect((await db.get("settings", "satisfiedDays")) as number[]).toEqual([today(clock)]);
  });

  test("no words doesn't mark today satisfied", async () => {
    const { repo, clock, db } = await openTestRepository();
    const state = await loadHome(repo, clock, fakePlatform());
    expect(state.totalWords).toBe(0);
    expect(await db.get("settings", "satisfiedDays")).toBeUndefined();
  });

  test("reads the greeting, date and today", async () => {
    const { repo, clock } = await openTestRepository();
    const state = await loadHome(repo, clock, fakePlatform());
    expect(state.greeting).toBe("Good morning");
    expect(state.today).toBe(today(clock));
    expect(state.loading).toBe(false);
  });

  test("the nudge follows the platform and the last export", async () => {
    const { repo, clock } = await openTestRepository();
    await repo.addWord("cat", content("a pet"));
    const platform = fakePlatform();
    expect((await loadHome(repo, clock, platform)).showBackupNudge).toBe(true);
    await repo.setLastExportedAt(clock.millis());
    expect((await loadHome(repo, clock, platform)).showBackupNudge).toBe(false);
    platform.persisted = true;
    clock.advanceDays(40);
    expect((await loadHome(repo, clock, platform)).showBackupNudge).toBe(false);
  });
});

describe("dateLabel", () => {
  test("reads weekday, day and month on the test clock's day", async () => {
    const { clock } = await openTestRepository();
    expect(dateLabel(today(clock), "en")).toBe("Monday 2 March");
  });
});

describe("shouldNudgeBackup", () => {
  const now = 100 * 86_400_000;
  const day = 86_400_000;
  test("never without words", () => expect(shouldNudgeBackup(0, false, null, now)).toBe(false));
  test("never when storage is persisted", () => expect(shouldNudgeBackup(3, true, null, now)).toBe(false));
  test("never exported", () => expect(shouldNudgeBackup(3, false, null, now)).toBe(true));
  test("a recent export", () => expect(shouldNudgeBackup(3, false, now - 29 * day, now)).toBe(false));
  test("an export 30 days old", () => expect(shouldNudgeBackup(3, false, now - 30 * day, now)).toBe(true));
});
