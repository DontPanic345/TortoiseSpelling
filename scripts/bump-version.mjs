// Bumps the app version for a release:
//
//   node scripts/bump-version.mjs <major|minor|patch|X.Y.Z>
//
// Raises versionName as asked and versionCode by one in app/build.gradle.kts, and moves
// CHANGELOG.md's [Unreleased] notes under a new [X.Y.Z] heading dated today. It refuses
// to run if [Unreleased] is empty, so a release can't go out without notes.
//
// It doesn't commit or tag: merging the bump to main is what releases it, and the
// release workflow creates the tag once the build succeeds.

import { CHANGELOG_FILE, GRADLE_FILE, readRepoFile, writeRepoFile } from "./repo-files.mjs";
import { nextVersionName, readVersion, releaseChangelog, writeVersion } from "./version.mjs";

const USAGE = "Usage: node scripts/bump-version.mjs <major|minor|patch|X.Y.Z>";

// The local date, not UTC: a release cut in the NZ morning belongs to that day.
const today = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const main = () => {
    const bump = process.argv[2];
    if (!bump || process.argv.length > 3) {
        throw new Error(USAGE);
    }

    const gradleText = readRepoFile(GRADLE_FILE);
    const changelog = readRepoFile(CHANGELOG_FILE);
    const current = readVersion(gradleText);
    const next = {
        versionCode: current.versionCode + 1,
        versionName: nextVersionName(current.versionName, bump),
    };

    // Both are computed before either is written, so a failure leaves neither touched.
    const newChangelog = releaseChangelog(changelog, next.versionName, today());
    const newGradleText = writeVersion(gradleText, next);
    writeRepoFile(GRADLE_FILE, newGradleText);
    writeRepoFile(CHANGELOG_FILE, newChangelog);

    console.log(
        `Bumped ${current.versionName} (versionCode ${current.versionCode}) -> ` +
            `${next.versionName} (versionCode ${next.versionCode}).\n\n` +
            `Next: check the notes in ${CHANGELOG_FILE}, commit, and merge to main. The release ` +
            `workflow builds it and tags v${next.versionName} when the build succeeds.`,
    );
};

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
