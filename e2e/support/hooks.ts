import fs from 'node:fs/promises';
import path from 'node:path';
import { After, Before } from '@wdio/cucumber-framework';
import { resetApp } from './app.ts';
import { LOG_DIR } from './config.ts';
import { scenarioState } from './scenarioState.ts';

Before(async () => {
    scenarioState.reset();
    await resetApp();
});

/**
 * On failure, keep the screen as text (page source XML: grep it for texts and
 * resource-ids) and as a screenshot for a human. Named after the scenario.
 */
After(async (scenario) => {
    if (scenario.result?.status !== 'FAILED') {
        return;
    }
    const name = scenario.pickle.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.writeFile(path.join(LOG_DIR, `${name}.xml`), await driver.getPageSource());
    await driver.saveScreenshot(path.join(LOG_DIR, `${name}.png`));
});

/**
 * A scenario that rotates the device (the reminder-tap-then-rotate scenario) must not
 * leave the emulator in landscape for whatever runs next, even if it fails partway.
 */
After(async () => {
    await driver.setOrientation('PORTRAIT').catch(() => undefined);
});
