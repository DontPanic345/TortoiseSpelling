// The Jogging support crew: runs The Work one step per `claude -p` session, on GitHub
// Actions (.github/workflows/jogging.yml), beside an emulator.
//
//   node jogging/jog.mjs run       # run steps until the budget, the deadline, the work or the pieces run out
//   node jogging/jog.mjs status    # print the next step and the pacing verdict, run nothing
//   node jogging/jog.mjs report <message>   # comment on the log issue
//
// The crew is the only writer of a step's or a piece's status in state.json: a session
// reports how its step ended in jogging/runs/result.json, and a phase 2 step that reports
// done counts only once `ci.yml` is green on its last push. See jogging/PROTOCOL.md.
//
// Environment: GH_TOKEN (the push token, also the sessions' `gh`), BOT_TOKEN (the
// workflow's own token: issues and comments come from github-actions[bot], so GitHub
// notifies Alan), CLAUDE_CODE_OAUTH_TOKEN, ANDROID_SERIAL.

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(HERE);
const STATE = path.join(HERE, "state.json");
const RUNS = path.join(HERE, "runs");
const RESULT = path.join(RUNS, "result.json");
const GH_USER = "DontPanic345";
const GH_REPO = `${GH_USER}/TortoiseSpelling`;
const WORKFLOW = "jogging.yml";
const MAX_ATTEMPTS = 2;
const STARTED = Date.now();
// The job is killed at 345 minutes. No step starts after the deadline, and none runs
// past its timeout, so the crew always gets to record the last one.
const DEADLINE_MS = Number(process.env.JOGGING_DEADLINE_MIN ?? 250) * 60_000;
const SESSION_TIMEOUT_MS = Number(process.env.JOGGING_SESSION_MIN ?? 90) * 60_000;
// Written into transcripts, which become a workflow artifact anyone signed in can read.
const SECRETS = ["CLAUDE_CODE_OAUTH_TOKEN", "GH_TOKEN", "BOT_TOKEN"];
// The crew waits this long for `ci.yml` on a step's last push, polling every 30 s. A run
// that hasn't appeared after five minutes isn't coming.
const CI_TIMEOUT_MS = 75 * 60_000;
const CI_POLL_MS = 30_000;
const CI_GRACE_MS = 5 * 60_000;
// The job's own limit (jogging.yml), less a margin to record the outcome.
const JOB_END_MS = 335 * 60_000;

// ---- Pure logic (covered by jog.test.mjs) ----

// Continue while the 5-hour window is under 50% and the weekly window is under
// day-of-cycle / 7 × 95%.
export const pace = ({ session, weekly, weeklyResetsAt }, now) => {
    const cycleStart = weeklyResetsAt.getTime() - 7 * 86400_000;
    const day = Math.min(7, Math.max(1, Math.floor((now.getTime() - cycleStart) / 86400_000) + 1));
    const weeklyLimit = (day / 7) * 95;
    if (session >= 50) return { ok: false, reason: `5-hour usage ${session}% ≥ 50%` };
    if (weekly >= weeklyLimit) {
        return { ok: false, reason: `weekly usage ${weekly}% ≥ ${weeklyLimit.toFixed(1)}% (day ${day})` };
    }
    return { ok: true, reason: `5-hour ${session}%, weekly ${weekly}% < ${weeklyLimit.toFixed(1)}% (day ${day})` };
};

// A step still waiting on CI holds up the rest of its piece.
const pendingIn = (piece, phase) => {
    const step = piece.steps.find((s) => s.status === "pending" && s.phase === phase);
    return step && !step.awaitingCi ? step : undefined;
};

// Every spec is written before any build starts. Builds wait for their dependencies.
export const nextStep = (state) => {
    const active = state.pieces.filter((p) => p.status === "active");
    if (state.pieces.every((p) => p.status === "done")) return { allDone: true };
    for (const piece of active) {
        const step = pendingIn(piece, 1);
        if (step) return { piece, step };
    }
    const anySpecPending = state.pieces.some((p) => p.steps.some((s) => s.phase === 1 && s.status === "pending"));
    if (!anySpecPending) {
        const done = new Set(state.pieces.filter((p) => p.status === "done").map((p) => p.id));
        for (const piece of active) {
            if (!piece.dependsOn.every((d) => done.has(d))) continue;
            const step = pendingIn(piece, 2);
            if (step) return { piece, step };
        }
    }
    return { stuck: true };
};

// A rejected GH_TOKEN can't push, so nothing a session does would land.
export const tokenProblem = async (token, get = fetch) => {
    if (!token) return "GH_TOKEN is not set";
    const res = await get("https://api.github.com/user", {
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
    });
    return res.ok ? null : `GitHub rejected GH_TOKEN (HTTP ${res.status})`;
};

export const parseUsage = (raw) => {
    const limits = raw.limits ?? [];
    const session = limits.find((l) => l.kind === "session");
    const weekly = limits.find((l) => l.kind === "weekly_all");
    if (session && weekly) {
        return { session: session.percent, weekly: weekly.percent, weeklyResetsAt: new Date(weekly.resets_at) };
    }
    if (raw.five_hour && raw.seven_day) {
        return {
            session: raw.five_hour.utilization,
            weekly: raw.seven_day.utilization,
            weeklyResetsAt: new Date(raw.seven_day.resets_at),
        };
    }
    const uw = raw.unifiedWindows;
    if (uw?.five_hour && uw?.seven_day) {
        return {
            session: uw.five_hour.utilization * 100,
            weekly: uw.seven_day.utilization * 100,
            weeklyResetsAt: new Date(uw.seven_day.resetsAt * 1000),
        };
    }
    throw new Error("no session/weekly windows in the usage payload");
};

// Phase 1 runs on Opus, which reads everything anyway, so its prompt is a reading list.
export const phase1Prompt = (piece, step) =>
    [
        `You are a Jogging session for Tortoise Spelling, running in GitHub Actions with no other context.`,
        `Read jogging/PROTOCOL.md, jogging/GOALS.md, piece "${piece.id}" in jogging/state.json, and the end of jogging/LOG.md.`,
        `Do step "${step.id}" of piece "${piece.id}" (${piece.title}) exactly as PROTOCOL.md describes, and nothing else.`,
        step.title ? `The step: ${step.title}. Its details are in ${piece.spec}.` : "",
        piece.userReply ? `Alan replied to this piece's blocker: """${piece.userReply}"""` : "",
        `Finish as PROTOCOL.md's "Finishing a step" says: commit and push your work and the log entry, then write jogging/runs/result.json.`,
    ]
        .filter(Boolean)
        .join("\n");

// Markdown headings outside code fences, each with the lines it spans (up to the next
// heading at its level or above).
const headings = (md) => {
    const lines = md.split("\n");
    const found = [];
    let fenced = false;
    lines.forEach((line, i) => {
        if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
        const m = !fenced && /^(#{1,6})\s+(.+?)\s*$/.exec(line);
        if (m) found.push({ level: m[1].length, title: m[2], start: i });
    });
    for (const [k, h] of found.entries()) {
        const next = found.slice(k + 1).find((n) => n.level <= h.level);
        h.end = next ? next.start : lines.length;
    }
    return { lines, found };
};

// "build-2" matches "build-2: Android (Sonnet, high)", "Android" matches "Android", and
// "Choosing the voice" matches "Choosing the voice (pure, shared)".
const titleMatches = (title, name) => {
    const t = title.toLowerCase();
    const n = name.trim().toLowerCase();
    return t === n || t.startsWith(`${n}:`) || t.startsWith(`${n} (`);
};

// Moves every heading outside code fences so the first one sits at `level`, so quoted
// material nests under the prompt's own top-level sections.
const atLevel = (md, level = 2) => {
    const first = /^(#{1,6})\s/m.exec(md);
    const by = first ? level - first[1].length : 0;
    let fenced = false;
    return md
        .split("\n")
        .map((line) => {
            if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
            const m = !fenced && /^(#{1,6})(\s.*)$/.exec(line);
            return m ? "#".repeat(Math.min(6, Math.max(1, m[1].length + by))) + m[2] : line;
        })
        .join("\n");
};

// The text under a heading path, e.g. ["Design", "Android"], or null.
export const section = (md, path) => {
    const { lines, found } = headings(md);
    let range = { start: -1, end: lines.length };
    let hit = null;
    for (const name of path) {
        hit = found.find((h) => h.start > range.start && h.start < range.end && titleMatches(h.title, name));
        if (!hit) return null;
        range = hit;
    }
    return lines.slice(hit.start, hit.end).join("\n").trim();
};

// What sits between a heading and its first subheading: a spec's shared abbreviations.
const preamble = (md, name) => {
    const text = section(md, [name]);
    if (!text) return null;
    const body = text.split("\n");
    const sub = body.findIndex((l, i) => i > 0 && /^#{1,6}\s/.test(l));
    return body.slice(0, sub < 0 ? body.length : sub).join("\n").trim();
};

// A build step's `Reads: Design › Android, Design › Docs` line, as heading paths.
export const readsOf = (stepText) => {
    const m = /^Reads:\s*(.+)$/m.exec(stepText);
    if (!m) return null;
    return m[1]
        .replace(/\.$/, "")
        .split(/,\s*/)
        .map((ref) => ref.split(/\s*(?:›|>)\s*/).map((s) => s.replace(/`/g, "").trim()));
};

// LOG.md entries for one piece, oldest first.
export const pieceLog = (log, pieceId) =>
    log
        .split(/^(?=## )/m)
        .filter((entry) => entry.split("\n")[0].includes(` ${pieceId}/`))
        .map((entry) => entry.trim())
        .join("\n\n");

const PROTOCOL_FOR = {
    build: [["Phase 2: build", "Build step"], ["In CI"], ["Finishing a step"], ["Blockers"]],
    review: [["Phase 2: build", "Review step"], ["In CI"], ["Finishing a step"], ["Blockers"]],
};

// A phase 2 session's whole prompt: its goal first, then only the material that serves it.
// Throws when the spec can't supply what the step needs; the crew blocks the piece on that.
// `files` holds the contents of the spec, PROTOCOL.md, LOG.md, GOALS.md and
// CODING_STANDARDS.md, and `diffStat` the piece's changes since its base (review only).
export const phase2Prompt = (piece, step, files, diffStat = "") => {
    const kind = step.id === "review" ? "review" : "build";
    const stepText = section(files.spec, ["Build steps", step.id]);
    if (!stepText) throw new Error(`${piece.spec} has no "### ${step.id}" under "## Build steps"`);
    const parts = [
        `You are a Jogging session for Tortoise Spelling, running in GitHub Actions with no other context. ` +
            `\`CLAUDE.md\` is loaded. This prompt holds everything your step needs; read code, not Jogging's files.`,
        `# Your step: ${piece.id}/${step.id}\n\nPiece: ${piece.title} (spec: \`${piece.spec}\`).\n\n${atLevel(stepText)}`,
    ];
    if (step.ciFailure) parts.push(`# CI failed on the last attempt\n\nFix this first.\n\n${step.ciFailure}`);
    if (piece.userReply) parts.push(`# Alan replied to this piece's blocker\n\n"""${piece.userReply}"""`);
    if (kind === "build") {
        const reads = readsOf(stepText);
        if (!reads) throw new Error(`${piece.spec}: step ${step.id} has no "Reads:" line`);
        const shared = preamble(files.spec, "Build steps");
        if (shared) parts.push(`# From the spec's build steps\n\n${shared.replace(/^#+.*\n*/, "")}`);
        const design = reads.map((ref) => {
            const text = section(files.spec, ref);
            if (!text) throw new Error(`${piece.spec}: step ${step.id} reads "${ref.join(" › ")}", which isn't a heading`);
            return text;
        });
        parts.push(`# The design you need\n\n${design.map((d) => atLevel(d)).join("\n\n")}`);
    } else {
        const base = piece.baseSha
            ? `The piece starts after \`${piece.baseSha}\`. Its changes since then:\n\n\`\`\`\n${diffStat.trim()}\n\`\`\``
            : "No base commit was recorded for this piece: find its first build commit in `git log`.";
        parts.push(`# The diff to review\n\n${base}`);
        parts.push(`# The whole spec\n\n${atLevel(files.spec.trim())}`);
        parts.push(`# GOALS.md\n\n${atLevel(files.goals.trim())}`);
        parts.push(`# CODING_STANDARDS.md\n\n${atLevel(files.standards.trim())}`);
    }
    const log = pieceLog(files.log, piece.id);
    if (log) parts.push(`# This piece's log so far\n\n${atLevel(log)}`);
    const rules = PROTOCOL_FOR[kind].map((ref) => section(files.protocol, ref));
    if (rules.some((r) => !r)) throw new Error("PROTOCOL.md is missing a section the phase 2 prompt needs");
    parts.push(`# Rules (from jogging/PROTOCOL.md)\n\n${rules.map((r) => atLevel(r)).join("\n\n")}`);
    parts.push(
        `Do only this step. Finish as "Finishing a step" says: commit and push your work and the log entry, then write jogging/runs/result.json.`,
    );
    return parts.join("\n\n") + "\n";
};

// Where CI is for one commit, from its `ci.yml` push runs (newest attempt wins).
export const ciVerdict = (runs) => {
    if (runs.length === 0) return { state: "none" };
    if (runs.some((r) => r.status !== "completed")) return { state: "running" };
    const last = [...runs].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
    return { state: last.conclusion === "success" ? "green" : "red", run: last };
};

// What the next attempt is told about a red run: which jobs and steps failed, and the
// end of each failed job's log.
export const ciFailureText = (run, jobs, tails = {}) => {
    const failed = jobs.filter((j) => j.conclusion && !["success", "skipped"].includes(j.conclusion));
    const lines = [`\`ci.yml\` run ${run.html_url ?? run.id} ended ${run.conclusion}.`];
    for (const job of failed) {
        const steps = (job.steps ?? []).filter((s) => s.conclusion === "failure").map((s) => s.name);
        lines.push(`\n**${job.name}** failed${steps.length ? ` at: ${steps.join(", ")}` : ""}.`);
        if (tails[job.id]) lines.push("```\n" + tails[job.id].trim() + "\n```");
    }
    return lines.join("\n");
};

// The session's init frame says what it really got. A model the user's default
// overrode, or a session without auto mode, can't do the step. A model with no auto mode
// (Haiku 4.5, which older CLIs pick for `haiku`) silently falls back to default, which
// refuses every command and edit in `claude -p`.
export const initProblem = (frame, step) => {
    if (!frame.model?.includes(step.model)) return `model mismatch: wanted ${step.model}, got ${frame.model}`;
    if (frame.permissionMode !== "auto") return `permission mode is ${frame.permissionMode}, not auto`;
    return null;
};

// How a session ended: what it wrote to result.json, or null when it wrote nothing
// usable. `exitOk` is false when the session crashed, was killed or got the wrong model.
export const readResult = (text) => {
    if (text == null) return null;
    try {
        const r = JSON.parse(text);
        if (!["done", "pending", "blocked"].includes(r.status)) return null;
        if (r.status === "blocked" && !r.blocker) return null;
        return r;
    } catch {
        return null;
    }
};

// A step that didn't finish gets one more go, then blocks the piece.
const retryOrBlock = (piece, step, why) => {
    step.attempts = (step.attempts ?? 0) + 1;
    if (step.attempts < MAX_ATTEMPTS) return false;
    step.status = "blocked";
    piece.status = "blocked";
    piece.blocker = `Step ${step.id} ended ${step.attempts} times without finishing (${why}). See jogging/LOG.md and this run's transcripts.`;
    return true;
};

const finish = (piece, step) => {
    step.status = "done";
    delete step.ciFailure;
    if (piece.steps.every((s) => s.status === "done")) piece.status = "done";
};

// Applies one session's outcome to the state. Returns what happened, for the run report.
// A `done` that pushed `ciSha` waits for CI (see applyCi) before it counts.
export const applyResult = (state, pieceId, stepId, result, exitOk, ciSha = null) => {
    const piece = state.pieces.find((p) => p.id === pieceId);
    const step = piece.steps.find((s) => s.id === stepId);
    // A session that crashed may not have read the reply, so the next one gets it again.
    if (exitOk) delete piece.userReply;
    const status = exitOk ? result?.status ?? "pending" : "pending";
    if (status === "done" && ciSha) {
        step.awaitingCi = ciSha;
        return "done, waiting on CI";
    }
    if (status === "done") {
        finish(piece, step);
        return "done";
    }
    if (status === "blocked") {
        step.status = "blocked";
        piece.status = "blocked";
        piece.blocker = result.blocker;
        return "blocked";
    }
    if (retryOrBlock(piece, step, "pending")) return "blocked";
    return exitOk ? "pending" : "pending (session failed)";
};

// Settles a step that was waiting on CI. Green, or no run at all, finishes it; red sends it
// back with the failure for the next attempt.
export const applyCi = (state, pieceId, stepId, verdict, failure = "") => {
    const piece = state.pieces.find((p) => p.id === pieceId);
    const step = piece.steps.find((s) => s.id === stepId);
    delete step.awaitingCi;
    if (verdict !== "red") {
        finish(piece, step);
        return verdict === "green" ? "done (CI green)" : "done (no CI run found)";
    }
    step.ciFailure = failure;
    if (retryOrBlock(piece, step, "CI red")) return "blocked (CI red)";
    return "pending (CI red)";
};

// A blocked piece resumes when Alan comments on its issue or closes it. Returns true when
// it resumed. Clears the issue fields, so a later blocker gets an issue of its own.
export const applyReplies = (piece, issue, comments) => {
    const replies = comments.filter((c) => c.user.login === GH_USER && new Date(c.created_at) > new Date(piece.blockedAt));
    if (replies.length === 0 && issue.state === "open") return false;
    piece.userReply = replies.map((c) => c.body).join("\n\n") || "(Alan closed the issue without comment.)";
    piece.status = "active";
    for (const s of piece.steps) {
        if (s.status === "blocked") {
            s.status = "pending";
            delete s.attempts;
        }
    }
    delete piece.blocker;
    delete piece.blockerIssue;
    delete piece.blockedAt;
    return true;
};

export const redact = (text, secrets) => secrets.filter((s) => s && s.length >= 8).reduce((t, s) => t.split(s).join("***"), text);

// ---- Side effects ----

const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    fs.mkdirSync(RUNS, { recursive: true });
    fs.appendFileSync(path.join(RUNS, "crew.log"), line + "\n");
};

const readState = () => JSON.parse(fs.readFileSync(STATE, "utf8"));
const writeState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2) + "\n");

const sh = (cmd, args, opts = {}) =>
    execFileSync(cmd, args, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();

const git = (...args) => sh("git", args);

// Alan may push to main while a run is going (pausing it, say), so every push rebases first.
const push = () => {
    for (let i = 1; ; i++) {
        try {
            git("pull", "--rebase");
            git("push");
            return;
        } catch (e) {
            try {
                git("rebase", "--abort");
            } catch {
                // no rebase in progress
            }
            if (i >= 3) throw e;
        }
    }
};

const commitState = (message) => {
    git("add", "jogging/state.json");
    if (git("diff", "--cached", "--name-only")) {
        git("commit", "-m", `jogging: ${message}`);
        push();
    }
};

const readUsage = () => {
    const out = sh("python3", [path.join(HERE, "usage.py"), "--json"], { timeout: 240_000 });
    return parseUsage(JSON.parse(out).raw);
};

const github = async (method, route, body) => {
    const res = await fetch(`https://api.github.com/repos/${GH_REPO}${route}`, {
        method,
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${process.env.BOT_TOKEN}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`GitHub ${method} ${route}: HTTP ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
};

const comment = (issue, body) => github("POST", `/issues/${issue}/comments`, { body });
const openIssue = async (title, body) => (await github("POST", "/issues", { title, body })).number;

const ensureLogIssue = async (state) => {
    if (state.logIssue) return state.logIssue;
    state.logIssue = await openIssue("Jogging log", "Progress from the Jogging loop. Blockers get their own issues.");
    writeState(state);
    commitState("record the log issue");
    return state.logIssue;
};

const checkReplies = async (state) => {
    for (const piece of state.pieces.filter((p) => p.status === "blocked" && p.blockerIssue)) {
        const n = piece.blockerIssue;
        const issue = await github("GET", `/issues/${n}`);
        const comments = await github("GET", `/issues/${n}/comments?per_page=100`);
        if (!applyReplies(piece, issue, comments)) continue;
        log(`unblocked ${piece.id}`);
        if (issue.state === "open") {
            await comment(n, "Picked up. The next Jogging run carries on with this piece.");
            await github("PATCH", `/issues/${n}`, { state: "closed" });
        }
    }
};

// Pieces that have just been blocked get an issue each.
const raiseBlockers = async (state) => {
    for (const piece of state.pieces.filter((p) => p.status === "blocked" && !p.blockerIssue)) {
        piece.blockerIssue = await openIssue(
            `Jogging blocker: ${piece.id}`,
            `${piece.blocker}\n\nReply here, or close the issue, to unblock it.`,
        );
        piece.blockedAt = new Date().toISOString();
        log(`blocked ${piece.id} -> issue #${piece.blockerIssue}`);
    }
};

// The files a phase 2 prompt draws on, and the piece's changes for a review.
const stepPrompt = (piece, step) => {
    if (step.phase === 1) return phase1Prompt(piece, step);
    const read = (f) => fs.readFileSync(path.join(REPO, f), "utf8");
    const files = {
        spec: read(piece.spec),
        protocol: read("jogging/PROTOCOL.md"),
        log: read("jogging/LOG.md"),
        goals: read("jogging/GOALS.md"),
        standards: read("CODING_STANDARDS.md"),
    };
    const diffStat =
        step.id === "review" && piece.baseSha
            ? git("diff", "--stat=120", `${piece.baseSha}..HEAD`, "--", ".", ":!jogging/LOG.md", ":!jogging/state.json")
            : "";
    return phase2Prompt(piece, step, files, diffStat);
};

// The prompt goes on stdin (a whole spec is too long for an argument) and is saved beside
// the transcript.
const runSession = (piece, step, prompt) =>
    new Promise((resolve) => {
        fs.mkdirSync(RUNS, { recursive: true });
        fs.rmSync(RESULT, { force: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const name = `${stamp}-${piece.id}-${step.id}`;
        fs.writeFileSync(path.join(RUNS, `${name}.prompt.md`), prompt);
        const out = fs.createWriteStream(path.join(RUNS, `${name}.jsonl`));
        const secrets = SECRETS.map((k) => process.env[k]);
        const child = spawn(
            "claude",
            [
                "-p",
                "--model", step.model,
                "--effort", step.effort,
                "--permission-mode", "auto",
                "--output-format", "stream-json",
                "--verbose",
            ],
            { cwd: REPO, shell: false, stdio: ["pipe", "pipe", "pipe"] },
        );
        child.stdin.end(prompt);
        let model = null;
        let refused = null;
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            log(`${piece.id}/${step.id} ran past ${SESSION_TIMEOUT_MS / 60_000} minutes; stopping it`);
            child.kill();
        }, SESSION_TIMEOUT_MS);
        let buf = "";
        child.stdout.on("data", (chunk) => {
            buf += chunk;
            let nl;
            while ((nl = buf.indexOf("\n")) >= 0) {
                const line = buf.slice(0, nl);
                buf = buf.slice(nl + 1);
                out.write(redact(line, secrets) + "\n");
                try {
                    const frame = JSON.parse(line);
                    if (frame.type === "system" && frame.subtype === "init" && !model) {
                        model = frame.model;
                        refused = initProblem(frame, step);
                        if (refused) {
                            log(`${refused}; stopping the session`);
                            child.kill();
                        }
                    }
                } catch {
                    // non-JSON line
                }
            }
        });
        child.stderr.on("data", (chunk) => out.write(redact(String(chunk), secrets)));
        child.on("close", (code) => {
            clearTimeout(timer);
            out.end(redact(buf, secrets));
            resolve({ code, model, refused, timedOut });
        });
    });

// Whatever the session left behind: unpushed commits are pushed if they rebase cleanly,
// anything uncommitted is dropped. The runner is thrown away at the end of the job.
// Returns the commit the session's work ends at, before Alan's newer pushes are pulled.
const tidyUp = () => {
    if (git("status", "--porcelain")) {
        log("session left uncommitted changes; dropping them");
        git("reset", "--hard");
        git("clean", "-fdq", "-e", "jogging/runs/");
    }
    if (git("rev-list", "@{u}..HEAD")) {
        try {
            push();
        } catch (e) {
            log(`could not push the session's commits, dropping them: ${e.message}`);
            git("reset", "--hard", "@{u}");
        }
    }
    const head = git("rev-parse", "HEAD");
    git("pull", "--rebase");
    return head;
};

// Fetches text (a job's log) the GitHub API redirects to.
const githubText = async (route) => {
    const res = await fetch(`https://api.github.com/repos/${GH_REPO}${route}`, {
        headers: { Authorization: `Bearer ${process.env.BOT_TOKEN}` },
    });
    return res.ok ? res.text() : "";
};

const logTail = (text, lines = 40) =>
    redact(
        text
            .split("\n")
            .map((l) => l.replace(/^\S+Z /, ""))
            .slice(-lines)
            .join("\n"),
        SECRETS.map((k) => process.env[k]),
    );

// Waits for `ci.yml` on `sha`, until the timeout or the job's end. Returns the verdict
// ("green", "red", "none", or "running" when time ran out) and, for red, what failed.
const waitForCi = async (sha) => {
    const started = Date.now();
    const until = Math.min(started + CI_TIMEOUT_MS, STARTED + JOB_END_MS);
    for (;;) {
        let runs;
        try {
            ({ workflow_runs: runs } = await github("GET", `/actions/workflows/ci.yml/runs?head_sha=${sha}&event=push`));
        } catch (e) {
            log(`reading CI for ${sha.slice(0, 7)} failed, trying again: ${e.message}`);
            runs = [{ status: "unknown" }];
        }
        const verdict = ciVerdict(runs);
        if (verdict.state === "none" && Date.now() - started < CI_GRACE_MS) verdict.state = "running";
        if (verdict.state === "red") {
            const { jobs } = await github("GET", `/actions/runs/${verdict.run.id}/jobs?per_page=100`).catch(() => ({ jobs: [] }));
            const failed = jobs.filter((j) => j.conclusion === "failure").slice(0, 3);
            const tails = {};
            for (const job of failed) tails[job.id] = logTail(await githubText(`/actions/jobs/${job.id}/logs`));
            return { state: "red", failure: ciFailureText(verdict.run, jobs, tails) };
        }
        if (verdict.state !== "running") return verdict;
        if (Date.now() + CI_POLL_MS > until) return { state: "running" };
        await new Promise((r) => setTimeout(r, CI_POLL_MS));
    }
};

// Settles every step waiting on CI. Returns false when one is still running at the end of
// the time this job has.
const settleCi = async (state) => {
    for (const piece of state.pieces) {
        for (const step of piece.steps.filter((s) => s.awaitingCi)) {
            log(`waiting for ci.yml on ${step.awaitingCi.slice(0, 7)} (${piece.id}/${step.id})`);
            const { state: verdict, failure } = await waitForCi(step.awaitingCi);
            if (verdict === "running") return false;
            const outcome = applyCi(state, piece.id, step.id, verdict, failure);
            log(`${piece.id}/${step.id}: ${outcome}`);
            await raiseBlockers(state);
            writeState(state);
            commitState(`${piece.id}/${step.id} ${outcome}`);
            if (state.pieces.find((p) => p.id === piece.id).status === "done") {
                await comment(state.logIssue, `✅ ${piece.id} is done: ${piece.title}`);
            }
        }
    }
    return true;
};

// Turns the schedule off once The Work is done.
const disableWorkflow = async () => {
    try {
        await github("PUT", `/actions/workflows/${WORKFLOW}/disable`);
    } catch (e) {
        log(`could not disable ${WORKFLOW}: ${e.message}`);
    }
};

// Runs steps until something stops it, and says why.
const runSteps = async (logIssue, ran) => {
    for (;;) {
        git("pull", "--rebase");
        let state = readState();
        if (!(await settleCi(state))) return "deadline: still waiting on CI";
        if (!state.enabled) return "paused in state.json";
        if (Date.now() - STARTED > DEADLINE_MS) return "deadline: no time for another step in this job";
        const next = nextStep(state);
        if (next.allDone) {
            state.done = true;
            state.enabled = false;
            writeState(state);
            commitState("The Work is done");
            await comment(logIssue, "🏁 Every piece is done. Jogging has disabled itself and its workflow.");
            await disableWorkflow();
            return "all done";
        }
        if (next.stuck) {
            if (!state.stuck) {
                state.stuck = true;
                writeState(state);
                commitState("every remaining piece is blocked");
                await comment(logIssue, "⛔ Every remaining piece is blocked or waiting on one. Jogging idles until a blocker is answered.");
            }
            return "all remaining pieces blocked";
        }
        const verdict = pace(readUsage(), new Date());
        if (!verdict.ok) return `budget stop: ${verdict.reason}`;

        const { piece, step } = next;
        // The review diffs the piece from here.
        if (step.phase === 2 && !piece.baseSha) {
            piece.baseSha = git("rev-parse", "HEAD");
            writeState(state);
            commitState(`${piece.id} starts building at ${piece.baseSha.slice(0, 7)}`);
        }
        let prompt;
        try {
            prompt = stepPrompt(piece, step);
        } catch (e) {
            // The spec can't brief the session; only a spec edit fixes that.
            log(`can't brief ${piece.id}/${step.id}: ${e.message}`);
            applyResult(state, piece.id, step.id, { status: "blocked", blocker: e.message }, true);
            ran.push(`${piece.id}/${step.id}: blocked (spec)`);
            await raiseBlockers(state);
            writeState(state);
            commitState(`${piece.id}/${step.id} blocked: the spec can't brief it`);
            continue;
        }
        const before = git("rev-parse", "HEAD");
        log(`start ${piece.id}/${step.id} on ${step.model}/${step.effort} (${verdict.reason})`);
        const { code, model, refused, timedOut } = await runSession(piece, step, prompt);
        // Nothing the session could do about it, so it costs no attempt; the run report says why.
        if (refused) {
            tidyUp();
            return `stopped ${piece.id}/${step.id} before it began: ${refused}`;
        }
        const exitOk = code === 0 && !timedOut && model !== null;
        const result = readResult(fs.existsSync(RESULT) ? fs.readFileSync(RESULT, "utf8") : null);
        log(`end ${piece.id}/${step.id}: exit ${code}, model ${model}, result ${JSON.stringify(result)}`);

        const head = tidyUp();
        state = readState();
        delete state.stuck;
        // Phase 2 pushes wait for CI; a spec step's docs don't need to.
        const ciSha = step.phase === 2 && head !== before ? head : null;
        const outcome = applyResult(state, piece.id, step.id, result, exitOk, ciSha);
        ran.push(`${piece.id}/${step.id}: ${outcome}`);
        const p = state.pieces.find((x) => x.id === piece.id);
        if (p.status === "done") await comment(logIssue, `✅ ${p.id} is done: ${p.title}`);
        await raiseBlockers(state);
        writeState(state);
        commitState(`${piece.id}/${step.id} ${outcome}`);
    }
};

const run = async () => {
    git("pull", "--rebase");
    const state = readState();
    if (!state.enabled) return log("disabled in state.json");
    const badToken = await tokenProblem(process.env.GH_TOKEN);
    if (badToken) throw new Error(badToken);
    const logIssue = await ensureLogIssue(state);
    await checkReplies(state);
    writeState(state);
    commitState("pick up replies");

    const ran = [];
    const reason = await runSteps(logIssue, ran);
    log(reason);
    // A quiet budget stop with nothing run isn't worth a notification.
    if (ran.length > 0 || !reason.startsWith("budget stop")) {
        const steps = ran.length ? ran.map((r) => `- ${r}`).join("\n") : "- (no steps)";
        const url = process.env.GITHUB_RUN_ID
            ? `\n\n[The run](https://github.com/${GH_REPO}/actions/runs/${process.env.GITHUB_RUN_ID})`
            : "";
        await comment(logIssue, `🏃 Run finished: ${reason}\n\n${steps}${url}`);
    }
};

const status = () => {
    const state = readState();
    const next = nextStep(state);
    console.log(`enabled: ${state.enabled}`);
    console.log(
        next.piece ? `next: ${next.piece.id}/${next.step.id} on ${next.step.model}/${next.step.effort}` : JSON.stringify(next),
    );
    console.log(`pacing: ${JSON.stringify(pace(readUsage(), new Date()))}`);
};

// For the workflow to report a failure the crew couldn't, e.g. the job timing out.
const report = () => comment(readState().logIssue, `⚠️ ${process.argv.slice(3).join(" ")}`);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const cmd = process.argv[2];
    const main = { run, status, report }[cmd];
    if (!main) {
        console.error("Usage: node jogging/jog.mjs <run|status|report <message>>");
        process.exit(2);
    }
    Promise.resolve(main()).catch(async (e) => {
        log(`crash: ${e.stack ?? e}`);
        if (cmd === "run") {
            try {
                await comment(readState().logIssue, `💥 Jogging crashed:\n\n\`\`\`\n${e.message ?? e}\n\`\`\``);
            } catch {
                // nothing left to report through
            }
        }
        process.exit(1);
    });
}
