import assert from "node:assert/strict";
import { test } from "node:test";
import {
    applyCi,
    applyReplies,
    applyResult,
    ciFailureText,
    ciVerdict,
    initProblem,
    nextStep,
    pace,
    parseUsage,
    phase2Prompt,
    pieceLog,
    readResult,
    readsOf,
    redact,
    section,
    tokenProblem,
} from "./jog.mjs";

const resets = new Date("2026-10-17T09:00:00Z");
const day = (n) => new Date(resets.getTime() - 7 * 86400_000 + (n - 1) * 86400_000 + 3600_000);

test("pace stops at half the 5-hour window", () => {
    assert.equal(pace({ session: 49, weekly: 0, weeklyResetsAt: resets }, day(1)).ok, true);
    assert.equal(pace({ session: 50, weekly: 0, weeklyResetsAt: resets }, day(1)).ok, false);
});

test("pace spreads the weekly budget across the cycle", () => {
    assert.equal(pace({ session: 0, weekly: 12, weeklyResetsAt: resets }, day(1)).ok, true);
    assert.equal(pace({ session: 0, weekly: 14, weeklyResetsAt: resets }, day(1)).ok, false);
    assert.equal(pace({ session: 0, weekly: 94, weeklyResetsAt: resets }, day(7)).ok, true);
    assert.equal(pace({ session: 0, weekly: 95, weeklyResetsAt: resets }, day(7)).ok, false);
});

test("parseUsage reads the direct route's limits rows", () => {
    const u = parseUsage({
        limits: [
            { kind: "session", percent: 2, resets_at: "2026-10-12T08:09:59Z" },
            { kind: "weekly_all", percent: 9, resets_at: "2026-10-17T08:59:59Z" },
        ],
    });
    assert.deepEqual([u.session, u.weekly], [2, 9]);
});

test("parseUsage reads the probe route's fractions", () => {
    const u = parseUsage({
        unifiedWindows: { five_hour: { utilization: 0.3, resetsAt: 1 }, seven_day: { utilization: 0.5, resetsAt: 2 } },
    });
    assert.deepEqual([u.session, u.weekly], [30, 50]);
});

const piece = (id, dependsOn, steps, status = "active") => ({ id, dependsOn, status, steps });
const st = (id, phase, status = "pending") => ({ id, phase, status });

test("every spec comes before any build", () => {
    const s = {
        pieces: [
            piece("a", [], [st("spec", 1, "done"), st("build-1", 2)]),
            piece("b", [], [st("spec", 1)]),
        ],
    };
    assert.equal(nextStep(s).piece.id, "b");
});

test("a build waits for its dependencies", () => {
    const s = {
        pieces: [
            piece("a", [], [st("spec", 1, "blocked")], "blocked"),
            piece("b", ["a"], [st("spec", 1, "done"), st("build-1", 2)]),
            piece("c", [], [st("spec", 1, "done"), st("build-1", 2)]),
        ],
    };
    assert.equal(nextStep(s).piece.id, "c");
    s.pieces[2].status = "done";
    assert.deepEqual(nextStep(s), { stuck: true });
});

test("all pieces done", () => {
    assert.deepEqual(nextStep({ pieces: [piece("a", [], [], "done")] }), { allDone: true });
});

test("a token GitHub accepts passes", async () => {
    let auth;
    const get = async (url, { headers }) => {
        auth = headers.Authorization;
        return { ok: true, status: 200 };
    };
    assert.equal(await tokenProblem("ghp_good", get), null);
    assert.equal(auth, "Bearer ghp_good");
});

test("a missing or rejected token is reported", async () => {
    const reject = async () => ({ ok: false, status: 401 });
    assert.match(await tokenProblem("ghp_stale", reject), /HTTP 401/);
    assert.match(await tokenProblem(undefined, reject), /not set/);
});

test("readResult accepts the three outcomes and nothing else", () => {
    assert.deepEqual(readResult('{"status":"done"}'), { status: "done" });
    assert.equal(readResult('{"status":"blocked"}'), null, "a blocker needs its question");
    assert.equal(readResult('{"status":"finished"}'), null);
    assert.equal(readResult("not json"), null);
    assert.equal(readResult(null), null);
});

const twoSteps = () => ({
    pieces: [piece("p", [], [st("build-1", 2, "done"), st("build-2", 2)])],
});

test("a done last step finishes the piece", () => {
    const s = twoSteps();
    assert.equal(applyResult(s, "p", "build-2", { status: "done" }, true), "done");
    assert.equal(s.pieces[0].status, "done");
});

test("a pending step is retried once, then blocked", () => {
    const s = twoSteps();
    assert.equal(applyResult(s, "p", "build-2", { status: "pending" }, true), "pending");
    assert.equal(applyResult(s, "p", "build-2", null, true), "blocked");
    assert.match(s.pieces[0].blocker, /2 times/);
});

test("a failed session counts as an attempt, whatever it claimed, and keeps the reply", () => {
    const s = twoSteps();
    s.pieces[0].userReply = "yes";
    assert.equal(applyResult(s, "p", "build-2", { status: "done" }, false), "pending (session failed)");
    assert.equal(s.pieces[0].steps[1].attempts, 1);
    assert.equal(s.pieces[0].userReply, "yes");
});

const comment = (login, at, body) => ({ user: { login }, created_at: at, body });

test("the blocker round trip: block, ignore others' comments, unblock on Alan's reply, block again", () => {
    const s = twoSteps();
    const p = s.pieces[0];
    assert.equal(applyResult(s, "p", "build-2", { status: "blocked", blocker: "Which word?" }, true), "blocked");
    assert.deepEqual([p.status, p.steps[1].status, p.blocker], ["blocked", "blocked", "Which word?"]);
    p.blockerIssue = 40;
    p.blockedAt = "2026-10-16T00:00:00Z";
    const open = { state: "open" };

    assert.equal(applyReplies(p, open, [comment("someone", "2026-10-16T01:00:00Z", "spam")]), false);
    assert.equal(applyReplies(p, open, [comment("DontPanic345", "2026-10-15T23:00:00Z", "old")]), false);
    assert.equal(applyReplies(p, open, [comment("DontPanic345", "2026-10-16T01:00:00Z", "tortoise")]), true);
    assert.deepEqual([p.status, p.steps[1].status, p.userReply], ["active", "pending", "tortoise"]);
    assert.equal(p.blockerIssue, undefined, "a second blocker must get a new issue");

    applyResult(s, "p", "build-2", { status: "blocked", blocker: "Again?" }, true);
    assert.equal(p.userReply, undefined, "the session read the reply");
    assert.equal(p.blockerIssue, undefined);
});

test("closing the issue without a comment unblocks too", () => {
    const p = piece("p", [], [st("build-1", 2, "blocked")], "blocked");
    p.blockedAt = "2026-10-16T00:00:00Z";
    p.steps[0].attempts = 2;
    assert.equal(applyReplies(p, { state: "closed" }, []), true);
    assert.match(p.userReply, /closed the issue/);
    assert.equal(p.steps[0].attempts, undefined, "an unblocked step gets fresh attempts");
});

test("redact hides secrets and leaves short values alone", () => {
    assert.equal(redact("token sk-ant-oat01-abcdef here", ["sk-ant-oat01-abcdef", undefined, "ab"]), "token *** here");
});

test("a session must get its model and auto mode", () => {
    const step = { model: "sonnet" };
    assert.equal(initProblem({ model: "claude-sonnet-5-5", permissionMode: "auto" }, step), null);
    assert.match(initProblem({ model: "claude-opus-5-5", permissionMode: "auto" }, step), /model mismatch/);
    // What Haiku really reports when asked for auto mode.
    assert.match(initProblem({ model: "claude-haiku-4-5-20251001", permissionMode: "default" }, { model: "haiku" }), /not auto/);
});

test("a done step that pushed waits for CI, and holds up the rest of its piece", () => {
    const s = twoSteps();
    s.pieces[0].steps[1].status = "pending";
    s.pieces[0].steps.push(st("review", 2));
    assert.equal(applyResult(s, "p", "build-2", { status: "done" }, true, "abc123"), "done, waiting on CI");
    assert.equal(s.pieces[0].steps[1].status, "pending");
    assert.equal(s.pieces[0].steps[1].awaitingCi, "abc123");
    assert.deepEqual(nextStep(s), { stuck: true }, "the review mustn't start before build-2's CI");
});

test("green CI finishes the step; red sends it back with the failure, then blocks", () => {
    const s = twoSteps();
    applyResult(s, "p", "build-2", { status: "done" }, true, "abc123");
    assert.equal(applyCi(s, "p", "build-2", "red", "lint failed"), "pending (CI red)");
    const step = s.pieces[0].steps[1];
    assert.deepEqual([step.status, step.attempts, step.ciFailure, step.awaitingCi], ["pending", 1, "lint failed", undefined]);
    assert.equal(nextStep(s).step.id, "build-2", "the step runs again");

    applyResult(s, "p", "build-2", { status: "done" }, true, "def456");
    assert.equal(applyCi(s, "p", "build-2", "red", "still failing"), "blocked (CI red)");
    assert.match(s.pieces[0].blocker, /CI red/);

    const t = twoSteps();
    applyResult(t, "p", "build-2", { status: "done" }, true, "abc123");
    t.pieces[0].steps[1].ciFailure = "old";
    assert.equal(applyCi(t, "p", "build-2", "green"), "done (CI green)");
    assert.deepEqual([t.pieces[0].status, t.pieces[0].steps[1].ciFailure], ["done", undefined]);
});

test("ciVerdict waits for every run and takes the newest", () => {
    const run = (status, conclusion, at) => ({ status, conclusion, updated_at: at });
    assert.equal(ciVerdict([]).state, "none");
    assert.equal(ciVerdict([run("in_progress", null, "2026-10-18T01:00:00Z")]).state, "running");
    assert.equal(ciVerdict([run("completed", "success", "2026-10-18T01:00:00Z")]).state, "green");
    const rerun = [run("completed", "failure", "2026-10-18T01:00:00Z"), run("completed", "success", "2026-10-18T02:00:00Z")];
    assert.equal(ciVerdict(rerun).state, "green");
    assert.equal(ciVerdict([run("completed", "cancelled", "2026-10-18T01:00:00Z")]).state, "red");
});

test("ciFailureText names the failed jobs and steps, with their log tails", () => {
    const text = ciFailureText(
        { id: 9, html_url: "https://example/9", conclusion: "failure" },
        [
            { id: 1, name: "Unit tests and lint", conclusion: "failure", steps: [{ name: "Unit tests and lint", conclusion: "failure" }] },
            { id: 2, name: "Web checks", conclusion: "success", steps: [] },
        ],
        { 1: "Lint found errors" },
    );
    assert.match(text, /\*\*Unit tests and lint\*\* failed at: Unit tests and lint/);
    assert.match(text, /Lint found errors/);
    assert.doesNotMatch(text, /Web checks/);
});

const spec = `# Piece: p

## What it delivers

Words.

## Design

### Android

Android design.

### Web (shared bits)

Web design.

## Build steps

Abbreviations: <web> is npm test.

### build-1: Android (Sonnet, high)

Reads: Design › Android

Do the Android part.

\`\`\`bash
# not a heading
./gradlew testDebugUnitTest
\`\`\`

### build-2: Web (Sonnet, medium)

Do the web part.

### review (Sonnet, high)

Review it.
`;

const protocol = `# Jogging protocol

## Phase 2: build

### Build step

Build rules.

### Review step

Review rules.

## In CI

CI rules.

## Finishing a step

Finish rules.

## Blockers

Blocker rules.
`;

const files = {
    spec,
    protocol,
    log: "# Log\n\n## 2026-10-18 10:00 p/spec (opus)\nSpec written.\n\n## 2026-10-18 11:00 q/build-1 (sonnet)\nOther piece.\n",
    goals: "# Goals\n\nGoal text.",
    standards: "# Coding standards\n\nStandard text.",
};
const specPiece = { id: "p", title: "The piece", spec: "jogging/specs/p.md" };

test("section finds headings by name, prefix or parenthesis, and ignores code fences", () => {
    assert.match(section(spec, ["Build steps", "build-1"]), /^### build-1: Android[\s\S]*not a heading[\s\S]*testDebugUnitTest\n```$/);
    assert.equal(section(spec, ["Design", "Web"]), "### Web (shared bits)\n\nWeb design.");
    assert.equal(section(spec, ["Design", "iOS"]), null);
    assert.deepEqual(readsOf("Reads: Design › Android, `Design > Web`."), [["Design", "Android"], ["Design", "Web"]]);
    assert.equal(readsOf("No reads here"), null);
});

test("pieceLog keeps only the piece's entries", () => {
    assert.equal(pieceLog(files.log, "p"), "## 2026-10-18 10:00 p/spec (opus)\nSpec written.");
});

test("a build prompt starts with the step and holds only what it reads", () => {
    const prompt = phase2Prompt(specPiece, { id: "build-1", phase: 2 }, files);
    const order = ["# Your step: p/build-1", "Do the Android part.", "Abbreviations", "Android design.", "Spec written.", "Build rules.", "CI rules.", "Finish rules.", "Blocker rules."];
    const at = order.map((t) => prompt.indexOf(t));
    assert.ok(at.every((i, k) => i >= 0 && (k === 0 || i > at[k - 1])), `in order: ${at}`);
    for (const absent of ["Web design.", "Do the web part.", "Review rules.", "Goal text.", "Other piece.", "Words."]) {
        assert.ok(!prompt.includes(absent), `no "${absent}"`);
    }
    assert.match(prompt, /\n# not a heading\n/, "code is quoted as it is");
    assert.match(prompt, /^## build-1: Android/m);
});

test("a build prompt carries the last CI failure and Alan's reply", () => {
    const prompt = phase2Prompt({ ...specPiece, userReply: "Use en-NZ" }, { id: "build-1", phase: 2, ciFailure: "lint failed" }, files);
    assert.match(prompt, /# CI failed on the last attempt[\s\S]*lint failed/);
    assert.match(prompt, /Use en-NZ/);
});

test("a spec that can't brief a build step fails loudly", () => {
    assert.throws(() => phase2Prompt(specPiece, { id: "build-2", phase: 2 }, files), /no "Reads:" line/);
    assert.throws(() => phase2Prompt(specPiece, { id: "build-9", phase: 2 }, files), /no "### build-9"/);
    const badRead = { ...files, spec: spec.replace("Reads: Design › Android", "Reads: Design › iOS") };
    assert.throws(() => phase2Prompt(specPiece, { id: "build-1", phase: 2 }, badRead), /isn't a heading/);
});

test("a review prompt has the diff, the whole spec, the goals and the standards", () => {
    const prompt = phase2Prompt({ ...specPiece, baseSha: "abc1234" }, { id: "review", phase: 2 }, files, " app/A.kt | 2 +-");
    for (const present of ["# Your step: p/review", "abc1234", "app/A.kt | 2 +-", "Do the web part.", "Goal text.", "Standard text.", "Review rules."]) {
        assert.ok(prompt.includes(present), `has "${present}"`);
    }
    assert.ok(!prompt.includes("Build rules."));
    assert.ok(prompt.indexOf("Review it.") < prompt.indexOf("abc1234"), "the goal comes first");
});
