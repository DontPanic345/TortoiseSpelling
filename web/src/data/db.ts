import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ReviewLog, StoredWord } from "./model";

/**
 * The web database's schema version. Every schema change bumps this, adds a `case` to
 * `upgrade` that migrates the records already stored, and adds a test that opens the
 * previous version's database with records in it. No store is ever deleted with its data.
 */
export const DB_VERSION = 1;

export const DEFAULT_DB_NAME = "tortoisespelling";

export interface TortoiseSpellingSchema extends DBSchema {
  words: {
    key: number;
    value: StoredWord;
    indexes: { normalizedText: string };
  };
  reviewLog: {
    key: number;
    value: ReviewLog;
    indexes: { wordId: number };
  };
  settings: {
    key: SettingName;
    value: number | number[];
  };
}

export type SettingName = "newWordsPerDay" | "satisfiedDays";

export type Db = IDBPDatabase<TortoiseSpellingSchema>;

export async function openDatabase(name: string = DEFAULT_DB_NAME): Promise<Db> {
  const db = await openDB<TortoiseSpellingSchema>(name, DB_VERSION, {
    upgrade(upgrading, oldVersion) {
      switch (oldVersion) {
        case 0: {
          const words = upgrading.createObjectStore("words", { keyPath: "id", autoIncrement: true });
          words.createIndex("normalizedText", "normalizedText", { unique: true });
          const log = upgrading.createObjectStore("reviewLog", { keyPath: "id", autoIncrement: true });
          log.createIndex("wordId", "wordId");
          upgrading.createObjectStore("settings");
        }
      }
    },
  });
  // Another tab is upgrading the database: step aside so it can.
  db.addEventListener("versionchange", () => db.close());
  return db;
}
