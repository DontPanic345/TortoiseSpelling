import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
    nextVersionName,
    readVersion,
    releaseChangelog,
    releaseNotes,
    releaseProblem,
    writeVersion,
} from "./version.mjs";

const gradle = `
    defaultConfig {
        applicationId = "io.github.dontpanic345.tortoisespelling"
        versionCode = 3
        versionName = "0.2.1"
    }
`;

const changelog = `# Changelog

Intro paragraph.

## [Unreleased]

### Added

- Something new.

## [0.2.1] - 2026-09-20

### Fixed

- A bug.

[unreleased]: https://github.com/owner/repo/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/owner/repo/compare/v0.2.0...v0.2.1
`;

describe("readVersion and writeVersion", () => {
    test("reads versionCode and versionName", () => {
        assert.deepEqual(readVersion(gradle), { versionCode: 3, versionName: "0.2.1" });
    });

    test("rewrites both and leaves everything else alone", () => {
        const updated = writeVersion(gradle, { versionCode: 4, versionName: "0.3.0" });
        assert.equal(updated, gradle.replace("versionCode = 3", "versionCode = 4").replace('"0.2.1"', '"0.3.0"'));
    });

    test("refuses a file with no versionName", () => {
        assert.throws(() => readVersion("versionCode = 1"), /exactly one versionName/);
    });

    test("refuses a file with two versionCodes", () => {
        assert.throws(() => readVersion(`${gradle}\nversionCode = 9`), /exactly one versionCode in build.gradle.kts, found 2/);
    });
});

describe("nextVersionName", () => {
    test("bumps each part and resets the lower ones", () => {
        assert.equal(nextVersionName("1.4.7", "major"), "2.0.0");
        assert.equal(nextVersionName("1.4.7", "minor"), "1.5.0");
        assert.equal(nextVersionName("1.4.7", "patch"), "1.4.8");
    });

    test("takes an explicit higher version", () => {
        assert.equal(nextVersionName("0.0.1", "1.0.0"), "1.0.0");
        assert.equal(nextVersionName("0.9.0", "0.10.0"), "0.10.0");
    });

    test("refuses an explicit version that isn't higher", () => {
        assert.throws(() => nextVersionName("1.4.7", "1.4.7"), /isn't higher/);
        assert.throws(() => nextVersionName("1.4.7", "1.3.9"), /isn't higher/);
    });

    test("refuses anything that isn't MAJOR.MINOR.PATCH", () => {
        assert.throws(() => nextVersionName("1.4.7", "banana"), /MAJOR.MINOR.PATCH/);
        assert.throws(() => nextVersionName("1.4.7", "v1.5.0"), /MAJOR.MINOR.PATCH/);
        assert.throws(() => nextVersionName("1.4", "patch"), /MAJOR.MINOR.PATCH/);
    });
});

describe("releaseChangelog", () => {
    test("moves the unreleased notes under a dated heading and updates the links", () => {
        const expected = `# Changelog

Intro paragraph.

## [Unreleased]

## [0.3.0] - 2026-10-01

### Added

- Something new.

## [0.2.1] - 2026-09-20

### Fixed

- A bug.

[unreleased]: https://github.com/owner/repo/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/owner/repo/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/owner/repo/compare/v0.2.0...v0.2.1
`;
        assert.equal(releaseChangelog(changelog, "0.3.0", "2026-10-01"), expected);
    });

    test("works when [Unreleased] is directly above the links", () => {
        const first = `# Changelog

## [Unreleased]

- First.

[unreleased]: https://github.com/owner/repo/compare/v0.0.0...HEAD
`;
        const released = releaseChangelog(first, "0.1.0", "2026-10-01");
        assert.match(released, /## \[Unreleased\]\n\n## \[0\.1\.0\] - 2026-10-01\n\n- First\.\n\n\[unreleased\]/);
        assert.match(released, /\[0\.1\.0\]: https:\/\/github\.com\/owner\/repo\/compare\/v0\.0\.0\.\.\.v0\.1\.0/);
    });

    test("refuses to release with nothing under [Unreleased]", () => {
        const empty = changelog.replace("### Added\n\n- Something new.\n\n", "");
        assert.throws(() => releaseChangelog(empty, "0.3.0", "2026-10-01"), /Nothing under/);
    });

    test("refuses a version that already has a section", () => {
        assert.throws(() => releaseChangelog(changelog, "0.2.1", "2026-10-01"), /already has a section/);
    });

    test("refuses a changelog without [Unreleased]", () => {
        assert.throws(() => releaseChangelog("# Changelog\n", "0.3.0", "2026-10-01"), /no ## \[Unreleased\]/);
    });
});

describe("releaseNotes", () => {
    test("returns a section's body without its heading", () => {
        assert.equal(releaseNotes(changelog, "0.2.1"), "### Fixed\n\n- A bug.");
    });

    test("stops at the link definitions after the last section", () => {
        assert.doesNotMatch(releaseNotes(changelog, "0.2.1"), /compare/);
    });

    test("is null for a missing section", () => {
        assert.equal(releaseNotes(changelog, "9.9.9"), null);
    });

    test("doesn't mistake 0.2.10 for 0.2.1", () => {
        assert.equal(releaseNotes(changelog, "0.2.10"), null);
    });
});

describe("releaseProblem", () => {
    const released = releaseChangelog(changelog, "0.3.0", "2026-10-01");
    const bumped = writeVersion(gradle, { versionCode: 4, versionName: "0.3.0" });

    test("passes a tag that matches, with notes and a higher versionCode", () => {
        assert.equal(
            releaseProblem({ tag: "v0.3.0", gradleText: bumped, changelog: released, previousVersionCode: 3 }),
            null,
        );
    });

    test("passes the first release, with no previous versionCode", () => {
        assert.equal(releaseProblem({ tag: "v0.3.0", gradleText: bumped, changelog: released }), null);
    });

    test("fails a tag that doesn't match versionName", () => {
        assert.match(
            releaseProblem({ tag: "v0.3.1", gradleText: bumped, changelog: released }),
            /doesn't match versionName "0.3.0"/,
        );
    });

    test("fails a versionCode that didn't go up", () => {
        assert.match(
            releaseProblem({ tag: "v0.3.0", gradleText: bumped, changelog: released, previousVersionCode: 4 }),
            /isn't higher than the previous release's 4/,
        );
    });

    test("fails a version with no changelog notes", () => {
        assert.match(
            releaseProblem({ tag: "v0.3.0", gradleText: bumped, changelog }),
            /no notes under ## \[0.3.0\]/,
        );
    });
});
