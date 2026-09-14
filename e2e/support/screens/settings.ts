import { byDescription, byTestId, byText } from '../selectors.ts';
import { testIds } from '../testIds.ts';
import { home } from './home.ts';

export const settings = {
    apiKeyField: () => byTestId(testIds.settingsApiKey),
    newWordsValue: () => byTestId(testIds.settingsNewWordsValue),
    newWordsDecrease: () => byTestId(testIds.settingsNewWordsDecrease),
    newWordsIncrease: () => byTestId(testIds.settingsNewWordsIncrease),
    reminderSwitch: () => byTestId(testIds.settingsReminderSwitch),
    reminderTimeButton: () => byTestId(testIds.settingsReminderTimeButton),
    cloudBackupSwitch: () => byTestId(testIds.settingsCloudBackupSwitch),

    /**
     * Opens Settings from any screen, or stays put if it is already open. Checked via
     * the reminder switch rather than the API key field: Daily reminder is the first
     * section, so it's on screen without scrolling regardless of screen height.
     */
    open: async (): Promise<void> => {
        if (await settings.reminderSwitch().isDisplayed()) {
            return;
        }
        await home.openViaMenu('Settings');
        await settings.reminderSwitch().waitForDisplayed();
    },

    setNewWordsPerDay: async (target: number): Promise<void> => {
        let current = Number(await settings.newWordsValue().getText());
        while (current < target) {
            await settings.newWordsIncrease().click();
            current++;
        }
        while (current > target) {
            await settings.newWordsDecrease().click();
            current--;
        }
    },

    setReminderTime: async (time: string): Promise<void> => {
        const [hour, minute] = time.split(':');
        await settings.reminderTimeButton().click();
        await byDescription('Switch to text input mode for the time input.').click();
        await byTestId('android:id/input_hour').setValue(hour);
        await byTestId('android:id/input_minute').setValue(minute);
        await byText('OK').click();
    },
};
