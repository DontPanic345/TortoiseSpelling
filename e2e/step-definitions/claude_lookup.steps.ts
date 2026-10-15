import { Given } from '@wdio/cucumber-framework';
import { home } from '../support/screens/home.ts';
import { settings } from '../support/screens/settings.ts';
import { scrollToTestId } from '../support/selectors.ts';
import { testIds } from '../support/testIds.ts';

// @live-api only: never run against the emulator (see e2e/README.md). Verified with
// `npm run check-steps -- --all` only.

Given('my Anthropic API key is saved in Settings', async () => {
    const apiKey = process.env.TORTOISESPELLING_ANTHROPIC_KEY;
    if (!apiKey) {
        throw new Error(
            'TORTOISESPELLING_ANTHROPIC_KEY is not set — this scenario needs a real Anthropic key.',
        );
    }
    await settings.open();
    // The key section is below the fold now that Settings leads with Daily
    // reminder and Practice.
    await scrollToTestId(testIds.settingsApiKey);
    // mask keeps the key out of WebdriverIO's own logs; appium-log-filters.json covers
    // the Appium server's.
    await settings.apiKeyField().setValue(apiKey, { mask: true });
    await home.goBack();
});
