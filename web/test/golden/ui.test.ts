import { describe, expect, it } from "vitest";
import { canSave, applying, newAddWordState } from "../../src/ui/add/addWordState";
import { completionHeadline } from "../../src/ui/complete/completionState";
import { blankedExample } from "../../src/ui/review/reviewState";
import { importMessage } from "../../src/ui/settings/settingsState";
import { filterRows, noMatchesBody, statusLabel } from "../../src/ui/words/wordListState";
import { cases, contentFrom, expectFunctions, loadGolden, wordFrom } from "./load";

const file = loadGolden("ui");

describe("ui golden cases", () => {
  it("has a runner for every function", () => {
    expectFunctions(file, [
      "statusLabel",
      "noMatchesBody",
      "filterRows",
      "completionHeadline",
      "importMessage",
      "blankedExample",
      "canSave",
      "applying",
    ]);
  });

  describe.each(cases(file, "statusLabel"))("statusLabel: $name", (c) => {
    it("matches", () => expect(statusLabel(wordFrom(c.word), c.today)).toBe(c.out));
  });

  describe.each(cases(file, "noMatchesBody"))("noMatchesBody: $name", (c) => {
    it("matches", () => expect(noMatchesBody(c.query, c.filter)).toBe(c.out));
  });

  describe.each(cases(file, "filterRows"))("filterRows: $name", (c) => {
    it("matches", () => {
      const words = c.words.map((w: any) => ({ ...wordFrom(w), content: contentFrom(w.content) }));
      const rows = filterRows(words, c.query, c.filter, c.today);
      // build-3 compares checkForms; until then the web rows don't have it.
      const expected = c.out.map(({ checkForms, ...row }: any) => row);
      expect(rows.map((r) => ({ text: r.word.text, status: r.status, definition: r.definition }))).toEqual(expected);
    });
  });

  describe.each(cases(file, "completionHeadline"))("completionHeadline: $name", (c) => {
    it("matches", () => expect(completionHeadline(c.nextDueDay, c.today)).toBe(c.out));
  });

  describe.each(cases(file, "importMessage"))("importMessage: $name", (c) => {
    it("matches", () => expect(importMessage(c.added, c.skipped)).toBe(c.out));
  });

  describe.each(cases(file, "blankedExample"))("blankedExample: $name", (c) => {
    it("matches", () => expect(blankedExample(c.form, c.example ?? null)).toEqual(c.out));
  });

  describe.each(cases(file, "canSave"))("canSave: $name", (c) => {
    it("matches", () => expect(canSave(c.text, contentFrom(c.content))).toBe(c.out));
  });

  describe.each(cases(file, "applying"))("applying: $name", (c) => {
    it("matches", () => {
      const s = c.state;
      const state = {
        ...newAddWordState(s.editingId ?? null),
        text: s.text,
        content: contentFrom(s.content),
        paste: s.pasteText === undefined ? null : { text: s.pasteText, result: null },
        message: s.message ?? null,
        addedThisSession: s.addedThisSession ?? 0,
        totalWords: s.totalWords ?? 0,
      };
      const answer = { kind: "valid" as const, word: c.answer.word, content: contentFrom(c.answer.content), renames: c.answer.renames };
      expect(applying(state, answer)).toEqual({
        editingId: c.out.editingId ?? null,
        text: c.out.text,
        content: contentFrom(c.out.content),
        paste: null,
        message: c.out.message ?? null,
        addedThisSession: c.out.addedThisSession ?? 0,
        totalWords: c.out.totalWords ?? 0,
      });
    });
  });
});
