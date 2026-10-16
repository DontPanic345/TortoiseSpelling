import assert from "node:assert/strict";
import { test } from "node:test";
import { applyReplies, applyResult, nextStep, pace, parseUsage, readResult, redact, tokenProblem } from "./jog.mjs";

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
