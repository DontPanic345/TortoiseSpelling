// Pure helpers behind bump-version.mjs and check-release.mjs: reading and rewriting the
// app version in app/build.gradle.kts, and moving CHANGELOG.md's [Unreleased] notes
// under a release heading. No file or git access here, so it's all unit-testable.

const VERSION_CODE = /versionCode\s*=\s*(\d+)/g;
const VERSION_NAME = /versionName\s*=\s*"([^"]*)"/g;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

const matchOnce = (text, pattern, what) => {
    const matches = [...text.matchAll(pattern)];
    if (matches.length !== 1) {
        throw new Error(`Expected exactly one ${what} in build.gradle.kts, found ${matches.length}`);
    }
    return matches[0][1];
};

const parseSemver = (version) => {
    const match = SEMVER.exec(version);
    if (!match) {
        throw new Error(`"${version}" isn't a plain MAJOR.MINOR.PATCH version`);
    }
    return match.slice(1).map(Number);
};

const compareSemver = (a, b) => {
    const [left, right] = [parseSemver(a), parseSemver(b)];
    for (let i = 0; i < 3; i++) {
        if (left[i] !== right[i]) {
            return left[i] - right[i];
        }
    }
    return 0;
};

/** @returns {{ versionCode: number, versionName: string }} */
export const readVersion = (gradleText) => ({
    versionCode: Number(matchOnce(gradleText, VERSION_CODE, "versionCode")),
    versionName: matchOnce(gradleText, VERSION_NAME, "versionName"),
});

export const writeVersion = (gradleText, { versionCode, versionName }) => {
    readVersion(gradleText);
    return gradleText
        .replace(VERSION_CODE, `versionCode = ${versionCode}`)
        .replace(VERSION_NAME, `versionName = "${versionName}"`);
};

/**
 * The next versionName: `major`, `minor` or `patch` bumps that part of `current`; an
 * explicit `X.Y.Z` is taken as-is but must be higher than `current`.
 */
export const nextVersionName = (current, bump) => {
    const [major, minor, patch] = parseSemver(current);
    if (bump === "major") {
        return `${major + 1}.0.0`;
    }
    if (bump === "minor") {
        return `${major}.${minor + 1}.0`;
    }
    if (bump === "patch") {
        return `${major}.${minor}.${patch + 1}`;
    }
    if (compareSemver(bump, current) <= 0) {
        throw new Error(`${bump} isn't higher than the current version ${current}`);
    }
    return bump;
};

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A section runs from its "## [...]" heading to the next "## " heading or to the link
// reference definitions ("[0.1.0]: https://...") at the foot of the file.
const findSection = (changelog, label) => {
    const heading = new RegExp(`^## \\[${escapeRegExp(label)}\\].*$`, "mi");
    const headingMatch = heading.exec(changelog);
    if (!headingMatch) {
        return null;
    }
    const bodyStart = headingMatch.index + headingMatch[0].length;
    const rest = changelog.slice(bodyStart);
    const end = /^(## |\[[^\]]+\]:\s)/m.exec(rest);
    const bodyEnd = end ? bodyStart + end.index : changelog.length;
    return {
        start: headingMatch.index,
        bodyStart,
        bodyEnd,
        body: changelog.slice(bodyStart, bodyEnd).trim(),
    };
};

/** The notes under `## [version]`, or null if there is no such section or it's empty. */
export const releaseNotes = (changelog, version) => {
    const section = findSection(changelog, version);
    return section && section.body ? section.body : null;
};

/**
 * Moves everything under `## [Unreleased]` into a new `## [version] - date` section,
 * leaves an empty [Unreleased] above it, and updates the compare links at the foot.
 */
export const releaseChangelog = (changelog, version, date) => {
    const unreleased = findSection(changelog, "Unreleased");
    if (!unreleased) {
        throw new Error("CHANGELOG.md has no ## [Unreleased] section");
    }
    if (!unreleased.body) {
        throw new Error("Nothing under ## [Unreleased] in CHANGELOG.md: write the release notes first");
    }
    if (findSection(changelog, version)) {
        throw new Error(`CHANGELOG.md already has a section for ${version}`);
    }

    const result =
        changelog.slice(0, unreleased.start) +
        `## [Unreleased]\n\n## [${version}] - ${date}\n\n${unreleased.body}\n\n` +
        changelog.slice(unreleased.bodyEnd);

    // [unreleased]: https://github.com/<owner>/<repo>/compare/v0.1.0...HEAD
    const unreleasedLink = /^\[unreleased\]:[ \t]*(\S+)\/compare\/(\S+)\.\.\.HEAD[ \t]*$/mi.exec(result);
    if (!unreleasedLink) {
        return result;
    }
    const [line, repoUrl, previousTag] = unreleasedLink;
    return result.replace(
        line,
        `[unreleased]: ${repoUrl}/compare/v${version}...HEAD\n` +
            `[${version}]: ${repoUrl}/compare/${previousTag}...v${version}`,
    );
};

/**
 * Why `tag` can't be released, or null if it can. `previousVersionCode` is the
 * versionCode of the last release, when there is one: Android refuses to install an
 * update whose versionCode isn't higher than the installed app's.
 */
export const releaseProblem = ({ tag, gradleText, changelog, previousVersionCode }) => {
    const { versionCode, versionName } = readVersion(gradleText);
    if (tag !== `v${versionName}`) {
        return `Tag ${tag} doesn't match versionName "${versionName}" in app/build.gradle.kts (expected v${versionName})`;
    }
    if (previousVersionCode !== undefined && versionCode <= previousVersionCode) {
        return `versionCode ${versionCode} isn't higher than the previous release's ${previousVersionCode}, so Android won't install it as an update`;
    }
    if (!releaseNotes(changelog, versionName)) {
        return `CHANGELOG.md has no notes under ## [${versionName}]`;
    }
    return null;
};
