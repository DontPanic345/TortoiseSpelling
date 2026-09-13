import { Given, Then, When } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { typeInto } from '../support/actions.ts';
import { settings } from '../support/screens/settings.ts';

Given('I open Settings', async () => {
    await settings.open();
});

Then('new words per day shows {int}', async (value: number) => {
    await expect(settings.newWordsValue()).toHaveText(String(value));
});

When('I raise new words per day', async () => {
    await settings.newWordsIncrease().click();
});

When('I lower new words per day', async () => {
    await settings.newWordsDecrease().click();
});

Given('new words per day is set to {int}', async (target: number) => {
    await settings.open();
    await settings.setNewWordsPerDay(target);
});

Then('I cannot lower new words per day', async () => {
    await expect(settings.newWordsDecrease()).toBeDisabled();
});

When('I set the reminder time to {word}', async (time: string) => {
    await settings.setReminderTime(time);
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

Then('I cannot change the reminder time', async () => {
    await expect(settings.reminderTimeButton()).toBeDisabled();
});

When('I enter the API key {string}', async (apiKey: string) => {
    await typeInto(settings.apiKeyField(), apiKey);
});

Given('the reminder time is set to {int} minutes from now', async (minutesFromNow: number) => {
    const deviceTime = (await driver.execute('mobile: getDeviceTime', { format: 'HH:mm' })) as string;
    const [hour, minute] = deviceTime.split(':').map(Number);
    const totalMinutes = (hour * 60 + minute + minutesFromNow) % (24 * 60);
    const targetHour = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const targetMinute = String(totalMinutes % 60).padStart(2, '0');
    await settings.setReminderTime(`${targetHour}:${targetMinute}`);
});
