// The Jogging support crew: runs The Work one step per `claude -p` session.
//
//   node jogging/jog.mjs run       # run steps until the budget, the work or the pieces run out
//   node jogging/jog.mjs status    # print the next step and the pacing verdict, run nothing
//
// See jogging/PROTOCOL.md for what each session does.

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(HERE);
const STATE = path.join(HERE, "state.json");
const LOCK = path.join(HERE, ".lock");
const RUNS = path.join(HERE, "runs");
const TASK_NAME = "TortoiseSpelling Jogging";
const GH_USER = "DontPanic345";
const PERSONAL_EMAIL = "falloonalan@gmail.com";
const PERSONAL_CONFIG_DIR = path.join(os.homedir(), ".claude-personal");
// Any of these would make `claude` sign in some other way than the personal profile's login.
const AUTH_OVERRIDES = [
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "CLAUDE_CODE_OAUTH_TOKEN",
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
];
const MAX_ATTEMPTS = 2;
const LOCK_STALE_MS = 8 * 3600_000;

// ---- Pure logic (covered by jog.test.mjs) ----

// Continue while the 5-hour window is under 50% and the weekly window is under
// day-of-cycle / 7 × 90%.
export const pace = ({ session, weekly, weeklyResetsAt }, now) => {
    const cycleStart = weeklyResetsAt.getTime() - 7 * 86400_000;
    const day = Math.min(7, Math.max(1, Math.floor((now.getTime() - cycleStart) / 86400_000) + 1));
    const weeklyLimit = (day / 7) * 90;
    if (session >= 50) return { ok: false, reason: `5-hour usage ${session}% ≥ 50%` };
    if (weekly >= weeklyLimit) {
        return { ok: false, reason: `weekly usage ${weekly}% ≥ ${weeklyLimit.toFixed(1)}% (day ${day})` };
    }
    return { ok: true, reason: `5-hour ${session}%, weekly ${weekly}% < ${weeklyLimit.toFixed(1)}% (day ${day})` };
};

const pendingIn = (piece, phase) => piece.steps.find((s) => s.status === "pending" && s.phase === phase);

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

// `claude` without CLAUDE_CONFIG_DIR is the work account, so every session is refused
// unless `claude auth status` proves it's the personal one.
export const accountProblem = (status) => {
    if (!status.loggedIn) return "not logged in";
    if (status.email !== PERSONAL_EMAIL) return `signed in as ${status.email}, not ${PERSONAL_EMAIL}`;
    if (status.authMethod !== "claude.ai" || status.apiProvider !== "firstParty") {
        return `auth is ${status.authMethod}/${status.apiProvider}, not the claude.ai subscription`;
    }
    if (path.resolve(status.configDirectory) !== path.resolve(PERSONAL_CONFIG_DIR)) {
        return `config directory is ${status.configDirectory}, not ${PERSONAL_CONFIG_DIR}`;
    }
    return null;
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

export const stepPrompt = (piece, step) =>
    [
        `You are a Jogging session for Tortoise Spelling, with no other context.`,
        `Read CLAUDE.md, jogging/PROTOCOL.md, jogging/GOALS.md, piece "${piece.id}" in jogging/state.json, and the end of jogging/LOG.md.`,
        `Do step "${step.id}" of piece "${piece.id}" (${piece.title}) exactly as PROTOCOL.md describes, and nothing else.`,
        step.title ? `The step: ${step.title}. Its details are in ${piece.spec}.` : "",
        piece.userReply ? `Alan replied to this piece's blocker: """${piece.userReply}"""` : "",
        `Finish by updating jogging/state.json and jogging/LOG.md, then commit and push.`,
    ]
        .filter(Boolean)
        .join("\n");

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

const commitState = (message) => {
    git("add", "jogging/state.json");
    if (git("diff", "--cached", "--name-only")) {
        git("commit", "-m", `jogging: ${message}`);
        git("push");
    }
};

// Forced, not defaulted: an inherited CLAUDE_CONFIG_DIR may point at the work profile.
const setupEnv = () => {
    process.env.CLAUDE_CONFIG_DIR = PERSONAL_CONFIG_DIR;
    for (const key of AUTH_OVERRIDES) delete process.env[key];
    process.env.JAVA_HOME ??= "C:\\Program Files\\Android\\Android Studio\\jbr";
    process.env.ANDROID_HOME ??= path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
    process.env.GH_TOKEN = sh("gh", ["auth", "token", "--user", GH_USER]);
};

// Runs before every session. Throws, so a wrong account stops the run before any model call.
const assertIdentity = () => {
    const problem = accountProblem(JSON.parse(sh("claude", ["auth", "status"])));
    if (problem) throw new Error(`refusing to run: Claude ${problem}`);
    const email = git("config", "user.email");
    if (email !== PERSONAL_EMAIL) throw new Error(`refusing to run: git user.email is ${email}`);
    const login = gh("api", "user", "--jq", ".login");
    if (login !== GH_USER) throw new Error(`refusing to run: GH_TOKEN belongs to ${login}`);
};

const readUsage = () => {
    const script = path.join(process.env.CLAUDE_CONFIG_DIR, "skills", "usage-check", "usage.py");
    const out = sh("python", [script, "--json"], { timeout: 240_000 });
    return parseUsage(JSON.parse(out).raw);
};

const gh = (...args) => sh("gh", args);

// Posted through a workflow so the message comes from github-actions[bot]; GitHub
// doesn't notify Alan about comments made with his own token.
const notify = ({ issue, title, body }) => {
    const args = ["workflow", "run", "jogging-notify.yml", "-f", `body=${body}`];
    if (issue) args.push("-f", `issue=${issue}`);
    else args.push("-f", `title=${title}`);
    gh(...args);
};

const findIssue = (title) => {
    for (let i = 0; i < 12; i++) {
        const found = JSON.parse(gh("issue", "list", "--state", "open", "--search", `"${title}" in:title`, "--json", "number,title"));
        const hit = found.find((f) => f.title === title);
        if (hit) return hit.number;
        execFileSync(process.execPath, ["-e", "setTimeout(()=>{},10000)"]);
    }
    return null;
};

const ensureLogIssue = (state) => {
    if (state.logIssue) return state.logIssue;
    const title = "Jogging log";
    notify({ title, body: "Progress from the Jogging loop. Blockers get their own issues." });
    state.logIssue = findIssue(title);
    writeState(state);
    commitState("record the log issue");
    return state.logIssue;
};

// A blocked piece resumes when Alan comments on its issue or closes it.
const checkReplies = (state) => {
    for (const piece of state.pieces.filter((p) => p.status === "blocked" && p.blockerIssue)) {
        const view = JSON.parse(gh("issue", "view", String(piece.blockerIssue), "--json", "state,comments"));
        const replies = view.comments.filter(
            (c) => c.author.login === GH_USER && new Date(c.createdAt) > new Date(piece.blockedAt),
        );
        if (replies.length === 0 && view.state === "OPEN") continue;
        piece.userReply = replies.map((c) => c.body).join("\n\n") || "(Alan closed the issue without comment.)";
        piece.status = "active";
        for (const s of piece.steps) if (s.status === "blocked") s.status = "pending";
        delete piece.blocker;
        log(`unblocked ${piece.id}`);
    }
};

// Pieces a session has just marked blocked get an issue.
const raiseBlockers = (state) => {
    for (const piece of state.pieces.filter((p) => p.status === "blocked" && !p.blockerIssue)) {
        const title = `Jogging blocker: ${piece.id}`;
        notify({
            title,
            body: `${piece.blocker ?? "(no details given; see jogging/LOG.md)"}\n\nReply here, or close the issue, to unblock it.`,
        });
        piece.blockerIssue = findIssue(title);
        piece.blockedAt = new Date().toISOString();
        log(`blocked ${piece.id} -> issue #${piece.blockerIssue}`);
    }
};

const disableTask = () => {
    try {
        sh("schtasks", ["/Change", "/TN", TASK_NAME, "/DISABLE"]);
    } catch (e) {
        log(`could not disable the scheduled task: ${e.message}`);
    }
};

const runSession = (piece, step) =>
    new Promise((resolve) => {
        fs.mkdirSync(RUNS, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const out = fs.createWriteStream(path.join(RUNS, `${stamp}-${piece.id}-${step.id}.jsonl`));
        const child = spawn(
            "claude",
            [
                "-p", stepPrompt(piece, step),
                "--model", step.model,
                "--effort", step.effort,
                "--permission-mode", "auto",
                "--output-format", "stream-json",
                "--verbose",
            ],
            { cwd: REPO, shell: false, stdio: ["ignore", "pipe", "pipe"] },
        );
        let model = null;
        let buf = "";
        child.stdout.on("data", (chunk) => {
            out.write(chunk);
            buf += chunk;
            let nl;
            while ((nl = buf.indexOf("\n")) >= 0) {
                const line = buf.slice(0, nl);
                buf = buf.slice(nl + 1);
                try {
                    const frame = JSON.parse(line);
                    if (frame.type === "system" && frame.subtype === "init" && !model) {
                        model = frame.model;
                        if (!model.includes(step.model)) {
                            log(`model mismatch: wanted ${step.model}, got ${model}; stopping the session`);
                            child.kill();
                        }
                    }
                } catch {
                    // partial or non-JSON line
                }
            }
        });
        child.stderr.on("data", (chunk) => out.write(chunk));
        child.on("close", (code) => {
            out.end();
            resolve({ code, model });
        });
    });

const acquireLock = () => {
    try {
        const held = fs.statSync(LOCK);
        if (Date.now() - held.mtimeMs < LOCK_STALE_MS) return false;
    } catch {
        // no lock
    }
    fs.writeFileSync(LOCK, String(process.pid));
    return true;
};

const run = async () => {
    if (!acquireLock()) return log("another run holds the lock");
    try {
        setupEnv();
        git("pull", "--ff-only");
        if (git("status", "--porcelain")) return log("working tree is dirty; not starting");

        assertIdentity();
        let state = readState();
        if (!state.enabled) return log("disabled in state.json");
        const logIssue = ensureLogIssue(state);
        checkReplies(state);
        writeState(state);
        commitState("pick up replies");

        for (;;) {
            const usage = readUsage();
            const verdict = pace(usage, new Date());
            if (!verdict.ok) return log(`budget stop: ${verdict.reason}`);

            state = readState();
            if (!state.enabled) return log("paused in state.json");
            const next = nextStep(state);
            if (next.allDone) {
                state.done = true;
                state.enabled = false;
                writeState(state);
                commitState("The Work is done");
                notify({ issue: logIssue, body: "🏁 Every piece is done. Jogging has disabled its scheduled task." });
                disableTask();
                return log("all done");
            }
            if (next.stuck) {
                notify({ issue: logIssue, body: "⛔ Every remaining piece is blocked or waiting on one. Jogging stops until a blocker is answered." });
                return log("all remaining pieces blocked");
            }

            const { piece, step } = next;
            assertIdentity();
            log(`start ${piece.id}/${step.id} on ${step.model}/${step.effort} (${verdict.reason})`);
            const { code, model } = await runSession(piece, step);
            log(`end ${piece.id}/${step.id}: exit ${code}, model ${model}`);

            git("pull", "--ff-only");
            state = readState();
            const p = state.pieces.find((x) => x.id === piece.id);
            const s = p.steps.find((x) => x.id === step.id);
            if (code !== 0 || !model?.includes(step.model)) {
                if (git("status", "--porcelain")) {
                    git("stash", "push", "--include-untracked", "-m", `jogging ${piece.id}/${step.id} leftovers`);
                }
                return log(`session failed; stopping this run`);
            }
            if (s.status === "pending") {
                s.attempts = (s.attempts ?? 0) + 1;
                if (s.attempts >= MAX_ATTEMPTS) {
                    s.status = "blocked";
                    p.status = "blocked";
                    p.blocker ??= `Step ${s.id} ended ${s.attempts} times without finishing. See jogging/LOG.md and jogging/runs/.`;
                }
            }
            if (s.status === "done" && p.status === "done") {
                notify({ issue: logIssue, body: `✅ ${p.id} is done: ${p.title}` });
            }
            raiseBlockers(state);
            writeState(state);
            commitState(`after ${piece.id}/${step.id}`);
            if (git("status", "--porcelain")) return log("session left uncommitted changes; stopping");
        }
    } finally {
        fs.rmSync(LOCK, { force: true });
    }
};

const status = () => {
    setupEnv();
    assertIdentity();
    console.log(`identity: ${PERSONAL_EMAIL}, ${PERSONAL_CONFIG_DIR}, gh ${GH_USER}`);
    const state = readState();
    const next = nextStep(state);
    console.log(
        next.piece ? `next: ${next.piece.id}/${next.step.id} on ${next.step.model}/${next.step.effort}` : JSON.stringify(next),
    );
    console.log(`pacing: ${JSON.stringify(pace(readUsage(), new Date()))}`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const cmd = process.argv[2];
    const main = { run, status }[cmd];
    if (!main) {
        console.error("Usage: node jogging/jog.mjs <run|status>");
        process.exit(2);
    }
    Promise.resolve(main()).catch((e) => {
        log(`crash: ${e.stack ?? e}`);
        process.exit(1);
    });
}
