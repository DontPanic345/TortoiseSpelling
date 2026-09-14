import { Given, Then, When } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { freshInstall } from '../support/app.ts';
import { APP_ID } from '../support/config.ts';
import { scenarioState } from '../support/scenarioState.ts';
import { review } from '../support/screens/review.ts';
import { byResourceIdMatching, byTestId, byText, byTextContaining } from '../support/selectors.ts';

const PERMISSION_PROMPT = 'Allow Tortoise Spelling to send you notifications?';
const ALLOW_BUTTON = 'com.android.permissioncontroller:id/permission_allow_button';
const DENY_BUTTON_PATTERN = '.*:id/permission_deny.*';

Given('the app is freshly installed', async () => {
    await freshInstall();
});

Then('I am asked to allow notifications', async () => {
    await expect(byText(PERMISSION_PROMPT)).toBeDisplayed();
});

Then('I am not asked to allow notifications', async () => {
    // Give the dialog a couple of seconds to appear before declaring it absent.
    await driver.pause(2000);
    await expect(byText(PERMISSION_PROMPT)).not.toBeDisplayed();
});

When('I allow notifications', async () => {
    await byTestId(ALLOW_BUTTON).click();
});

When('I refuse notifications', async () => {
    // Covers both Android's first-refusal and "don't ask again" second-refusal buttons.
    await byResourceIdMatching(DENY_BUTTON_PATTERN).click();
});

Then('Android\'s notification settings for Tortoise Spelling are shown', async () => {
    await expect(byTextContaining('All Tortoise Spelling notifications')).toBeDisplayed();
});

Then('a notification {string} arrives saying {string}', async (title: string, body: string) => {
    await driver.openNotifications();
    await expect(byText(title)).toBeDisplayed();
    await expect(byText(body)).toBeDisplayed();
    scenarioState.setLastNotificationTitle(title);
});

Then(
    'within {int} minutes a notification {string} arrives saying {string}',
    { timeout: 300_000 },
    async (minutes: number, title: string, body: string) => {
        const deadline = Date.now() + minutes * 60_000;
        for (;;) {
            await driver.openNotifications();
            const arrived = await byText(title).isDisplayed().catch(() => false);
            if (arrived) {
                await expect(byText(body)).toBeDisplayed();
                scenarioState.setLastNotificationTitle(title);
                return;
            }
            await driver.back();
            if (Date.now() > deadline) {
                throw new Error(`Notification "${title}" did not arrive within ${minutes} minutes`);
            }
            await driver.pause(10_000);
        }
    },
);

When('I tap that notification', async () => {
    await byText(scenarioState.lastNotificationTitle()).click();
});

When('I rotate the device', async () => {
    await driver.setOrientation('LANDSCAPE');
});

When('I press the system Back button', async () => {
    await driver.back();
});

/**
 * "Not in a session" means Review is gone, whatever screen is now on top of it — a
 * reminder tapped while on a screen other than Home pushes Review onto that screen's
 * back stack, so a single Back press can land on Settings just as validly as Home.
 */
Then('I am not in a session', async () => {
    await expect(review.answerField()).not.toBeDisplayed();
});

When('the app is sent to the background and its process is killed', async () => {
    await driver.execute('mobile: pressKey', { keycode: 3 });
    await driver.execute('mobile: shell', { command: 'am', args: ['kill', APP_ID] });
});
