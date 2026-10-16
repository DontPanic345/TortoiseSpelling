import { readFileSync } from "node:fs";
import { expect } from "vitest";
import type { Word } from "../../src/data/model";
import { lookupPrompt } from "../../src/domain/lookupPrompt";
import { normalizeWord } from "../../src/domain/text";
import type { ContentEdit, WordContent } from "../../src/domain/wordContent";
import { blankContent } from "../../src/domain/wordContent";

/** One golden case: a name plus whatever inputs and expectations its function needs. */
export type Case = { name: string } & Record<string, any>;

export interface GoldenFile {
  about: string;
  [fn: string]: any;
}

/** Seeds every random case is run over. */
export const SEEDS = Array.from({ length: 50 }, (_, i) => i);

export function loadGolden(name: string): GoldenFile {
  const url = new URL(`../../../golden/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as GoldenFile;
}

/** The cases of one function. */
export function cases(file: GoldenFile, fn: string): Case[] {
  const list = file[fn];
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`golden file has no cases for ${fn}`);
  }
  return list as Case[];
}

/** Every function in the file has a runner, so no case sits unread. */
export function expectFunctions(file: GoldenFile, known: string[]): void {
  const present = Object.keys(file).filter((k) => k !== "about");
  expect([...present].sort()).toEqual([...known].sort());
}

/** A Word from a case: only the fields the case lists, the rest as Word's Kotlin defaults. */
export function wordFrom(c: Record<string, any> = {}): Word {
  const text: string = c.text ?? "cat";
  return {
    id: c.id ?? 0,
    text,
    normalizedText: normalizeWord(text),
    createdAt: c.createdAt ?? 0,
    repetitions: c.repetitions ?? 0,
    easeFactor: c.easeFactor ?? 2.5,
    intervalDays: c.intervalDays ?? 0,
    dueOn: c.dueOn ?? 0,
    lapses: c.lapses ?? 0,
    lastReviewedAt: c.lastReviewedAt ?? null,
    firstReviewedOn: c.firstReviewedOn ?? null,
    isNew: c.isNew ?? true,
    suspended: c.suspended ?? false,
  };
}

/** Doubles compare within 1e-9; everything else exactly. */
export function expectSame(actual: unknown, expected: unknown): void {
  if (typeof expected === "number" && !Number.isInteger(expected)) {
    expect(actual).toBeCloseTo(expected, 9);
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true);
    const got = actual as unknown[];
    expect(got).toHaveLength(expected.length);
    expected.forEach((e, i) => expectSame(got[i], e));
  } else if (expected !== null && typeof expected === "object") {
    const got = actual as Record<string, unknown>;
    expect(Object.keys(got).sort()).toEqual(Object.keys(expected).sort());
    for (const [k, e] of Object.entries(expected)) expectSame(got[k], e);
  } else {
    expect(actual).toBe(expected);
  }
}

/** Content from a case: the WordContent shape with blanks left out, or "blank" for a new word's draft. */
export function contentFrom(value: any): WordContent {
  if (value === "blank") return blankContent();
  return {
    definitions: value.definitions.map((d: any) => ({
      text: d.text,
      partOfSpeech: d.partOfSpeech ?? "",
      forms: d.forms.map((f: any) => ({
        text: f.text,
        label: f.label ?? "",
        examples: (f.examples ?? []).map((e: any) => ({ text: e.text, shownAt: e.shownAt ?? null })),
      })),
    })),
  };
}

/** The expected content of a case: its `out`, where "same" means the input unchanged. */
export function expectedContent(out: any, input: WordContent): WordContent {
  return out === "same" ? input : contentFrom(out);
}

/** An edit as a case writes it: { "edit": "AddForm", "d": 0 }. */
export function editFrom(e: any): ContentEdit {
  switch (e.edit) {
    case "DefinitionText":
    case "PartOfSpeech":
      return { edit: e.edit, definition: e.d, value: e.value };
    case "FormText":
    case "FormLabel":
      return { edit: e.edit, definition: e.d, form: e.f, value: e.value };
    case "ExampleText":
      return { edit: e.edit, definition: e.d, form: e.f, example: e.e, value: e.value };
    case "AddDefinition":
      return { edit: e.edit };
    case "RemoveDefinition":
    case "AddForm":
      return { edit: e.edit, definition: e.d };
    case "RemoveForm":
    case "AddExample":
      return { edit: e.edit, definition: e.d, form: e.f };
    case "RemoveExample":
      return { edit: e.edit, definition: e.d, form: e.f, example: e.e };
    default:
      throw new Error(`unknown edit ${e.edit}`);
  }
}

/** Pasted text from a case: a string, or parts joined: a string, { repeat, times } or { prompt }. */
export function textFrom(value: string | (string | { repeat: string; times: number } | { prompt: string })[]): string {
  if (typeof value === "string") return value;
  return value
    .map((part) => {
      if (typeof part === "string") return part;
      return "prompt" in part ? lookupPrompt(part.prompt) : part.repeat.repeat(part.times);
    })
    .join("");
}
