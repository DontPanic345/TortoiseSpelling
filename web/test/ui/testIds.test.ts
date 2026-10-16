import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as ids from "../../src/ui/testIds";

// Tags that exist on Android only: the web app has no Google backup.
const ANDROID_ONLY = new Set(["settings_cloud_backup_switch"]);
// Ids that exist on the web only.
const WEB_ONLY = new Set(["home_backup_nudge", "home_reminder_card", "home_reminder_turn_on", "home_reminder_not_now"]);

const kotlin = readFileSync(
  new URL("../../../app/src/main/java/io/github/dontpanic345/tortoisespelling/ui/TestTags.kt", import.meta.url),
  "utf8",
);

/** `const val X = "value"` lines. */
const androidConstants = [...kotlin.matchAll(/const val \w+ = "([^"]+)"/g)].map((m) => m[1] as string);

/** `fun name(args) = "prefix_${d}_$f"` with every argument reference written as §. */
const androidFunctions = [...kotlin.matchAll(/fun (\w+)\([^)]*\) = "([^"]+)"/g)].map((m) => ({
  name: m[1] as string,
  template: (m[2] as string).replace(/\$\{\w+\}|\$\w+/g, "§"),
}));

const webConstants = Object.values(ids.TestIds) as string[];
const webFunctions = Object.entries(ids)
  .filter((entry): entry is [string, (...args: string[]) => string] => typeof entry[1] === "function")
  .map(([name, fn]) => ({ name, template: fn(...Array<string>(fn.length).fill("§")) }));

describe("test ids", () => {
  it("reads something from TestTags.kt", () => {
    expect(androidConstants.length).toBeGreaterThan(20);
    expect(androidFunctions.length).toBeGreaterThan(5);
  });

  it("holds every Android constant except the Android-only ones", () => {
    const expected = androidConstants.filter((id) => !ANDROID_ONLY.has(id));
    expect(webConstants.filter((id) => !WEB_ONLY.has(id)).sort()).toEqual(expected.sort());
  });

  it("holds the web-only ids and nothing else extra", () => {
    expect(webConstants.filter((id) => WEB_ONLY.has(id)).sort()).toEqual([...WEB_ONLY].sort());
    expect(webConstants.every((id) => !ANDROID_ONLY.has(id))).toBe(true);
  });

  it("builds every function's id the way Android does", () => {
    expect(webFunctions.map((f) => f.template).sort()).toEqual(androidFunctions.map((f) => f.template).sort());
  });

  it("uses the same function names", () => {
    expect(webFunctions.map((f) => f.name).sort()).toEqual(androidFunctions.map((f) => f.name).sort());
  });

  it("has no id twice", () => {
    expect(new Set(webConstants).size).toBe(webConstants.length);
  });
});
