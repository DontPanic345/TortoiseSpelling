import path from "node:path";
import fs from "node:fs/promises";
import type { Page } from "@playwright/test";
import { flatBackupFile, type BackupWordSpec } from "../../../../specs/support/fixtures";
import { choice } from "../selectors";

export const backup = {
  /** The run's Downloads folder is the per-test `downloads` fixture, so emptying it is the arrange. */
  clearTestFiles: async (folder: string): Promise<void> => {
    await fs.rm(folder, { recursive: true, force: true });
    await fs.mkdir(folder, { recursive: true });
  },

  pushWords: async (folder: string, filename: string, words: BackupWordSpec[]): Promise<void> => {
    await fs.writeFile(path.join(folder, filename), flatBackupFile(words));
  },

  /** Clicks Export and saves the download under the given filename in the folder. */
  export: async (page: Page, folder: string, filename: string): Promise<void> => {
    const download = page.waitForEvent("download");
    await choice(page, "Export").click();
    await (await download).saveAs(path.join(folder, filename));
  },

  /** Clicks Import, which opens the file chooser, and picks the given file from the folder. */
  import: async (page: Page, folder: string, filename: string): Promise<void> => {
    const chooser = page.waitForEvent("filechooser");
    await page.locator("label.button", { hasText: "Import" }).click();
    await (await chooser).setFiles(path.join(folder, filename));
  },
};
