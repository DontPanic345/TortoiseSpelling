import { openDatabase, type Db } from "../../src/data/db";
import { createRepository } from "../../src/data/repository";
import type { DefinitionDraft, WordContent } from "../../src/domain/wordContent";
import { testClock, type TestClock } from "./testClock";

let counter = 0;

/** A repository over a fresh database, a test clock, and fuzz that adds nothing. */
export async function openTestRepository(clock: TestClock = testClock()) {
  const db = await openDatabase(`test-${++counter}`);
  const repo = createRepository({ db, clock, fuzz: (today, days) => today + days });
  return { db, clock, repo };
}

export type { Db };

/** One definition with the base form and, when given, one example. */
export function content(definition: string, example = "", partOfSpeech = ""): WordContent {
  const first: DefinitionDraft = {
    text: definition,
    partOfSpeech,
    forms: [{ text: "", label: "", examples: example === "" ? [] : [{ text: example, shownAt: null }] }],
  };
  return { definitions: [first] };
}
