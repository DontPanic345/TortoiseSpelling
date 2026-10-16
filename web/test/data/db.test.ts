import { openDB } from "idb";
import { describe, expect, test } from "vitest";
import { DB_VERSION, openDatabase } from "../../src/data/db";
import { content, openTestRepository } from "../support/repo";

describe("the database", () => {
  test("opening creates the three stores and the unique index", async () => {
    const { db } = await openTestRepository();
    expect(DB_VERSION).toBe(1);
    expect([...db.objectStoreNames].sort()).toEqual(["reviewLog", "settings", "words"]);
    const tx = db.transaction(["words", "reviewLog"]);
    expect([...tx.objectStore("words").indexNames]).toEqual(["normalizedText"]);
    expect(tx.objectStore("words").index("normalizedText").unique).toBe(true);
    expect([...tx.objectStore("reviewLog").indexNames]).toEqual(["wordId"]);
    expect(tx.objectStore("words").autoIncrement).toBe(true);
    await tx.done;
  });

  test("reopening the same database keeps its records", async () => {
    const name = "reopened";
    const first = await openDatabase(name);
    await first.add("settings", 7, "newWordsPerDay");
    first.close();
    const second = await openDatabase(name);
    expect(await second.get("settings", "newWordsPerDay")).toBe(7);
  });

  test("steps aside for another connection's upgrade and says so", async () => {
    const name = "stepped-aside";
    let told = 0;
    await openDatabase(name, () => told++);
    const upgraded = await openDB(name, DB_VERSION + 1);
    expect(told).toBe(1);
    upgraded.close();
  });

  test("a word differing only in case and spacing is a duplicate", async () => {
    const { repo } = await openTestRepository();
    expect((await repo.addWord("necessary", content("Needed."))).kind).toBe("added");
    expect((await repo.addWord("  Necessary ", content("Other."))).kind).toBe("duplicate");
    expect(await repo.wordCount()).toBe(1);
  });
});
