import { byClassName, byText, byTextContaining, scrollToText } from '../selectors.ts';

const DOWNLOAD_DIR = '/sdcard/Download';

interface BackupWordSpec {
    text: string;
    definition: string;
    dueOn?: number;
    intervalDays?: number;
    isNew?: boolean;
}

/** A word list filter scenario's seed: a word already past new, with a given interval. */
export interface ProgressWordSpec {
    text: string;
    definition: string;
    intervalDays: number;
    /** Whether the word's due date is in the past (due today) or far in the future. */
    due: boolean;
}

/**
 * Far enough in the future to never be "due", regardless of when the suite runs — the
 * epoch-day equivalent of "not due" without having to compute today's epoch day (and
 * risk a timezone mismatch between the test runner and the emulator) to build it.
 */
const FAR_FUTURE_DUE_ON = 999_999;

/** Builds the on-disk backup JSON (data/Backup.kt): version, exportedAt, words[]. */
const buildBackupJson = (words: BackupWordSpec[], version = 1): string =>
    JSON.stringify({
        version,
        exportedAt: Date.now(),
        words: words.map((word) => ({
            text: word.text,
            definition: word.definition,
            example: '',
            partOfSpeech: null,
            createdAt: Date.now(),
            repetitions: 0,
            easeFactor: 2.5,
            intervalDays: word.intervalDays ?? 0,
            dueOn: word.dueOn ?? 0,
            lapses: 0,
            lastReviewedAt: null,
            firstReviewedOn: null,
            isNew: word.isNew ?? true,
            suspended: false,
        })),
    });

const mediaScan = async (): Promise<void> => {
    await driver.execute('mobile: shell', {
        command: 'content',
        args: ['call', '--uri', 'content://media', '--method', 'scan_volume', '--arg', 'external_primary'],
    });
};

const pushToDownloads = async (filename: string, content: string): Promise<void> => {
    const base64 = Buffer.from(content, 'utf-8').toString('base64');
    await driver.pushFile(`${DOWNLOAD_DIR}/${filename}`, base64);
    await mediaScan();
};

export const backup = {
    clearTestFiles: async (): Promise<void> => {
        // Wrapping this in `sh -c '...'` (as an earlier version of this helper did) was
        // silently inert: confirmed with a standalone script that the exact same string
        // deletes nothing through that path, while passing `rm` as the command with the
        // glob as a plain arg (this device's implicit remote shell still expands it)
        // reliably removes the matching files. `-f` already makes an empty match a
        // no-op rather than an error, so no `sh -c ... || true` wrapper is needed either.
        await driver.execute('mobile: shell', {
            command: 'rm',
            args: ['-f', `${DOWNLOAD_DIR}/e2e-*`, `${DOWNLOAD_DIR}/tortoisespelling-backup*`],
        });
        // A raw filesystem delete does not tell MediaStore, which backs DocumentsUI's
        // Downloads listing: without a scan it keeps showing deleted files as ghost
        // entries, and Android's Storage Access Framework then avoids the (illusory)
        // name clash by saving the next export as "e2e-backup (2).json" instead of the
        // exact name asked for — breaking a same-scenario export-then-import round trip.
        await mediaScan();
    },

    pushWords: async (filename: string, words: BackupWordSpec[]): Promise<void> => {
        await pushToDownloads(filename, buildBackupJson(words));
    },

    /** Seeds words already past new, e.g. for word list filter scenarios. */
    pushWordsWithProgress: async (filename: string, words: ProgressWordSpec[]): Promise<void> => {
        await pushToDownloads(
            filename,
            buildBackupJson(
                words.map((word) => ({
                    text: word.text,
                    definition: word.definition,
                    intervalDays: word.intervalDays,
                    dueOn: word.due ? 0 : FAR_FUTURE_DUE_ON,
                    isNew: false,
                })),
            ),
        );
    },

    pushVersion: async (filename: string, version: number): Promise<void> => {
        await pushToDownloads(filename, buildBackupJson([], version));
    },

    pushText: async (filename: string, content: string): Promise<void> => {
        await pushToDownloads(filename, content);
    },

    /** Opens the Export picker and saves under the given filename, in Downloads. */
    export: async (filename: string): Promise<void> => {
        await scrollToText('Export').click();
        await backup.goToDownloads();
        const nameField = byClassName('android.widget.EditText');
        await nameField.waitForDisplayed();
        await nameField.setValue(filename);
        await byTextContaining('SAVE').click();
    },

    /**
     * Opens the Import picker and picks the given filename from Downloads. A tap on the
     * entry is meant to open it directly, but DocumentsUI was observed occasionally
     * treating it as a multi-select instead (the row turns selected and an action bar
     * with a "Select" button appears rather than the picker closing) — when that
     * happens, tapping "Select" completes the same pick.
     */
    import: async (filename: string): Promise<void> => {
        await scrollToText('Import').click();
        await backup.goToDownloads();
        const entry = byText(filename);
        await entry.waitForDisplayed();
        await entry.click();
        const confirmSelect = byText('Select');
        if (await confirmSelect.isDisplayed().catch(() => false)) {
            await confirmSelect.click();
        }
    },

    /** DocumentsUI may default elsewhere; make sure Downloads is the folder shown. */
    goToDownloads: async (): Promise<void> => {
        const downloads = byText('Downloads');
        if (await downloads.isDisplayed().catch(() => false)) {
            await downloads.click();
        }
    },
};
