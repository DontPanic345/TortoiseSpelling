/**
 * Checks that every step in the selected scenarios has a step definition, without a
 * device: a Cucumber dry run over the same features and step files WDIO uses. Takes
 * about a second, against minutes for a real run.
 *
 *   npm run check-steps            the scenarios a default run executes; must be clean
 *   npm run check-steps -- --all   every scenario, @todo included, and no unused steps
 *
 * Exits 1 if any selected step is undefined or ambiguous, printing a snippet for each.
 * With --all it also exits 1 on a step definition no scenario uses.
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
const definitions = new Map<string, string>();
const usedDefinitions = new Set<string>();
await runCucumber(runConfiguration, undefined, (envelope) => {
    const definition = envelope.stepDefinition;
    if (definition) {
        const where = `${definition.sourceReference.uri}:${definition.sourceReference.location?.line}`;
        definitions.set(definition.id, `${where}  ${definition.pattern.source}`);
    }
    envelope.testCase?.testSteps.forEach((step) => {
        step.stepDefinitionIds?.forEach((id) => usedDefinitions.add(id));
    });
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
const unused = [...definitions].filter(([id]) => !usedDefinitions.has(id)).map(([, where]) => where);
if (all && unused.length > 0) {
    console.error(`\n✖ ${unused.length} step definition(s) no scenario uses:\n  ${unused.join('\n  ')}`);
    process.exit(1);
}
console.log(`\n✓ ${scope}: every step is defined.`);
