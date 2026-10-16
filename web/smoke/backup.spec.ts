import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "./fixtures";

const androidBackup = fileURLToPath(new URL("../../golden/backup/android-tree.json", import.meta.url));

test("an Android backup imports, and an export reads back with the words and their definitions", async ({ page }) => {
  await page.goto("./#/settings");
  await page.locator('input[type="file"]').setInputFiles(androidBackup);
  await expect(page.getByText("Imported 3 words.")).toBeVisible();

  await page.goto("./#/words");
  for (const word of ["run", "child", "café"]) {
    await expect(page.getByTestId(`word_row_${word}`)).toBeVisible();
  }

  await page.goto("./#/settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const file = await download;
  const exported = JSON.parse(readFileSync((await file.path()) ?? "", "utf8")) as {
    version: number;
    words: { text: string; definitions: unknown[] }[];
  };
  expect(exported.version).toBe(1);
  expect(exported.words.map((word) => word.text).sort()).toEqual(["Café", "child", "run"]);
  for (const word of exported.words) expect(word.definitions.length).toBeGreaterThan(0);
});
