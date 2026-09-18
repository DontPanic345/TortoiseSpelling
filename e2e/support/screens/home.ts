import { APP_ID } from '../config.ts';
import { byDescription, byTestId, byText, byTextInApp } from '../selectors.ts';
import { testIds } from '../testIds.ts';

const MAX_BACK_PRESSES = 5;
const SETTLE_TIMEOUT_MILLIS = 3_000;
const AFTER_BACK_MILLIS = 1_000;

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
/** Anything of the app's on screen, i.e. it is past its cold start. */
const appHasRendered = async (): Promise<boolean> =>
    $(`android=new UiSelector().packageName(${JSON.stringify(APP_ID)})`).isExisting();

const isPermissionDialogShowing = async (): Promise<boolean> =>
    (await driver.getCurrentPackage()).endsWith('permissioncontroller');

export const home = {
    /**
     * Home is the only screen whose top bar reads "Tortoise Spelling". Scoped to the app:
     * the launcher's icon label reads the same, and goBack() pressing Back during a slow
     * cold start lands on the launcher, where an unscoped match would pass for Home.
     */
    title: () => byTextInApp('Tortoise Spelling'),
    practiceCount: () => byTestId(testIds.homePracticeCount),
    addWordButton: () => byTestId(testIds.homeAddWord),
    startButton: () => byText('Start'),
    moreButton: () => byDescription('More'),
    menuItem: (label: string) => byText(label),

    /**
     * System Back until Home is showing. Back also dismisses the keyboard, snackbars
     * and dialogs on the way, so it may take more than one press per screen.
     *
     * Right after the app is (re)launched, Home can still be cold-starting, and pressing
     * Back before it has rendered anything can exit the app entirely rather than dismiss
     * a screen. So the first look only waits when nothing of the app is on screen yet,
     * and each look after a Back press waits briefly for Home to replace the old screen.
     */
    goBack: async (): Promise<void> => {
        for (let presses = 0; presses < MAX_BACK_PRESSES; presses++) {
            let grace = AFTER_BACK_MILLIS;
            if (presses === 0) {
                grace = (await appHasRendered()) ? 0 : SETTLE_TIMEOUT_MILLIS;
            }
            const onHome = grace === 0
                ? await home.title().isDisplayed().catch(() => false)
                : await appearsSoon(home.title(), grace);
            if (onHome) {
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
