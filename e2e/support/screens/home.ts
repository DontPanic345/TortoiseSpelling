import { APP_ID } from '../config.ts';
import { byDescription, byTestId, byText } from '../selectors.ts';
import { testIds } from '../testIds.ts';

const MAX_BACK_PRESSES = 5;
const SETTLE_TIMEOUT_MILLIS = 3_000;

/** Whether an element appears within a short grace period, without throwing if it never does. */
const appearsSoon = async (element: ReturnType<typeof $>, timeout: number): Promise<boolean> => {
    try {
        await element.waitForDisplayed({ timeout });
        return true;
    } catch {
        return false;
    }
};

/** The system permission dialog; its package is com.android.* or com.google.android.*. */
const isPermissionDialogShowing = async (): Promise<boolean> =>
    (await driver.getCurrentPackage()).endsWith('permissioncontroller');

export const home = {
    /** Home is the only screen whose top bar reads "TortoiseSpelling". */
    title: () => byText('TortoiseSpelling'),
    practiceCount: () => byTestId(testIds.homePracticeCount),
    addWordButton: () => byTestId(testIds.homeAddWord),
    startButton: () => byText('Start'),
    moreButton: () => byDescription('More'),
    menuItem: (label: string) => byText(label),

    /**
     * System Back until Home is showing. Back also dismisses the keyboard, snackbars
     * and dialogs on the way, so it may take more than one press per screen.
     *
     * Each check waits a short grace period rather than looking instantaneously: right
     * after the app is (re)launched (e.g. the very first call in a scenario, straight
     * after the Before hook), Home can still be cold-starting, and pressing Back before
     * it has rendered anything can exit the app entirely rather than dismiss a screen.
     */
    goBack: async (): Promise<void> => {
        for (let presses = 0; presses < MAX_BACK_PRESSES; presses++) {
            if (await appearsSoon(home.title(), SETTLE_TIMEOUT_MILLIS)) {
                return;
            }
            // The notification-permission prompt opens over Home, and UiAutomator only
            // sees the front window, so Home's title looks absent. Back would dismiss
            // the prompt — which Android records as a refusal — so stop here and leave
            // it for the scenario to answer.
            if (await isPermissionDialogShowing()) {
                return;
            }
            await driver.back();
        }
        // A stray Back press can exit the app to the launcher, where no amount of
        // further waiting brings Home back on its own; bring the app back to the front.
        if (!(await appearsSoon(home.title(), SETTLE_TIMEOUT_MILLIS))) {
            await driver.activateApp(APP_ID);
        }
        await home.title().waitForDisplayed();
    },

    /** Home's overflow menu ("More") item, reachable from any screen. */
    openViaMenu: async (label: string): Promise<void> => {
        await home.goBack();
        await home.moreButton().click();
        await home.menuItem(label).click();
    },

    startSession: async (): Promise<void> => {
        await home.startButton().click();
    },
};
