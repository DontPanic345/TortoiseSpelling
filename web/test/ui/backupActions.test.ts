import { describe, expect, it } from "vitest";
import { exportWords, importWords } from "../../src/ui/backupActions";
import { fakePlatform } from "../support/fakePlatform";
import { content, openTestRepository } from "../support/repo";

async function setup() {
  const { repo, clock } = await openTestRepository();
  const platform = fakePlatform();
  return { repo, clock, platform, container: { repository: repo, clock, platform, autoAdvanceMillis: 0 } };
}

describe("backupActions", () => {
  it("export saves the file, sets lastExportedAt and says so", async () => {
    const { repo, clock, platform, container } = await setup();
    await repo.addWord("cat", content("a pet"));
    expect(await exportWords(container)).toBe("Backup saved.");
    expect(platform.saved.map((s) => s.name)).toEqual(["tortoisespelling-backup.json"]);
    expect((await repo.settings()).lastExportedAt).toBe(clock.millis());
  });

  it("a cancelled save says nothing and doesn't set it", async () => {
    const { repo, platform, container } = await setup();
    platform.saveResult = "cancelled";
    expect(await exportWords(container)).toBeNull();
    expect((await repo.settings()).lastExportedAt).toBeNull();
  });

  it("a failed save says it couldn't write the file", async () => {
    const { repo, platform, container } = await setup();
    platform.saveError = new Error("nope");
    expect(await exportWords(container)).toBe("Couldn't write that file.");
    expect((await repo.settings()).lastExportedAt).toBeNull();
  });

  it("importing a backup built by exportBackup adds its words", async () => {
    const source = await setup();
    await source.repo.addWord("cat", content("a pet"));
    await source.repo.addWord("dog", content("another pet"));
    const text = await source.repo.exportBackup();
    const target = await setup();
    expect(await importWords(target.container, new File([text], "b.json"))).toBe("Imported 2 words.");
    expect(await target.repo.wordCount()).toBe(2);
    expect(await importWords(target.container, new File([text], "b.json"))).toBe(
      "Imported 0 words, skipped 2 already in your list.",
    );
  });

  it("importing not-json gives the format error's message", async () => {
    const { container } = await setup();
    const message = await importWords(container, new File(["not json"], "b.json"));
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toBe("Couldn't read that file.");
  });

  it("an unreadable file says it couldn't read it", async () => {
    const { container } = await setup();
    const file = { text: () => Promise.reject(new Error("io")) };
    expect(await importWords(container, file)).toBe("Couldn't read that file.");
  });
});
