/**
 * Checks that every step in the selected scenarios has a step definition, without a
 * device: a Cucumber dry run over the same features and step files WDIO uses. Takes
 * about a second, against minutes for a real run.
 *
 *   npm run check-steps            the scenarios a default run executes; must be clean
 *   npm run check-steps -- --all   every scenario, @todo included: progress report
 *
 * Exits 1 if any selected step is undefined or ambiguous, printing a snippet for each.
 * Cucumber's own dry run exits 0 on undefined steps, hence this script.
 */
import { loadConfiguration, runCucumber } from '@cucumber/cucumber/api';
import { DEFAULT_TAGS } from '../support/config.ts';

// Keep in step with cucumberOpts.require in wdio.conf.ts.
const STEP_FILES = ['step-definitions/**/*.ts', 'support/hooks.ts'];

const all = process.argv.includes('--all');
const tags = all ? '' : (process.env.E2E_TAGS ?? DEFAULT_TAGS);

const { runConfiguration } = await loadConfiguration({
    provided: {
        paths: ['features'],
        import: STEP_FILES,
        dryRun: true,
        tags,
        format: ['summary'],
    },
});

let undefinedSteps = 0;
let ambiguousSteps = 0;
await runCucumber(runConfiguration, undefined, (envelope) => {
    const status = envelope.testStepFinished?.testStepResult.status;
    if (status === 'UNDEFINED') {
        undefinedSteps++;
    }
    if (status === 'AMBIGUOUS') {
        ambiguousSteps++;
    }
});

const scope = all ? 'all scenarios' : `scenarios matching "${tags}"`;
if (undefinedSteps > 0 || ambiguousSteps > 0) {
    console.error(`\n✖ ${scope}: ${undefinedSteps} undefined and ${ambiguousSteps} ambiguous step(s).`);
    process.exit(1);
}
console.log(`\n✓ ${scope}: every step is defined.`);
