import { describe, expect, it } from "vitest";
import {
  apply,
  blankContent,
  exampleMissesForm,
  isComplete,
  preparedFor,
  searchTerms,
  simpleContent,
  type WordContent,
} from "../../src/domain/wordContent";
import { cases, contentFrom, editFrom, expectedContent, expectFunctions, loadGolden } from "./load";

const file = loadGolden("content");

describe("content golden cases", () => {
  it("has a runner for every function", () => {
    expectFunctions(file, [
      "blankContent",
      "simpleContent",
      "preparedFor",
      "isComplete",
      "apply",
      "searchTerms",
      "exampleMissesForm",
    ]);
  });

  describe.each(cases(file, "blankContent"))("blankContent: $name", (c) => {
    it("matches", () => expect(blankContent()).toEqual(expectedContent(c.out, blankContent())));
  });
  describe.each(cases(file, "simpleContent"))("simpleContent: $name", (c) => {
    it("matches", () => {
      expect(simpleContent(c.word, c.definition, c.partOfSpeech, c.example)).toEqual(contentFrom(c.out));
    });
  });
  describe.each(cases(file, "preparedFor"))("preparedFor: $name", (c) => {
    it("matches", () => {
      const input = contentFrom(c.content);
      expect(preparedFor(input, c.word)).toEqual(expectedContent(c.out, input));
    });
  });
  describe.each(cases(file, "isComplete"))("isComplete: $name", (c) => {
    it("matches", () => expect(isComplete(contentFrom(c.content))).toBe(c.out));
  });
  describe.each(cases(file, "apply"))("apply: $name", (c) => {
    it("matches", () => {
      const input = contentFrom(c.content);
      const edited = (c.edits as unknown[]).reduce<WordContent>((content, edit) => apply(content, editFrom(edit)), input);
      expect(edited).toEqual(expectedContent(c.out, input));
    });
  });
  describe.each(cases(file, "searchTerms"))("searchTerms: $name", (c) => {
    it("matches", () => {
      expect([...searchTerms(contentFrom(c.content), c.word)].sort()).toEqual([...c.out].sort());
    });
  });
  describe.each(cases(file, "exampleMissesForm"))("exampleMissesForm: $name", (c) => {
    it("matches", () => expect(exampleMissesForm(c.example, c.form)).toBe(c.out));
  });
});
