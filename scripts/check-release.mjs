// Release gate, run by .github/workflows/release.yml before anything is built:
//
//   node scripts/check-release.mjs <tag> [notes-file]
//   node scripts/check-release.mjs --tag      prints the tag for the current versionName
//
// Fails unless the tag is v<versionName>, versionCode is higher than the previous
// release's, and CHANGELOG.md has notes for the version. On success, writes those notes
// to notes-file (for `gh release create --notes-file`) or prints them.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { CHANGELOG_FILE, GRADLE_FILE, REPO_ROOT, readRepoFile } from "./repo-files.mjs";
import { readVersion, releaseNotes, releaseProblem } from "./version.mjs";

const git = (...args) => execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });

// The highest v* tag other than the one being released, by version order.
const previousVersionCode = (tag) => {
    const previousTag = git("tag", "--list", "v*", "--sort=-v:refname")
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line && line !== tag);
    if (!previousTag) {
        return undefined;
    }
    return readVersion(git("show", `${previousTag}:${GRADLE_FILE}`)).versionCode;
};

const main = () => {
    const [tag, notesFile] = process.argv.slice(2);
    if (tag === "--tag") {
        console.log(`v${readVersion(readRepoFile(GRADLE_FILE)).versionName}`);
        return;
    }
    if (!tag) {
        throw new Error("Usage: node scripts/check-release.mjs <tag|--tag> [notes-file]");
    }

    const gradleText = readRepoFile(GRADLE_FILE);
    const changelog = readRepoFile(CHANGELOG_FILE);
    const problem = releaseProblem({
        tag,
        gradleText,
        changelog,
        previousVersionCode: previousVersionCode(tag),
    });
    if (problem) {
        throw new Error(problem);
    }

    const notes = releaseNotes(changelog, readVersion(gradleText).versionName);
    if (notesFile) {
        writeFileSync(notesFile, `${notes}\n`, "utf8");
    } else {
        console.log(notes);
    }
};

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
