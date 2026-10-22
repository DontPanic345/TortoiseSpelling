// Generates the app icon, the themed icon, the notification icon and a preview SVG from one
// plain SVG source:
//
//   node scripts/icon.mjs
//
// Edit scripts/icon-source.svg and re-run. The source is a 108 canvas (the adaptive icon's
// size) of filled paths. Every visible gap is an absence of paint, never paint in the
// background colour, so the same paths render as the colour icon, the single-colour themed
// icon and the white notification icon. icon.test.mjs fails if the committed files and this
// script disagree, or if the art breaks the rules there.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, readRepoFile, writeRepoFile } from "./repo-files.mjs";

export const CANVAS = 108;
export const CENTRE = 54;
export const SAFE_RADIUS = 33;
export const GAP = 3.4; // keep it so that GAP × notification scale ≥ 1
export const SOURCE = "scripts/icon-source.svg";

const WHITE = "#FFFFFFFF";
const CURVE_STEPS = 16;
const ARGUMENTS = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, Z: 0 };

const num = (n) => String(Math.round(n * 100) / 100);

// One point list per subpath. Each C and Q is sampled at 16 points, the last its end point.
export const flatten = (d, id = "path") => {
    const tokens = d.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
    const contours = [];
    let contour = null;
    let x = 0;
    let y = 0;
    let startX = 0;
    let startY = 0;
    let i = 0;
    const begin = (px, py) => {
        contour = [[px, py]];
        contours.push(contour);
        startX = px;
        startY = py;
    };
    const lineTo = (px, py) => {
        if (!contour) {
            begin(x, y);
        }
        contour.push([px, py]);
        x = px;
        y = py;
    };
    const sample = (at) => {
        if (!contour) {
            begin(x, y);
        }
        for (let step = 1; step <= CURVE_STEPS; step++) {
            contour.push(at(step / CURVE_STEPS));
        }
        [x, y] = contour[contour.length - 1];
    };
    while (i < tokens.length) {
        const letter = tokens[i++];
        const command = letter.toUpperCase();
        if (!(command in ARGUMENTS) || !/^[A-Za-z]$/.test(letter)) {
            throw new Error(`unsupported path command ${letter} in ${id}`);
        }
        const relative = letter !== command;
        const count = ARGUMENTS[command];
        if (command === "Z") {
            if (contour) {
                x = startX;
                y = startY;
                contour = null;
            }
            continue;
        }
        let first = true;
        do {
            const args = tokens.slice(i, i + count).map(Number);
            if (args.length < count || args.some((a) => Number.isNaN(a))) {
                throw new Error(`${letter} in ${id} needs ${count} numbers`);
            }
            i += count;
            const ox = relative ? x : 0;
            const oy = relative ? y : 0;
            if (command === "M") {
                if (first) {
                    begin(ox + args[0], oy + args[1]);
                    x = ox + args[0];
                    y = oy + args[1];
                } else {
                    lineTo(ox + args[0], oy + args[1]);
                }
            } else if (command === "L") {
                lineTo(ox + args[0], oy + args[1]);
            } else if (command === "H") {
                lineTo(ox + args[0], y);
            } else if (command === "V") {
                lineTo(x, oy + args[0]);
            } else if (command === "C") {
                const [x0, y0] = [x, y];
                const [x1, y1, x2, y2, x3, y3] = args.map((a, k) => a + (k % 2 ? oy : ox));
                sample((t) => {
                    const u = 1 - t;
                    return [
                        u ** 3 * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3,
                        u ** 3 * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3,
                    ];
                });
            } else {
                const [x0, y0] = [x, y];
                const [x1, y1, x2, y2] = args.map((a, k) => a + (k % 2 ? oy : ox));
                sample((t) => {
                    const u = 1 - t;
                    return [u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2];
                });
            }
            first = false;
        } while (i < tokens.length && !/^[A-Za-z]$/.test(tokens[i]));
    }
    return contours;
};

const attributesOf = (text) => {
    const attributes = {};
    for (const [, name, value] of text.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) {
        attributes[name] = value;
    }
    return attributes;
};

const COLOUR = /^#[0-9A-Fa-f]{6}$/;
const PATH_ATTRIBUTES = new Set(["id", "fill", "fill-rule", "data-only", "d"]);

// Reads the source's elements; anything outside the rules throws, naming what broke them.
export const readSource = (text) => {
    const tags = [...text.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "").matchAll(/<(\/?)([^\s>/]+)([^>]*)>/g)];
    let background = null;
    let sawSvg = false;
    let closed = false;
    const parts = [];
    for (const [, closing, name, rest] of tags) {
        if (closing) {
            if (name !== "svg") {
                throw new Error(`unexpected closing tag </${name}>`);
            }
            closed = true;
            continue;
        }
        const attributes = attributesOf(rest);
        const selfClosing = rest.trimEnd().endsWith("/");
        if (name === "svg") {
            if (sawSvg || selfClosing) {
                throw new Error("expected one <svg> with the art inside");
            }
            if (attributes.viewBox !== `0 0 ${CANVAS} ${CANVAS}`) {
                throw new Error(`the svg's viewBox must be 0 0 ${CANVAS} ${CANVAS}`);
            }
            sawSvg = true;
        } else if (!sawSvg || closed) {
            throw new Error(`<${name}> is outside the <svg>`);
        } else if (name === "rect") {
            if (!selfClosing || attributes.id !== "background" || background) {
                throw new Error('expected one self-closing <rect id="background">');
            }
            if (!COLOUR.test(attributes.fill ?? "")) {
                throw new Error("the background rect needs a #RRGGBB fill");
            }
            background = attributes.fill;
        } else if (name === "path") {
            const id = attributes.id;
            if (!id || parts.some((p) => p.id === id)) {
                throw new Error(`a path needs a unique id (${id ?? "missing"})`);
            }
            if (!selfClosing) {
                throw new Error(`path ${id} must be self-closing`);
            }
            for (const key of Object.keys(attributes)) {
                if (!PATH_ATTRIBUTES.has(key)) {
                    throw new Error(`path ${id} has an unsupported attribute ${key}`);
                }
            }
            if (!COLOUR.test(attributes.fill ?? "")) {
                throw new Error(`path ${id} needs a #RRGGBB fill`);
            }
            if (attributes["fill-rule"] !== undefined && attributes["fill-rule"] !== "evenodd") {
                throw new Error(`path ${id} has fill-rule ${attributes["fill-rule"]}; only evenodd is supported`);
            }
            const only = attributes["data-only"] ?? null;
            if (only !== null && only !== "launcher" && only !== "notification") {
                throw new Error(`path ${id} has data-only ${only}; use launcher or notification`);
            }
            if (!attributes.d) {
                throw new Error(`path ${id} has no d`);
            }
            parts.push({
                id,
                fill: attributes.fill,
                evenOdd: attributes["fill-rule"] === "evenodd",
                only,
                d: attributes.d,
                contours: flatten(attributes.d, id),
            });
        } else {
            throw new Error(`unsupported element <${name}>: use only svg, rect and path`);
        }
    }
    if (!sawSvg || !closed) {
        throw new Error("the source has no complete <svg>");
    }
    if (!background) {
        throw new Error('the source needs a <rect id="background">');
    }
    return { background, parts };
};

export const inLauncher = (part) => part.only !== "notification";
export const inNotification = (part) => part.only !== "launcher";

const source = () => readSource(readRepoFile(SOURCE));

const bounds = (list) => {
    const points = list.flatMap((p) => p.contours.flat());
    const xs = points.map(([px]) => px);
    const ys = points.map(([, py]) => py);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};

const NOTIFICATION_SIZE = 24;
const NOTIFICATION_ART = 20;

// The group maps a point to p * scale + translate.
export const notificationTransform = () => {
    const { minX, maxX, minY, maxY } = bounds(source().parts.filter(inNotification));
    const scale = NOTIFICATION_ART / Math.max(maxX - minX, maxY - minY);
    const middle = NOTIFICATION_SIZE / 2;
    return {
        scale,
        translateX: middle - (scale * (minX + maxX)) / 2,
        translateY: middle - (scale * (minY + maxY)) / 2,
    };
};

const vector = (size, inner) =>
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n` +
    `    android:width="${size}dp"\n` +
    `    android:height="${size}dp"\n` +
    `    android:viewportWidth="${size}"\n` +
    `    android:viewportHeight="${size}">\n` +
    inner +
    `</vector>\n`;

const androidPath = (part, colour, indent) =>
    `${indent}<path\n` +
    `${indent}    android:fillColor="${colour}"\n` +
    (part.evenOdd ? `${indent}    android:fillType="evenOdd"\n` : "") +
    `${indent}    android:pathData="${part.d}" />\n`;

const launcherForeground = (parts) =>
    vector(CANVAS, parts.filter(inLauncher).map((p) => androidPath(p, p.fill, "    ")).join(""));

const launcherMonochrome = (parts) =>
    vector(CANVAS, parts.filter(inLauncher).map((p) => androidPath(p, WHITE, "    ")).join(""));

const notification = (parts) => {
    const { scale, translateX, translateY } = notificationTransform();
    return vector(
        NOTIFICATION_SIZE,
        `    <group\n` +
            `        android:scaleX="${num(scale)}"\n` +
            `        android:scaleY="${num(scale)}"\n` +
            `        android:translateX="${num(translateX)}"\n` +
            `        android:translateY="${num(translateY)}">\n` +
            parts.filter(inNotification).map((p) => androidPath(p, WHITE, "        ")).join("") +
            `    </group>\n`,
    );
};

const backgroundColour = (background) =>
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<resources>\n` +
    `    <color name="ic_launcher_background">${background}</color>\n` +
    `</resources>\n`;

// The source minus notification-only parts, comments and data-* attributes.
const previewSvg = (text) =>
    text
        .replace(/[ \t]*<!--[\s\S]*?-->[ \t]*\n?/g, "")
        .replace(/[ \t]*<path\b[^>]*\sdata-only="notification"[^>]*>[ \t]*\n?/g, "")
        .replace(/\sdata-[\w-]+="[^"]*"/g, "");

export const outputs = () => {
    const text = readRepoFile(SOURCE);
    const { background, parts } = readSource(text);
    return [
        { path: "app/src/main/res/drawable/ic_launcher_foreground.xml", text: launcherForeground(parts) },
        { path: "app/src/main/res/drawable/ic_launcher_monochrome.xml", text: launcherMonochrome(parts) },
        { path: "app/src/main/res/drawable/ic_notification.xml", text: notification(parts) },
        { path: "app/src/main/res/values/ic_launcher_background.xml", text: backgroundColour(background) },
        { path: "docs/icon.svg", text: previewSvg(text) },
    ];
};

const main = () => {
    for (const { path, text } of outputs()) {
        mkdirSync(dirname(join(REPO_ROOT, path)), { recursive: true });
        writeRepoFile(path, text);
    }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
