import { APK_PATH, APP_ID } from './config.ts';

const POST_NOTIFICATIONS = 'android.permission.POST_NOTIFICATIONS';

/** The runtime notification permission only exists from Android 13 (API 33). */
const hasNotificationPermission = async (): Promise<boolean> => {
    const info = (await driver.execute('mobile: deviceInfo')) as { apiVersion: string };
    return Number(info.apiVersion) >= 33;
};

/**
 * Clean slate for a scenario: app data wiped (which also drops WorkManager's scheduled
 * reminders), notifications pre-allowed so the permission prompt does not interrupt
 * scenarios that are not about it, then the app launched on Home.
 *
 * Runs before every scenario (support/hooks.ts). Scenarios about the permission prompt
 * itself need a pristine permission state, which only a reinstall gives: freshInstall().
 */
export const resetApp = async (): Promise<void> => {
    await driver.execute('mobile: clearApp', { appId: APP_ID });
    if (await hasNotificationPermission()) {
        await driver.execute('mobile: changePermissions', {
            permissions: POST_NOTIFICATIONS,
            appPackage: APP_ID,
            action: 'grant',
        });
    }
    await driver.activateApp(APP_ID);
};

/** Uninstall and reinstall: no data and no permission decisions, like a first install. */
export const freshInstall = async (): Promise<void> => {
    await driver.removeApp(APP_ID);
    await driver.installApp(APK_PATH);
    await driver.activateApp(APP_ID);
};
