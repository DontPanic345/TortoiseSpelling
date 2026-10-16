/**
 * Checks the tags on the shared Gherkin specs in specs/*.feature. It reads lines rather
 * than a Gherkin AST, and reports the constructs it can't read safely (Rule, Scenario
 * Outline, Examples) so a parse can't silently misread them.
 *
 *   node scripts/check-specs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KNOWN_TAGS = new Set(["@e2e", "@android", "@web", "@todo", "@slow", "@release-smoke"]);
const LAYER_TAGS = new Set(["@e2e"]);
const ANDROID_ONLY_TAGS = ["@slow", "@release-smoke"];
const UNSUPPORTED = /^(Rule|Scenario Outline|Scenario Template|Examples|Scenarios):/;

const tagsOf = (line) => line.split(/\s+/).filter(Boolean);

/** Returns the problems in one feature file's source, each naming the file and line. */
export function checkFeature(name, source) {
    const problems = [];
    const problem = (line, message) => problems.push(`${name}:${line}: ${message}`);
    const lines = source.split(/\r?\n/);

    const featureTags = [];
    const scenarios = [];
    let seenFeature = false;
    let pending = [];

    lines.forEach((raw, index) => {
        const lineNo = index + 1;
        const line = raw.trim();
        if (line.startsWith("@")) {
            const before = (lines[index - 1] ?? "").trim();
            const tags = tagsOf(line);
            if ((tags.includes("@android") || tags.includes("@web")) && !before.startsWith("#")) {
                problem(lineNo, "a line with @android or @web needs a # comment above it saying why");
            }
            for (const tag of tags) {
                if (!KNOWN_TAGS.has(tag)) problem(lineNo, `unknown tag ${tag}`);
            }
            pending.push(...tags);
        } else if (line.startsWith("Feature:")) {
            seenFeature = true;
            featureTags.push(...pending);
            pending = [];
        } else if (/^Scenario:/.test(line)) {
            scenarios.push({ line: lineNo, tags: pending });
            pending = [];
        } else if (UNSUPPORTED.test(line)) {
            problem(lineNo, `${line.split(":")[0]} is not supported by this check or the runners`);
        }
    });

    if (!seenFeature) problem(1, "no Feature: line");
    const featureLayers = featureTags.filter((tag) => LAYER_TAGS.has(tag));
    if (featureLayers.length !== 1) {
        problem(1, `the feature needs exactly one layer tag (${[...LAYER_TAGS].join(", ")}), found ${featureLayers.length}`);
    }
    for (const scenario of scenarios) {
        if (scenario.tags.some((tag) => LAYER_TAGS.has(tag))) {
            problem(scenario.line, "a scenario can't carry a layer tag; it inherits the feature's");
        }
        const tags = new Set([...featureTags, ...scenario.tags]);
        if (tags.has("@android") && tags.has("@web")) {
            problem(scenario.line, "a scenario can't be both @android and @web");
        }
        for (const tag of ANDROID_ONLY_TAGS) {
            if (tags.has(tag) && !tags.has("@android")) {
                problem(scenario.line, `${tag} scenarios must also be @android`);
            }
        }
    }
    return problems;
}

/** Checks every feature in a folder; returns { count, problems }. */
export function checkDirectory(dir) {
    const files = fs.readdirSync(dir).filter((file) => file.endsWith(".feature")).sort();
    const problems = files.flatMap((file) =>
        checkFeature(path.join(path.basename(dir), file), fs.readFileSync(path.join(dir, file), "utf8")),
    );
    return { count: files.length, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../specs");
    const { count, problems } = checkDirectory(dir);
    if (problems.length > 0) {
        console.error(problems.join("\n"));
        process.exit(1);
    }
    console.log(`✓ ${count} features, tags OK.`);
}
