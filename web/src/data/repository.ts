import { deviceClock, type Clock } from "../domain/clock";
import { currentStreak, dayOf, today as todayOf } from "../domain/days";
import { mathRandom, type Random } from "../domain/random";
import { wordProgress, recentDays, type MarkedDay, type WordProgress } from "../domain/progress";
import {
  availableNewCount,
  dueCount,
  dueWords,
  firstCreatedAt,
  introducedOn,
  newWords,
  nextDueDay,
  randomWords,
  recentStudyDays,
} from "../domain/queries";
import { interleaveSession, remainingNewToday } from "../domain/session";
import { fuzzedDueDay, NEW_WORD_STATE } from "../domain/srs";
import { ktTrim, normalizeWord } from "../domain/text";
import { preparedFor, type WordContent } from "../domain/wordContent";
import { pickCard, type ReviewCard } from "../domain/cardPick";
import { reviewed, undone } from "../domain/review";
import { exportBackup, parseBackup, toImport } from "./backup";
import type { Db, PushRegistration, SettingName, SettingValue } from "./db";
import type { ReviewLog, StoredWord, Word } from "./model";

/** What today's session looks like before it starts. */
export interface TodayPlan {
  dueCount: number;
  newCount: number;
}

/** What it takes to undo one review: its log row, and the word as it was before. */
export interface ReviewUndo {
  wordId: number;
  logId: number;
  before: Word;
}

export type AddResult =
  | { kind: "added"; id: number }
  | { kind: "duplicate"; existing: Word }
  | { kind: "blank" };

export type UpdateResult =
  | { kind: "updated" }
  | { kind: "duplicate"; existing: Word }
  | { kind: "missing" };

export interface ImportSummary {
  added: number;
  skipped: number;
}

export interface Settings {
  newWordsPerDay: number;
  /** Millis of the last export from this browser, or null if there hasn't been one. */
  lastExportedAt: number | null;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  pushRegistration: PushRegistration | null;
  /** The last day settleQuietDays has looked at, or null before its first run. */
  quietCheckedThrough: number | null;
}

export interface RepositoryOptions {
  db: Db;
  clock?: Clock;
  fuzz?: (today: number, intervalDays: number) => number;
  random?: Random;
}

const STREAK_WINDOW_DAYS = 400;
const WEEK_DAYS = 7;
const DEFAULT_NEW_WORDS_PER_DAY = 10;
const DEFAULT_REMINDER_HOUR = 8;

/** `word` without its content, as the scheduler and cards see it. */
function scheduling({ content: _content, ...word }: StoredWord): Word {
  return word;
}

export type Repository = ReturnType<typeof createRepository>;

/**
 * Words, their review log and the settings, in IndexedDB. The rules are `WordRepository`'s.
 * Every write is one `readwrite` transaction, checks included, and awaits only that
 * transaction's own requests (anything else lets it commit early). Clock and `today` are
 * read before a transaction opens.
 */
export function createRepository({
  db,
  clock = deviceClock,
  fuzz = (today, intervalDays) => fuzzedDueDay(today, intervalDays),
  random = mathRandom,
}: RepositoryOptions) {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  async function allWords(): Promise<StoredWord[]> {
    return db.getAll("words");
  }

  async function setting<T extends SettingValue | null>(name: SettingName, fallback: T): Promise<T> {
    return ((await db.get("settings", name)) as T | undefined) ?? fallback;
  }

  async function newWordsPerDay(): Promise<number> {
    return setting("newWordsPerDay", DEFAULT_NEW_WORDS_PER_DAY);
  }

  async function satisfiedDays(): Promise<Set<number>> {
    return new Set(await setting<number[]>("satisfiedDays", []));
  }

  /** Whether a plan for `day` (the new-word allowance reset) has nothing in it. */
  function quietOn(words: readonly StoredWord[], day: number, perDay: number): boolean {
    const allowance = remainingNewToday(perDay, introducedOn(words, day));
    return dueCount(words, day) + Math.min(allowance, availableNewCount(words)) === 0;
  }

  /** One card per word (its least recently shown example), in the words' order. */
  function cardsFor(picked: readonly Word[], stored: readonly StoredWord[]): ReviewCard[] {
    const byId = new Map(stored.map((word) => [word.id, word]));
    return picked.map((word) => {
      const full = byId.get(word.id) as StoredWord;
      return pickCard(scheduling(full), full.content, random);
    });
  }

  return {
    /** Calls `listener` after every write made in this tab; returns the way to stop. */
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async wordCount(): Promise<number> {
      return db.count("words");
    },

    async wordById(id: number): Promise<StoredWord | undefined> {
      return db.get("words", id);
    },

    /** Every word with its content, newest first. */
    async wordsWithContent(): Promise<StoredWord[]> {
      return (await allWords()).sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
    },

    async addWord(text: string, content: WordContent): Promise<AddResult> {
      const trimmed = ktTrim(text);
      if (trimmed === "") return { kind: "blank" };
      const normalized = normalizeWord(trimmed);
      const createdAt = clock.millis();
      const today = todayOf(clock);

      const tx = db.transaction("words", "readwrite");
      const existing = await tx.store.index("normalizedText").get(normalized);
      if (existing) {
        await tx.done;
        return { kind: "duplicate", existing: scheduling(existing) };
      }
      const id = await tx.store.add({
        text: trimmed,
        normalizedText: normalized,
        createdAt,
        ...NEW_WORD_STATE,
        dueOn: today,
        lapses: 0,
        lastReviewedAt: null,
        firstReviewedOn: null,
        isNew: true,
        suspended: false,
        content: preparedFor(content, trimmed),
      } as StoredWord);
      await tx.done;
      notify();
      return { kind: "added", id };
    },

    /**
     * Saves an edit: the text and the content replace the stored ones, and the rest of the
     * row, scheduling included, is whatever the transaction reads.
     */
    async updateWord(id: number, text: string, content: WordContent): Promise<UpdateResult> {
      const trimmed = ktTrim(text);
      const normalized = normalizeWord(trimmed);

      const tx = db.transaction("words", "readwrite");
      // Renaming onto a word that already exists would otherwise violate the unique index.
      const clash = await tx.store.index("normalizedText").get(normalized);
      if (clash && clash.id !== id) {
        await tx.done;
        return { kind: "duplicate", existing: scheduling(clash) };
      }
      const current = await tx.store.get(id);
      if (!current) {
        await tx.done;
        return { kind: "missing" };
      }
      await tx.store.put({
        ...current,
        text: trimmed,
        normalizedText: normalized,
        content: preparedFor(content, trimmed),
      });
      await tx.done;
      notify();
      return { kind: "updated" };
    },

    /** The word and its review log rows. */
    async deleteWord(id: number): Promise<void> {
      const tx = db.transaction(["words", "reviewLog"], "readwrite");
      const logIds = await tx.objectStore("reviewLog").index("wordId").getAllKeys(id);
      await Promise.all([
        tx.objectStore("words").delete(id),
        ...logIds.map((logId) => tx.objectStore("reviewLog").delete(logId)),
      ]);
      await tx.done;
      notify();
    },

    async setSuspended(id: number, suspended: boolean): Promise<void> {
      const tx = db.transaction("words", "readwrite");
      const current = await tx.store.get(id);
      if (current) await tx.store.put({ ...current, suspended });
      await tx.done;
      notify();
    },

    // --- today ---

    async todayPlan(): Promise<TodayPlan> {
      const today = todayOf(clock);
      const words = await allWords();
      const allowance = remainingNewToday(await newWordsPerDay(), introducedOn(words, today));
      return {
        dueCount: dueCount(words, today),
        newCount: Math.min(allowance, availableNewCount(words)),
      };
    },

    /** Due words plus today's new allowance, lightly interleaved. */
    async buildSession(): Promise<ReviewCard[]> {
      const today = todayOf(clock);
      const words = await allWords();
      const allowance = remainingNewToday(await newWordsPerDay(), introducedOn(words, today));
      const due = dueWords(words, today);
      const fresh = allowance > 0 ? newWords(words, allowance) : [];
      return cardsFor(interleaveSession(due, fresh, random), words);
    },

    /** Free practice. Never touches scheduling or the review log, by design. */
    async practicePool(limit = 10): Promise<ReviewCard[]> {
      const words = await allWords();
      return cardsFor(randomWords(words, limit, random), words);
    },

    /**
     * Stamps the card's example as shown now, so the next pick for its word rotates to
     * another. Does nothing if that position no longer holds the same text.
     */
    async markShown(card: ReviewCard): Promise<void> {
      const shown = card.example;
      if (!shown) return;
      const now = clock.millis();
      const tx = db.transaction("words", "readwrite");
      const current = await tx.store.get(card.word.id);
      const example = current?.content.definitions[shown.d]?.forms[shown.f]?.examples[shown.e];
      if (current && example && example.text === shown.text) {
        example.shownAt = now;
        await tx.store.put(current);
      }
      await tx.done;
      notify();
    },

    /**
     * Applies SM-2 and logs the review. The word is read again inside the transaction, so a
     * write since the session opened is kept; a word deleted since records nothing.
     *
     * A missed word is not re-queued into this session: the mandatory retype is the
     * corrective repetition.
     *
     * Resolves to what `undoReview` needs to take it back, or null if the word is gone.
     */
    async recordReview(wordId: number, correctFirstTry: boolean, typedAnswer: string): Promise<ReviewUndo | null> {
      const today = todayOf(clock);
      const now = clock.millis();

      const tx = db.transaction(["words", "reviewLog"], "readwrite");
      const current = await tx.objectStore("words").get(wordId);
      if (!current) {
        await tx.done;
        return null;
      }
      const { word, log } = reviewed(current, correctFirstTry, typedAnswer, today, now, fuzz);
      const [, logId] = await Promise.all([
        tx.objectStore("words").put(word),
        tx.objectStore("reviewLog").add(log as ReviewLog),
      ]);
      await tx.done;
      notify();
      return { wordId, logId, before: scheduling(current) };
    },

    /**
     * Takes back the review `recordReview` returned `undo` for, in one transaction: the
     * word's scheduling as it was and its log row gone. The word is read inside, as the edit
     * just saved may have changed its content; a deleted word records nothing.
     */
    async undoReview(undo: ReviewUndo): Promise<void> {
      const tx = db.transaction(["words", "reviewLog"], "readwrite");
      const current = await tx.objectStore("words").get(undo.wordId);
      if (!current) {
        await tx.done;
        return;
      }
      await Promise.all([
        tx.objectStore("words").put(undone(current, undo.before)),
        tx.objectStore("reviewLog").delete(undo.logId),
      ]);
      await tx.done;
      notify();
    },

    /** The card `buildSession` would pick for one word, from its content now; null if it's gone. */
    async cardFor(wordId: number): Promise<ReviewCard | null> {
      const word = await db.get("words", wordId);
      return word ? pickCard(scheduling(word), word.content, random) : null;
    },

    async reviewedToday(): Promise<number> {
      const today = todayOf(clock);
      const logs = await db.getAll("reviewLog");
      return new Set(logs.filter((log) => log.reviewedOn === today).map((log) => log.wordId)).size;
    },

    async currentStreak(): Promise<number> {
      const logs = await db.getAll("reviewLog");
      return currentStreak(
        new Set(recentStudyDays(logs, STREAK_WINDOW_DAYS)),
        todayOf(clock),
        await satisfiedDays(),
      );
    },

    /** The last week, day by day, for Home's week strip. */
    async lastWeek(): Promise<MarkedDay[]> {
      const logs = await db.getAll("reviewLog");
      const first = firstCreatedAt(await allWords());
      return recentDays(
        todayOf(clock),
        new Set(recentStudyDays(logs, WEEK_DAYS)),
        await satisfiedDays(),
        first === null ? null : dayOf(first, clock.timeZone()),
        WEEK_DAYS,
      );
    },

    async progress(): Promise<WordProgress> {
      return wordProgress(await allWords());
    },

    /** Epoch day of the next scheduled review, or null if nothing is scheduled. */
    async nextDueDay(): Promise<number | null> {
      return nextDueDay(await allWords());
    },

    /** Records that today had nothing due, so it bridges rather than breaks the streak. */
    async markTodaySatisfied(): Promise<void> {
      const today = todayOf(clock);
      const tx = db.transaction("settings", "readwrite");
      const days = ((await tx.store.get("satisfiedDays")) as number[] | undefined) ?? [];
      // Home calls this on every refresh, and a write tells subscribers to refresh again.
      if (days.includes(today)) return;
      // A rolling window; an unbounded set would grow forever for no benefit.
      const kept = [...new Set([...days, today])].filter((day) => day > today - STREAK_WINDOW_DAYS);
      await tx.store.put(kept.sort((a, b) => a - b), "satisfiedDays");
      await tx.done;
      notify();
    },

    /**
     * Marks each day since the last check on which nothing was due as satisfied, so a quiet
     * stretch with the app closed bridges the streak as Android's reminder worker does.
     * Nothing changes while the app is closed, so the stored words are the words as they stood
     * on those days; run it before anything can write a word. It never notifies subscribers.
     */
    async settleQuietDays(): Promise<void> {
      const today = todayOf(clock);
      const tx = db.transaction(["words", "settings"], "readwrite");
      const settings = tx.objectStore("settings");
      const checked = ((await settings.get("quietCheckedThrough")) as number | undefined) ?? null;
      if (checked !== null && checked >= today - 1) {
        await tx.done;
        return;
      }
      if (checked !== null && ((await settings.get("reminderEnabled")) as boolean | undefined) !== false) {
        const words = await tx.objectStore("words").getAll();
        const perDay = ((await settings.get("newWordsPerDay")) as number | undefined) ?? DEFAULT_NEW_WORDS_PER_DAY;
        const days = ((await settings.get("satisfiedDays")) as number[] | undefined) ?? [];
        const quiet: number[] = [];
        for (let day = Math.max(checked + 1, today - STREAK_WINDOW_DAYS); day < today; day++) {
          if (quietOn(words, day, perDay)) quiet.push(day);
        }
        if (quiet.length > 0) {
          const kept = [...new Set([...days, ...quiet])].filter((day) => day > today - STREAK_WINDOW_DAYS);
          await settings.put(
            kept.sort((a, b) => a - b),
            "satisfiedDays",
          );
        }
      }
      await settings.put(today - 1, "quietCheckedThrough");
      await tx.done;
    },

    /**
     * The first day, from today, on which today's plan would be non-empty if nothing changed:
     * today; else tomorrow if a new word is left (the allowance resets); else the next due
     * day; else null, since nothing will ever be due.
     */
    async reminderDay(): Promise<number | null> {
      const today = todayOf(clock);
      const words = await allWords();
      if (!quietOn(words, today, await newWordsPerDay())) return today;
      if (availableNewCount(words) > 0) return today + 1;
      return nextDueDay(words);
    },

    async settings(): Promise<Settings> {
      return {
        newWordsPerDay: await newWordsPerDay(),
        lastExportedAt: await setting<number | null>("lastExportedAt", null),
        reminderEnabled: await setting<boolean>("reminderEnabled", true),
        reminderHour: await setting<number>("reminderHour", DEFAULT_REMINDER_HOUR),
        reminderMinute: await setting<number>("reminderMinute", 0),
        pushRegistration: await setting<PushRegistration | null>("pushRegistration", null),
        quietCheckedThrough: await setting<number | null>("quietCheckedThrough", null),
      };
    },

    async setReminderEnabled(on: boolean): Promise<void> {
      await db.put("settings", on, "reminderEnabled");
      notify();
    },

    async setReminderTime(hour: number, minute: number): Promise<void> {
      const tx = db.transaction("settings", "readwrite");
      await Promise.all([
        tx.store.put(Math.min(Math.max(Math.trunc(hour), 0), 23), "reminderHour"),
        tx.store.put(Math.min(Math.max(Math.trunc(minute), 0), 59), "reminderMinute"),
      ]);
      await tx.done;
      notify();
    },

    /** Doesn't notify subscribers: the sync that writes this is itself woken by them. */
    async setPushRegistration(registration: PushRegistration | null): Promise<void> {
      if (registration === null) await db.delete("settings", "pushRegistration");
      else await db.put("settings", registration, "pushRegistration");
    },

    async setNewWordsPerDay(value: number): Promise<void> {
      await db.put("settings", Math.min(Math.max(Math.trunc(value), 1), 100), "newWordsPerDay");
      notify();
    },

    async setLastExportedAt(millis: number): Promise<void> {
      await db.put("settings", millis, "lastExportedAt");
      notify();
    },

    // --- backup ---

    /** The backup file's text: every word with its content, oldest first. */
    async exportBackup(): Promise<string> {
      const words = (await allWords()).sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
      return exportBackup(words, clock.millis());
    },

    /**
     * Merges a backup in. Words already present keep their local scheduling state: a backup
     * should never quietly undo progress made since it was taken. Throws
     * `BackupFormatError` with nothing written.
     */
    async importBackup(text: string): Promise<ImportSummary> {
      const incoming = parseBackup(text, clock.millis()).words.map(toImport);
      let added = 0;
      let skipped = 0;

      const tx = db.transaction("words", "readwrite");
      for (const { word, content } of incoming) {
        const normalized = normalizeWord(word.text);
        if (normalized === "" || (await tx.store.index("normalizedText").get(normalized))) {
          skipped++;
          continue;
        }
        await tx.store.add({
          ...word,
          normalizedText: normalized,
          content: preparedFor(content, word.text),
        } as StoredWord);
        added++;
      }
      await tx.done;
      if (added > 0) notify();
      return { added, skipped };
    },
  };
}
