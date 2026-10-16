import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import { checkDirectory, checkFeature } from "./check-specs.mjs";

const shared = `@e2e
Feature: Shared
  Scenario: One
    Given a thing
`;

const androidOnly = `# Android only: the system owns it.
@e2e @android
Feature: Android
  Scenario: One
    Given a thing

  @slow
  Scenario: Two
    Given a thing
`;

const problemsOf = (source) => checkFeature("x.feature", source);

describe("checkFeature", () => {
    test("a shared feature passes", () => {
        assert.deepEqual(problemsOf(shared), []);
    });

    test("an Android-only feature with @slow passes", () => {
        assert.deepEqual(problemsOf(androidOnly), []);
    });

    test("a feature with no layer tag fails", () => {
        const found = problemsOf(shared.replace("@e2e\n", ""));
        assert.equal(found.length, 1);
        assert.match(found[0], /^x\.feature:1: .*layer tag/);
    });

    test("two layer tags fail", () => {
        assert.match(problemsOf(shared.replace("@e2e", "@e2e @e2e")).join(), /layer tag/);
    });

    test("a scenario with a layer tag fails", () => {
        const source = shared.replace("  Scenario:", "  @e2e\n  Scenario:");
        assert.match(problemsOf(source).join(), /can't carry a layer tag/);
    });

    test("an unknown tag fails", () => {
        const source = androidOnly.replace("@android", "@andriod");
        assert.match(problemsOf(source).join(), /unknown tag @andriod/);
    });

    test("an @android feature with a @web scenario fails", () => {
        const source = androidOnly.replace("  @slow\n", "  # Web only: x.\n  @web\n");
        assert.match(problemsOf(source).join(), /both @android and @web/);
    });

    test("a platform tag without a comment above fails", () => {
        const source = androidOnly.replace(/^#.*\n/, "");
        assert.match(problemsOf(source).join(), /needs a # comment/);
    });

    test("@slow without @android fails", () => {
        const source = shared.replace("  Scenario:", "  @slow\n  Scenario:");
        assert.match(problemsOf(source).join(), /@slow scenarios must also be @android/);
    });

    test("@release-smoke without @android fails", () => {
        assert.match(problemsOf(shared.replace("@e2e", "@e2e @release-smoke")).join(), /@release-smoke/);
    });

    test("Rule: is reported as unsupported", () => {
        assert.match(problemsOf(shared + "  Rule: x\n").join(), /Rule is not supported/);
    });

    test("Scenario Outline: and Examples: are reported as unsupported", () => {
        const found = problemsOf(shared + "  Scenario Outline: x\n  Examples:\n");
        assert.equal(found.length, 2);
    });
});

describe("the real specs folder", () => {
    test("passes", () => {
        const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../specs");
        const { count, problems } = checkDirectory(dir);
        assert.deepEqual(problems, []);
        assert.ok(count > 0);
    });
});
