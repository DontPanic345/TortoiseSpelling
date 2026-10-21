// A small Recraft API client for designing the app icon, with a ledger and a hard cap:
//
//   node scripts/recraft.mjs generate --round explore --direction a --n 4 --prompt "…" [--style …] [--model …] [--colors "#2F5D50,#E7BE8A"]
//   node scripts/recraft.mjs spent
//   node scripts/recraft.mjs check
//
// Recraft is paid and used only while designing: nothing in either app calls it, and no
// test or CI job makes a request. Every request is recorded in docs/icon-concepts/log.json,
// and one that would pass CAP, or the balance the API reports, is refused before it is sent.
// The token comes from RECRAFT_API_TOKEN and is never printed or written anywhere.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { REPO_ROOT } from "./repo-files.mjs";

export const CAP = 10000;
export const API = "https://external.api.recraft.ai/v1";
export const DEFAULT_MODEL = "recraftv4_1_vector";
export const CONCEPTS = "docs/icon-concepts";
export const LEDGER = `${CONCEPTS}/log.json`;

// Units per vector image, from https://www.recraft.ai/docs/api-reference/pricing on
// 21/10/2026 ($1 = 1,000 units). V3, V4 and V4.1 vectors are 80; "V4 Styles" vectors are 50.
export const VECTOR_PRICE = 80;
export const STYLES_VECTOR_PRICE = 50;

export const pricePerImage = (model) => (model.includes("styles") ? STYLES_VECTOR_PRICE : VECTOR_PRICE);

export const spentOf = (ledger) => ledger.requests.reduce((sum, r) => sum + r.units, 0);

// Returns the reason a request must be refused, or null when it fits.
export const refusal = ({ spent, estimate, balance }) => {
    if (spent + estimate > CAP) {
        return `refused: ${spent} spent + ${estimate} estimated would pass the cap of ${CAP} units`;
    }
    if (balance !== undefined && estimate > balance) {
        return `refused: ${estimate} estimated is more than the ${balance} units left on the account`;
    }
    return null;
};

// The next n file names for a direction, continuing after the highest existing number.
export const nextFileNames = (existing, direction, n) => {
    const pattern = new RegExp(`^${direction}-(\\d+)\\.svg$`);
    const highest = existing.reduce((max, name) => {
        const match = pattern.exec(name);
        return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return Array.from({ length: n }, (_, i) => `${direction}-${String(highest + i + 1).padStart(2, "0")}.svg`);
};

// Balance lag or a free re-roll could make the difference zero or negative; the
// estimate is the safer number to count then.
export const unitsCharged = (before, after, estimate) =>
    before !== undefined && after !== undefined && before - after > 0 ? before - after : estimate;

export const hexToRgb = (hex) => {
    const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) {
        throw new Error(`not a #RRGGBB colour: ${hex}`);
    }
    const value = parseInt(match[1], 16);
    return [value >> 16, (value >> 8) & 0xff, value & 0xff];
};

const readLedger = () => {
    const path = join(REPO_ROOT, LEDGER);
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { cap: CAP, requests: [] };
};

const writeLedger = (ledger) => {
    mkdirSync(join(REPO_ROOT, CONCEPTS), { recursive: true });
    writeFileSync(join(REPO_ROOT, LEDGER), `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
};

const fail = (message) => {
    console.error(message);
    process.exit(1);
};

const request = async (token, path, init = {}) => {
    const response = await fetch(`${API}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!response.ok) {
        // The body is Recraft's error message; it never echoes the token.
        fail(`Recraft ${path} answered ${response.status}: ${await response.text()}`);
    }
    return response.json();
};

const balanceOf = async (token) => (await request(token, "/users/me")).credits;

const generate = async (args) => {
    const token = process.env.RECRAFT_API_TOKEN;
    if (!token) {
        fail("RECRAFT_API_TOKEN is not set");
    }
    const { round, direction, prompt, style } = args;
    if (!/^[a-z0-9-]+$/.test(round ?? "") || !/^[a-z0-9]+$/.test(direction ?? "") || !prompt) {
        fail("generate needs --round <a-z0-9->, --direction <a-z0-9> and --prompt");
    }
    const n = Number(args.n ?? 1);
    if (!Number.isInteger(n) || n < 1 || n > 6) {
        fail("--n must be 1 to 6");
    }
    const model = args.model ?? DEFAULT_MODEL;
    if (!model.endsWith("_vector") && !style) {
        fail(`${model} is not a vector model: use a *_vector model or a vector --style`);
    }

    const ledger = readLedger();
    const estimate = n * pricePerImage(model);
    const before = await balanceOf(token);
    const refused = refusal({ spent: spentOf(ledger), estimate, balance: before });
    if (refused) {
        fail(refused);
    }

    const body = { prompt, n, model, size: "1024x1024", response_format: "url" };
    if (style) {
        body.style = style;
    }
    const colors = args.colors?.split(",").map(hexToRgb);
    if (colors) {
        body.controls = { colors: colors.map((rgb) => ({ rgb })) };
    }
    const result = await request(token, "/images/generations", { method: "POST", body: JSON.stringify(body) });
    const after = await balanceOf(token);
    const units = unitsCharged(before, after, estimate);

    const folder = join(REPO_ROOT, CONCEPTS, round);
    mkdirSync(folder, { recursive: true });
    const names = nextFileNames(readdirSync(folder), direction, result.data.length);
    const files = [];
    for (const [i, image] of result.data.entries()) {
        const svg = await (await fetch(image.url)).text();
        if (!svg.includes("<svg")) {
            console.error(`image ${i + 1} is not an SVG; skipped`);
            continue;
        }
        writeFileSync(join(folder, names[i]), svg, "utf8");
        files.push(`${CONCEPTS}/${round}/${names[i]}`);
    }
    ledger.requests.push({
        at: new Date().toISOString(),
        round,
        direction,
        model,
        style: style ?? null,
        prompt,
        ...(args.colors ? { colors: args.colors } : {}),
        n,
        units,
        files,
    });
    writeLedger(ledger);
    console.log(`${files.join("\n")}\n${units} units; ${spentOf(ledger)} of ${CAP} spent`);
};

const check = () => {
    const ledger = readLedger();
    const problems = [];
    const spent = spentOf(ledger);
    if (spent > CAP) {
        problems.push(`spent ${spent} is over the cap of ${CAP}`);
    }
    for (const file of ledger.requests.flatMap((r) => r.files)) {
        if (!existsSync(join(REPO_ROOT, file))) {
            problems.push(`missing ${file}`);
        }
    }
    if (problems.length > 0) {
        fail(problems.join("\n"));
    }
    console.log(`ledger ok: ${spent} of ${CAP} units`);
};

const main = async () => {
    const { positionals, values } = parseArgs({
        allowPositionals: true,
        options: {
            round: { type: "string" },
            direction: { type: "string" },
            n: { type: "string" },
            prompt: { type: "string" },
            style: { type: "string" },
            model: { type: "string" },
            colors: { type: "string" },
        },
    });
    switch (positionals[0]) {
        case "generate":
            return generate(values);
        case "spent":
            return console.log(`${spentOf(readLedger())} of ${CAP} units spent`);
        case "check":
            return check();
        default:
            fail("usage: node scripts/recraft.mjs generate|spent|check");
    }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
}
