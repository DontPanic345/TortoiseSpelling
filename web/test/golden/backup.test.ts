import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BackupFormatError, exportBackup, parseBackup, toBackup, toImport } from "../../src/data/backup";
import { preparedFor } from "../../src/domain/wordContent";
import { cases, contentFrom, expectFunctions, expectSame, loadGolden } from "./load";

const file = loadGolden("backup");
const NOW = 1_700_000_000_000;

function backupFile(name: string): string {
  return readFileSync(new URL(`../../../golden/backup/${name}`, import.meta.url), "utf8");
}

describe("backup golden cases", () => {
  it("has a runner for every function", () => {
    expectFunctions(file, ["files", "refusals", "quirks"]);
  });

  describe.each(cases(file, "files"))("files: $name", (c) => {
    const ignore = c.ignoreCreatedAt === true;
    const parsed = parseBackup(backupFile(c.file), NOW);
    const imported = parsed.words.map(toImport);
    const strip = <T extends object>(o: T): T => {
      if (!ignore) return o;
      const { createdAt: _createdAt, ...rest } = o as Record<string, unknown>;
      return rest as T;
    };

    it("imports as written", () => {
      expect(imported).toHaveLength(c.imported.length);
      imported.forEach((actual, i) => {
        expectSame(strip(actual.word), strip(c.imported[i].word));
        expect(actual.content).toEqual(contentFrom(c.imported[i].content));
      });
    });

    it("exports as written", () => {
      const stored = imported.map((i) => ({
        ...i.word,
        id: 1,
        content: preparedFor(i.content, i.word.text),
      }));
      stored.forEach((w, i) => expectSame(strip(toBackup(w)), strip(c.exported[i])));
      // The text the app writes parses back to the same words.
      const text = exportBackup(stored, NOW);
      expect(parseBackup(text, 0).words.map(toImport)).toEqual(
        stored.map(({ content, id: _id, ...word }) => ({ word, content })),
      );
    });
  });

  describe.each(cases(file, "refusals"))("refusals: $name", (c) => {
    it("is refused with the message", () => {
      expect(() => parseBackup(c.text, NOW)).toThrow(new BackupFormatError(c.error));
      try {
        parseBackup(c.text, NOW);
      } catch (e) {
        expect(e).toBeInstanceOf(BackupFormatError);
      }
    });
  });

  describe.each(cases(file, "quirks"))("quirks: $name", (c) => {
    it("is read as the JVM reads it", () => {
      if (c.error !== undefined) {
        expect(() => parseBackup(c.text, NOW)).toThrow(new BackupFormatError(c.error));
        return;
      }
      const [word] = parseBackup(c.text, NOW).words;
      if (c.dueOn !== undefined) expect(word?.dueOn).toBe(c.dueOn);
      if (c.isNew !== undefined) expect(word?.isNew).toBe(c.isNew);
      if (c.easeFactor !== undefined) expect(word?.easeFactor).toBeCloseTo(c.easeFactor, 9);
    });
  });
});
