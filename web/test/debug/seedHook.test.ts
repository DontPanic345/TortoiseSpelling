// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { fakePush } from "../../src/debug/fakePush";
import { installSeedHook } from "../../src/debug/seedHook";
import { fakePlatform } from "../support/fakePlatform";
import { openTestRepository } from "../support/repo";

const push = fakePush();

async function installed() {
  const { repo, clock } = await openTestRepository();
  installSeedHook({ repository: repo, clock, platform: fakePlatform(), autoAdvanceMillis: 0, reminders: null }, push);
  return repo;
}

afterEach(() => {
  delete window.__tortoiseSpellingSeed;
  delete window.__tortoiseSpellingPush;
});

describe("the seed hook", () => {
  it("adds words with their definitions, parts of speech and examples", async () => {
    const repo = await installed();

    await window.__tortoiseSpellingSeed?.([
      { word: "necessary", definition: "needed or required", example: "It is necessary to sleep." },
      { word: "rhythm", definition: "a regular pattern", partOfSpeech: "noun" },
    ]);

    const words = (await repo.wordsWithContent()).sort((a, b) => a.id - b.id);
    expect(words.map((w) => w.text)).toEqual(["necessary", "rhythm"]);
    const [necessary, rhythm] = words.map((w) => w.content.definitions[0]);
    expect(necessary?.text).toBe("needed or required");
    expect(necessary?.forms[0]?.examples.map((e) => e.text)).toEqual(["It is necessary to sleep."]);
    expect(rhythm?.partOfSpeech).toBe("noun");
  });

  it("throws on a duplicate, so a Given that can't arrange fails at once", async () => {
    await installed();
    await window.__tortoiseSpellingSeed?.([{ word: "rhythm" }]);

    await expect(window.__tortoiseSpellingSeed?.([{ word: "Rhythm" }])).rejects.toThrow(/duplicate/);
  });

  it("answers the next permission request as told", async () => {
    await installed();
    window.__tortoiseSpellingPush?.answer("denied");

    expect(await push.requestPermission()).toBe("denied");
    expect(await push.permission()).toBe("denied");
  });
});
