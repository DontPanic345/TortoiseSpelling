import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const GRADLE_FILE = "app/build.gradle.kts";
export const CHANGELOG_FILE = "CHANGELOG.md";

// Windows checkouts get CRLF (core.autocrlf), CI gets LF. The helpers in version.mjs
// only ever see LF, and a file is written back with the line endings it was read with.
const crlfFiles = new Set();

export const readRepoFile = (path) => {
    const text = readFileSync(join(REPO_ROOT, path), "utf8");
    if (text.includes("\r\n")) {
        crlfFiles.add(path);
    }
    return text.replace(/\r\n/g, "\n");
};

export const writeRepoFile = (path, text) => {
    const output = crlfFiles.has(path) ? text.replace(/\n/g, "\r\n") : text;
    writeFileSync(join(REPO_ROOT, path), output, "utf8");
};
