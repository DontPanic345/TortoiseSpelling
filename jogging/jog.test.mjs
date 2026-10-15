import assert from "node:assert/strict";
import { test } from "node:test";
import os from "node:os";
import path from "node:path";
import { accountProblem, logTail, nextStep, pace, parseUsage, specSection, stepPrompt, tokenProblem } from "./jog.mjs";

const resets = new Date("2026-10-17T09:00:00Z");
const day = (n) => new Date(resets.getTime() - 7 * 86400_000 + (n - 1) * 86400_000 + 3600_000);

test("pace stops at half the 5-hour window", () => {
    assert.equal(pace({ session: 49, weekly: 0, weeklyResetsAt: resets }, day(1)).ok, true);
    assert.equal(pace({ session: 50, weekly: 0, weeklyResetsAt: resets }, day(1)).ok, false);
});

test("pace spreads the weekly budget across the cycle", () => {
    assert.equal(pace({ session: 0, weekly: 12, weeklyResetsAt: resets }, day(1)).ok, true);
    assert.equal(pace({ session: 0, weekly: 13, weeklyResetsAt: resets }, day(1)).ok, false);
    assert.equal(pace({ session: 0, weekly: 89, weeklyResetsAt: resets }, day(7)).ok, true);
    assert.equal(pace({ session: 0, weekly: 90, weeklyResetsAt: resets }, day(7)).ok, false);
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

const personal = {
    loggedIn: true,
    authMethod: "claude.ai",
    apiProvider: "firstParty",
    email: "falloonalan@gmail.com",
    configDirectory: path.join(os.homedir(), ".claude-personal"),
};

test("the personal account passes", () => {
    assert.equal(accountProblem(personal), null);
});

test("the work account is refused", () => {
    const work = { ...personal, email: "alan.falloon@farmlands.co.nz", configDirectory: path.join(os.homedir(), ".claude") };
    assert.match(accountProblem(work), /farmlands/);
    assert.match(accountProblem({ ...personal, configDirectory: path.join(os.homedir(), ".claude") }), /config directory/);
});

test("an API key login is refused", () => {
    assert.match(accountProblem({ ...personal, authMethod: "api_key" }), /subscription/);
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

test("logTail keeps the last entries and drops the preamble", () => {
    const log = "# Log\n\nintro\n\n## a\none\n\n## b\ntwo\n\n## c\nthree\n";
    assert.equal(logTail(log, 2), "## b\ntwo\n\n## c\nthree");
    assert.equal(logTail("# Log\n", 2), "");
});

test("specSection takes the step's section up to the next heading", () => {
    const spec = "## Build steps\n\nintro\n\n### build-1: first (Sonnet)\n\ndo one\n\n#### detail\n\nmore\n\n### build-10: tenth\n\nten\n\n### review (Opus)\n\ncheck\n\n## Later\n\nx\n";
    assert.equal(specSection(spec, "build-1"), "### build-1: first (Sonnet)\n\ndo one\n\n#### detail\n\nmore");
    assert.equal(specSection(spec, "review"), "### review (Opus)\n\ncheck");
    assert.equal(specSection(spec, "build-2"), null);
});

test("stepPrompt inlines the material and ends with the task", () => {
    const piece = {
        id: "p", title: "Piece", spec: "jogging/specs/p.md", docs: ["docs/p.md"], userReply: "go ahead",
        steps: [{ id: "build-1", phase: 2, title: "First", status: "pending" }],
    };
    const material = {
        protocol: "PROTOCOL TEXT", goals: "GOALS TEXT", log: "## old\nx\n",
        spec: "# Spec\n\n### build-1: first\n\nSTEP DETAIL\n\n### review\n\nr\n", docs: [{ path: "docs/p.md", text: "DOC TEXT" }],
    };
    const prompt = stepPrompt(piece, piece.steps[0], true, material);
    for (const s of ["PROTOCOL TEXT", "GOALS TEXT", "## old", "DOC TEXT", '"status": "pending"', '"In the cloud"', '"""go ahead"""']) {
        assert.ok(prompt.includes(s), s);
    }
    assert.ok(!prompt.includes('"userReply"'));
    assert.ok(prompt.lastIndexOf("STEP DETAIL") > prompt.indexOf("</file>", prompt.indexOf("# Spec")));
    assert.ok(prompt.trimEnd().endsWith("then commit and push."));
});
