import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SevereServiceError } from 'webdriverio';
import { compileApp } from './support/app.ts';
import { APK_PATH, APP_ID, DEFAULT_TAGS, LOG_DIR } from './support/config.ts';

// Appium's UiAutomator2 driver needs the Android SDK and a JDK. Default to where
// Android Studio installs them; set ANDROID_HOME / JAVA_HOME yourself to override.
const defaultAndroidHome = (): string => {
    if (process.platform === 'win32') {
        return path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
    }
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Android', 'sdk');
    }
    return path.join(os.homedir(), 'Android', 'Sdk');
};

const defaultJavaHome = (): string | undefined => {
    if (process.platform === 'win32') {
        return 'C:\\Program Files\\Android\\Android Studio\\jbr';
    }
    if (process.platform === 'darwin') {
        return '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
    }
    return undefined;
};

process.env.ANDROID_HOME ??= defaultAndroidHome();
const javaHome = defaultJavaHome();
if (!process.env.JAVA_HOME && javaHome) {
    process.env.JAVA_HOME = javaHome;
}

export const config: WebdriverIO.Config = {
    runner: 'local',
    // One group, so the whole run shares one Appium session: a session per feature file
    // cost ~14 s each in reinstalling and restarting UiAutomator2.
    specs: [['../specs/**/*.feature']],
    maxInstances: 1,

    capabilities: [
        {
            platformName: 'Android',
            'appium:automationName': 'UiAutomator2',
            'appium:app': APK_PATH,
            'appium:appPackage': APP_ID,
            'appium:appActivity': '.MainActivity',
            // Reinstall at the start of the run so the APK under test is always
            // the latest build; per-scenario state is reset in support/hooks.ts. Do not
            // add noReset: the driver lets it override enforceAppInstall, and then an
            // older build already on the device is silently the one tested.
            'appium:enforceAppInstall': true,
            'appium:autoGrantPermissions': false,
            // Swaps in an invisible keyboard for the session. Tests type through
            // accessibility, so a real keyboard only covers buttons; and the driver's
            // hideKeyboard() falls back to pressing BACK, which leaves the screen.
            'appium:hideKeyboard': true,
            'appium:disableWindowAnimation': true,
            'appium:newCommandTimeout': 300,
            // A phone reached through a Tailscale relay pushes APKs slowly (the 20 MB
            // debug APK took about 3 minutes); the defaults (20 s per adb call, 90 s per
            // install) are sized for an emulator.
            'appium:adbExecTimeout': 600_000,
            'appium:uiautomator2ServerInstallTimeout': 600_000,
            'appium:androidInstallTimeout': 600_000,
        },
    ],

    logLevel: 'warn',
    waitforTimeout: 10_000,
    // The default 500 ms poll made every wait that wasn't already true cost half a second.
    waitforInterval: 100,
    // Each WebDriver request may wait this long. Session creation and installApp push
    // APKs, which takes minutes over a Tailscale relay; keep this above the install timeouts.
    connectionRetryTimeout: 900_000,
    connectionRetryCount: 1,

    services: [
        [
            'appium',
            {
                logPath: LOG_DIR,
                args: {
                    // Allows `mobile: shell` for steps that act on the device rather than
                    // the app: killing the app's process, pushing files into Downloads.
                    allowInsecure: 'uiautomator2:adb_shell',
                },
            },
        ],
    ],

    framework: 'cucumber',
    reporters: ['spec'],
    cucumberOpts: {
        // Keep in step with STEP_FILES in scripts/checkSteps.ts.
        require: ['./step-definitions/**/*.ts', './support/hooks.ts'],
        tags: process.env.E2E_TAGS ?? DEFAULT_TAGS,
        // Per step. Every Appium call to the phone over Tailscale is about 20 times slower
        // than on an emulator; steps that reinstall the app set their own, longer timeout.
        timeout: 300_000,
        snippets: true,
        source: true,
        strict: true,
    },

    before: async () => {
        await compileApp();
    },

    onPrepare: () => {
        if (!fs.existsSync(APK_PATH)) {
            throw new SevereServiceError(
                `No APK at ${APK_PATH}. Build one first with ./gradlew assembleDebug ` +
                    'from the repo root, or point APK at an existing build.',
            );
        }
    },
};
