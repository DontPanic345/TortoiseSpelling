import { ktIsBlank, ktTrim, normalizeWord } from "../domain/text";
import { simpleContent, type WordContent } from "../domain/wordContent";
import type { StoredWord, Word } from "./model";

/**
 * On-disk backup format, shared with the Android app (`Backup.kt`): the same JSON, read and
 * written by both. Fields are added with defaults and removed outright, and unknown keys
 * are ignored, so every build reads every other build's files and the version stays at 1.
 */
export const CURRENT_VERSION = 1;

export interface BackupFile {
  version: number;
  exportedAt: number;
  words: BackupWord[];
}

export interface BackupWord {
  text: string;
  definition: string;
  example: string;
  partOfSpeech: string | null;
  createdAt: number;
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  dueOn: number;
  lapses: number;
  lastReviewedAt: number | null;
  firstReviewedOn: number | null;
  isNew: boolean;
  suspended: boolean;
  definitions: BackupDefinition[];
}

export interface BackupDefinition {
  text: string;
  partOfSpeech: string | null;
  forms: BackupForm[];
}

export interface BackupForm {
  text: string;
  label: string | null;
  examples: BackupExample[];
}

export interface BackupExample {
  text: string;
  shownAt: number | null;
}

/** A word read from a backup, with its teaching content. */
export interface ImportedWord {
  word: Omit<Word, "id">;
  content: WordContent;
}

/** Thrown when a file is not a Tortoise Spelling backup, or is from a newer app version. */
export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupFormatError";
  }
}

const NOT_A_BACKUP = "That file isn't a Tortoise Spelling backup.";

const INT_MIN = -(2 ** 31);
const INT_MAX = 2 ** 31 - 1;

function bad(): never {
  throw new BackupFormatError(NOT_A_BACKUP);
}

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj {
  if (value === null || typeof value !== "object" || Array.isArray(value)) bad();
  return value as Obj;
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) bad();
  return value;
}

function str(value: unknown): string {
  if (typeof value !== "string") bad();
  return value;
}

/** kotlinx also takes a quoted boolean, in any case. */
function bool(value: unknown): boolean {
  const lower = typeof value === "string" ? value.toLowerCase() : value;
  if (lower === "true") return true;
  if (lower === "false") return false;
  if (typeof value !== "boolean") bad();
  return value;
}

/** kotlinx reads a quoted integer where a number is expected; a string that is exactly one is taken. */
function integer(value: unknown, min: number, max: number): number {
  const n = typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) bad();
  return n;
}

const int = (value: unknown) => integer(value, INT_MIN, INT_MAX);
const long = (value: unknown) => integer(value, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);

function double(value: unknown): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) bad();
  return n;
}

/** A key that may be left out; present, it must be the right type (`null` only where nullable). */
function optional<T>(o: Obj, key: string, read: (v: unknown) => T, fallback: T): T {
  return key in o ? read(o[key]) : fallback;
}

function nullable<T>(read: (v: unknown) => T): (v: unknown) => T | null {
  return (v) => (v === null ? null : read(v));
}

function required<T>(o: Obj, key: string, read: (v: unknown) => T): T {
  if (!(key in o)) bad();
  return read(o[key]);
}

function readExample(value: unknown): BackupExample {
  const o = obj(value);
  return { text: required(o, "text", str), shownAt: optional(o, "shownAt", nullable(long), null) };
}

function readForm(value: unknown): BackupForm {
  const o = obj(value);
  return {
    text: required(o, "text", str),
    label: optional(o, "label", nullable(str), null),
    examples: optional(o, "examples", (v) => list(v).map(readExample), []),
  };
}

function readDefinition(value: unknown): BackupDefinition {
  const o = obj(value);
  return {
    text: required(o, "text", str),
    partOfSpeech: optional(o, "partOfSpeech", nullable(str), null),
    forms: optional(o, "forms", (v) => list(v).map(readForm), []),
  };
}

function readWord(value: unknown, now: number): BackupWord {
  const o = obj(value);
  return {
    text: required(o, "text", str),
    definition: required(o, "definition", str),
    example: optional(o, "example", str, ""),
    partOfSpeech: optional(o, "partOfSpeech", nullable(str), null),
    createdAt: optional(o, "createdAt", long, now),
    repetitions: optional(o, "repetitions", int, 0),
    easeFactor: optional(o, "easeFactor", double, 2.5),
    intervalDays: optional(o, "intervalDays", int, 0),
    dueOn: required(o, "dueOn", long),
    lapses: optional(o, "lapses", int, 0),
    lastReviewedAt: optional(o, "lastReviewedAt", nullable(long), null),
    firstReviewedOn: optional(o, "firstReviewedOn", nullable(long), null),
    isNew: optional(o, "isNew", bool, true),
    suspended: optional(o, "suspended", bool, false),
    definitions: optional(o, "definitions", (v) => list(v).map(readDefinition), []),
  };
}

/**
 * Reads a backup as kotlinx decodes it. `now` stands in for the `exportedAt` and
 * `createdAt` defaults; nothing here reads the clock.
 */
export function parseBackup(text: string, now: number): BackupFile {
  let backup: BackupFile;
  try {
    const o = obj(JSON.parse(text));
    backup = {
      version: optional(o, "version", int, CURRENT_VERSION),
      exportedAt: optional(o, "exportedAt", long, now),
      words: required(o, "words", (v) => list(v).map((w) => readWord(w, now))),
    };
  } catch {
    throw new BackupFormatError(NOT_A_BACKUP);
  }
  if (backup.version > CURRENT_VERSION) {
    throw new BackupFormatError(
      `That backup was made by a newer version of Tortoise Spelling (v${backup.version}).`,
    );
  }
  return backup;
}

/** The word row and teaching tree a backup word becomes; the tree when there is one, else the flat fields. */
export function toImport(word: BackupWord): ImportedWord {
  return {
    word: {
      text: ktTrim(word.text),
      normalizedText: normalizeWord(word.text),
      createdAt: word.createdAt,
      repetitions: word.repetitions,
      easeFactor: word.easeFactor,
      intervalDays: word.intervalDays,
      dueOn: word.dueOn,
      lapses: word.lapses,
      lastReviewedAt: word.lastReviewedAt,
      firstReviewedOn: word.firstReviewedOn,
      isNew: word.isNew,
      suspended: word.suspended,
    },
    content:
      word.definitions.length === 0
        ? simpleContent(word.text, word.definition, word.partOfSpeech, word.example)
        : {
            definitions: word.definitions.map((d) => ({
              text: d.text,
              partOfSpeech: d.partOfSpeech ?? "",
              forms: d.forms.map((f) => ({
                text: f.text,
                label: f.label ?? "",
                examples: f.examples.map((e) => ({ text: e.text, shownAt: e.shownAt })),
              })),
            })),
          },
  };
}

const orNull = (s: string) => (ktIsBlank(s) ? null : s);

/** The flat fields come from the root card: the first definition and the base form's first example. */
export function toBackup(word: StoredWord): BackupWord {
  const root = word.content.definitions[0];
  return {
    text: word.text,
    definition: root?.text ?? "",
    example: root?.forms[0]?.examples[0]?.text ?? "",
    partOfSpeech: root ? orNull(root.partOfSpeech) : null,
    createdAt: word.createdAt,
    repetitions: word.repetitions,
    easeFactor: word.easeFactor,
    intervalDays: word.intervalDays,
    dueOn: word.dueOn,
    lapses: word.lapses,
    lastReviewedAt: word.lastReviewedAt,
    firstReviewedOn: word.firstReviewedOn,
    isNew: word.isNew,
    suspended: word.suspended,
    definitions: word.content.definitions.map((d) => ({
      text: d.text,
      partOfSpeech: orNull(d.partOfSpeech),
      forms: d.forms.map((f) => ({
        text: f.text,
        label: orNull(f.label),
        examples: f.examples.map((e) => ({ text: e.text, shownAt: e.shownAt })),
      })),
    })),
  };
}

/** The file the user keeps: every key, in Backup.kt's order, indented like kotlinx's pretty print. */
export function exportBackup(words: StoredWord[], exportedAt: number): string {
  const file: BackupFile = { version: CURRENT_VERSION, exportedAt, words: words.map(toBackup) };
  return JSON.stringify(file, null, 4);
}
