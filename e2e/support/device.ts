import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const SETTINGS_ID = 'io.appium.settings';
const EMPTY_IME = `${SETTINGS_ID}/.EmptyIME`;
const IME_TIMEOUT_MILLIS = 30_000;
const IME_POLL_MILLIS = 500;

const adbPath = (): string =>
    path.join(process.env.ANDROID_HOME ?? '', 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');

const adb = async (...args: string[]): Promise<string> => (await run(adbPath(), args)).stdout;

/** The Appium Settings APK the driver installs, wherever npm put the package. */
const settingsApk = (): string | undefined => {
    const name = path.join('io.appium.settings', 'apks', 'settings_apk-debug.apk');
    const modules = path.resolve(import.meta.dirname, '../node_modules');
    return [path.join(modules, 'appium-uiautomator2-driver', 'node_modules', name), path.join(modules, name)].find(
        (apk) => fs.existsSync(apk),
    );
};

/**
 * Installs Appium's helper app and waits until Android lists its invisible keyboard.
 *
 * The session's `appium:hideKeyboard` installs the helper and enables that keyboard at
 * once, but on a freshly booted emulator Android can take a few seconds to register a
 * newly installed keyboard, and the session then fails with "Unknown input method
 * io.appium.settings/.EmptyIME". With the helper already installed the driver skips its
 * install (it only upgrades), so the keyboard is there by the time it is enabled.
 */
export const prepareKeyboardHelper = async (): Promise<void> => {
    const apk = settingsApk();
    if (!apk) {
        return;
    }
    try {
        await adb('get-state');
    } catch {
        // No device, or more than one: leave it to Appium to say so.
        return;
    }
    try {
        await adb('install', '-r', '-g', apk);
    } catch {
        // E.g. a newer helper is already on the device: the driver copes with that itself.
        return;
    }
    const deadline = Date.now() + IME_TIMEOUT_MILLIS;
    while (!(await adb('shell', 'ime', 'list', '-a', '-s')).includes(EMPTY_IME)) {
        if (Date.now() > deadline) {
            throw new Error(`Android did not register ${EMPTY_IME} within ${IME_TIMEOUT_MILLIS / 1000} s of installing it`);
        }
        await new Promise((resolve) => setTimeout(resolve, IME_POLL_MILLIS));
    }
};
