import { BackupFormatError } from "../data/backup";
import type { AppContainer } from "./container";
import { importMessage } from "./settings/settingsState";

export const BACKUP_FILE_NAME = "tortoisespelling-backup.json";

/** Saves the backup file; the message to show, or null when the user cancelled. */
export async function exportWords(container: AppContainer): Promise<string | null> {
  const { repository, platform, clock } = container;
  try {
    const text = await repository.exportBackup();
    if ((await platform.saveFile(BACKUP_FILE_NAME, text)) === "cancelled") return null;
    await repository.setLastExportedAt(clock.millis());
    return "Backup saved.";
  } catch {
    return "Couldn't write that file.";
  }
}

/** Merges a backup file in; the message to show. */
export async function importWords(container: AppContainer, file: { text(): Promise<string> }): Promise<string> {
  try {
    const summary = await container.repository.importBackup(await file.text());
    return importMessage(summary.added, summary.skipped);
  } catch (error) {
    if (error instanceof BackupFormatError) return error.message;
    return "Couldn't read that file.";
  }
}
