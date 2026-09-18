import { Given, Then, When } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { settings } from '../support/screens/settings.ts';
import { scrollToTestId } from '../support/selectors.ts';
import { testIds } from '../support/testIds.ts';

Given('I open Settings', async () => {
    await settings.open();
});

Given('new words per day is set to {int}', async (target: number) => {
    await settings.open();
    await settings.setNewWordsPerDay(target);
});

When('I turn the daily reminder {word}', async (state: string) => {
    const shouldBeOn = state === 'on';
    const isOn = (await settings.reminderSwitch().getAttribute('checked')) === 'true';
    if (isOn !== shouldBeOn) {
        await settings.reminderSwitch().click();
    }
});

Then('the daily reminder is {word}', async (state: string) => {
    const expected = state === 'on' ? 'true' : 'false';
    await expect(settings.reminderSwitch()).toHaveAttribute('checked', expected);
});

Given('the reminder time is set to {int} minutes from now', async (minutesFromNow: number) => {
    const deviceTime = (await driver.execute('mobile: getDeviceTime', { format: 'HH:mm' })) as string;
    const [hour, minute] = deviceTime.split(':').map(Number);
    const totalMinutes = (hour * 60 + minute + minutesFromNow) % (24 * 60);
    const targetHour = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const targetMinute = String(totalMinutes % 60).padStart(2, '0');
    await settings.setReminderTime(`${targetHour}:${targetMinute}`);
});

When('I turn cloud backup {word}', async (state: string) => {
    const shouldBeOn = state === 'on';
    await scrollToTestId(testIds.settingsCloudBackupSwitch);
    const isOn = (await settings.cloudBackupSwitch().getAttribute('checked')) === 'true';
    if (isOn !== shouldBeOn) {
        await settings.cloudBackupSwitch().click();
    }
});

Then('cloud backup is {word}', async (state: string) => {
    const expected = state === 'on' ? 'true' : 'false';
    await scrollToTestId(testIds.settingsCloudBackupSwitch);
    await expect(settings.cloudBackupSwitch()).toHaveAttribute('checked', expected);
});
