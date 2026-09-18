import { APP_ID } from './config.ts';
import { addWord, type WordFields } from './screens/addWord.ts';

const SEED_ACTIVITY = `${APP_ID}/.debug.SeedWordsActivity`;

const onMainActivity = async (): Promise<boolean> =>
    (await driver.getCurrentActivity()).endsWith('.MainActivity');

/**
 * Arrange-step shortcut: adds words through the debug build's SeedWordsActivity, which
 * calls the same repository method as the Add screen, in well under a second. Typing
 * them into the Add screen took about 8 s a word. Leaves the app on the screen it was
 * on (Home, straight after the per-scenario reset), refreshed.
 *
 * A release build has no seed activity (APK=...app-release.apk), so there it falls back
 * to the Add screen.
 */
export const seedWords = async (words: WordFields[]): Promise<void> => {
    const payload = Buffer.from(JSON.stringify(words)).toString('base64');
    const output = (await driver.execute('mobile: shell', {
        command: 'am',
        args: ['start', '-W', '-n', SEED_ACTIVITY, '--es', 'words', payload],
    })) as string;
    if (/Error/.test(output)) {
        for (const word of words) {
            await addWord.addAndConfirm(word);
        }
        return;
    }
    await driver.waitUntil(onMainActivity, {
        timeoutMsg: 'SeedWordsActivity did not finish',
    });
};
