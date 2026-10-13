// Generates the app icon, the themed icon, the notification icon and a preview SVG:
//
//   node scripts/icon.mjs
//
// The art is a list of flat shapes in a 108 canvas (the adaptive icon's size). Every
// visible gap is an absence of paint, never paint in the background colour, so the same
// shapes render as the colour icon, the single-colour themed icon and the white
// notification icon. Edit the shapes here and re-run; icon.test.mjs fails if the committed
// files and this script disagree.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, writeRepoFile } from "./repo-files.mjs";

export const CANVAS = 108;
export const CENTRE = 54;
export const SAFE_RADIUS = 33;
export const GAP = 3.4;

const EVERGREEN = "#2F5D50";
const SHELL = "#E7BE8A";
const PARCHMENT = "#F7F4EE";
const GROUND = "#99F7F4EE";
const WHITE = "#FFFFFFFF";

const num = (n) => String(Math.round(n * 100) / 100);
const pt = (x, y) => `${num(x)},${num(y)}`;

const arcPoints = (cx, cy, rx, ry, from, to, steps) =>
    Array.from({ length: steps + 1 }, (_, i) => {
        const a = from + ((to - from) * i) / steps;
        return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
    });

const polygonPath = (points) => `M${points.map(([x, y]) => pt(x, y)).join("L")}Z`;

export const ellipse = (cx, cy, rx, ry) => ({
    d: `M${pt(cx - rx, cy)}A${num(rx)},${num(ry)} 0 1 1 ${pt(cx + rx, cy)}A${num(rx)},${num(ry)} 0 1 1 ${pt(cx - rx, cy)}Z`,
    points: arcPoints(cx, cy, rx, ry, 0, 2 * Math.PI, 24).slice(0, -1),
});

export const circle = (cx, cy, r) => ellipse(cx, cy, r, r);

export const roundRect = (x, y, w, h, r) => {
    const right = x + w;
    const bottom = y + h;
    const d =
        `M${pt(x + r, y)}H${num(right - r)}A${num(r)},${num(r)} 0 0 1 ${pt(right, y + r)}` +
        `V${num(bottom - r)}A${num(r)},${num(r)} 0 0 1 ${pt(right - r, bottom)}` +
        `H${num(x + r)}A${num(r)},${num(r)} 0 0 1 ${pt(x, bottom - r)}` +
        `V${num(y + r)}A${num(r)},${num(r)} 0 0 1 ${pt(x + r, y)}Z`;
    const half = Math.PI / 2;
    const points = [
        ...arcPoints(right - r, y + r, r, r, -half, 0, 4),
        ...arcPoints(right - r, bottom - r, r, r, 0, half, 4),
        ...arcPoints(x + r, bottom - r, r, r, half, 2 * half, 4),
        ...arcPoints(x + r, y + r, r, r, 2 * half, 3 * half, 4),
    ];
    return { d, points };
};

export const polygon = (points) => ({ d: polygonPath(points), points });

// The upper half of an ellipse, flat underneath, as a polygon so it can be cut into plates.
export const dome = (cx, cy, rx, ry) =>
    arcPoints(cx, cy, rx, ry, Math.PI, 2 * Math.PI, 36);

// Keeps the part of a convex polygon on the positive side of a line, offset by `off`.
const clip = (points, [ax, ay], [bx, by], side, off) => {
    const length = Math.hypot(bx - ax, by - ay);
    const nx = (-(by - ay) / length) * side;
    const ny = ((bx - ax) / length) * side;
    const dist = ([x, y]) => nx * (x - ax) + ny * (y - ay) - off;
    const kept = [];
    points.forEach((p, i) => {
        const q = points[(i + 1) % points.length];
        const dp = dist(p);
        const dq = dist(q);
        if (dp >= 0) {
            kept.push(p);
        }
        if (dp >= 0 !== dq >= 0) {
            const t = dp / (dp - dq);
            kept.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
        }
    });
    return kept;
};

const plate = (shape, cuts) =>
    cuts.reduce((points, [a, b, side]) => clip(points, a, b, side, GAP / 2), shape);

// The tortoise walks right. Heights are shifted so the art sits at the canvas centre.
const LIFT = 9;
const y = (v) => v - LIFT;

const buildParts = () => {
    const shell = dome(47, y(64), 23, 24);
    const left = [[35, y(40)], [31, y(66)]];
    const right = [[59, y(40)], [63, y(66)]];
    const acrossMiddle = [[20, y(50)], [80, y(50)]];
    const acrossSides = [[20, y(57)], [80, y(57)]];
    const plates = [
        ["plate-top", [[...left, -1], [...right, 1], [...acrossMiddle, -1]]],
        ["plate-middle", [[...left, -1], [...right, 1], [...acrossMiddle, 1]]],
        ["plate-left-upper", [[...left, 1], [...acrossSides, -1]]],
        ["plate-left-lower", [[...left, 1], [...acrossSides, 1]]],
        ["plate-right-upper", [[...right, -1], [...acrossSides, -1]]],
        ["plate-right-lower", [[...right, -1], [...acrossSides, 1]]],
    ].map(([name, cuts]) => ({
        name,
        role: "shell",
        ...polygon(plate(shell, cuts)),
    }));

    const head = ellipse(79.5, y(56), 6.5, 6);
    const eye = circle(81.5, y(54.5), 1.7);
    const legTop = y(64) + GAP;
    const leg = (name, x) => ({ name, role: "body", ...roundRect(x, legTop, 7, 9.5, 3) });
    return [
        ...plates,
        { name: "neck", role: "body", ...roundRect(75.5, y(58), 8, 7, 3.5) },
        { name: "head", role: "body", d: head.d + eye.d, points: head.points, evenOdd: true },
        { name: "tail", role: "body", ...polygon([[26, legTop], [22.5, legTop + 1.5], [26, legTop + 5.5]]) },
        leg("leg-rear-far", 29),
        leg("leg-rear-near", 40),
        leg("leg-front-near", 56),
        leg("leg-front-far", 67),
        ...[0, 1, 2].map((i) => ({
            name: `ground-${i + 1}`,
            role: "ground",
            ...roundRect(30 + i * 17, y(81), 13, 4, 2),
        })),
    ];
};

export const parts = buildParts();

const bounds = (list) => {
    const xs = list.flatMap((p) => p.points.map(([px]) => px));
    const ys = list.flatMap((p) => p.points.map(([, py]) => py));
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};

export const artBounds = () => bounds(parts);

const NOTIFICATION_SIZE = 24;
const NOTIFICATION_ART = 20;

// The group maps a point to p * scale + translate. The ground blanks are left out.
export const notificationTransform = () => {
    const { minX, maxX, minY, maxY } = bounds(parts.filter((p) => p.role !== "ground"));
    const scale = NOTIFICATION_ART / Math.max(maxX - minX, maxY - minY);
    const middle = NOTIFICATION_SIZE / 2;
    return {
        scale,
        translateX: middle - (scale * (minX + maxX)) / 2,
        translateY: middle - (scale * (minY + maxY)) / 2,
    };
};

const colourOf = { shell: SHELL, body: PARCHMENT, ground: GROUND };

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

export const launcherForeground = () =>
    vector(CANVAS, parts.map((p) => androidPath(p, colourOf[p.role], "    ")).join(""));

export const launcherMonochrome = () =>
    vector(CANVAS, parts.map((p) => androidPath(p, WHITE, "    ")).join(""));

export const notification = () => {
    const { scale, translateX, translateY } = notificationTransform();
    const art = parts.filter((p) => p.role !== "ground");
    return vector(
        NOTIFICATION_SIZE,
        `    <group\n` +
            `        android:scaleX="${num(scale)}"\n` +
            `        android:scaleY="${num(scale)}"\n` +
            `        android:translateX="${num(translateX)}"\n` +
            `        android:translateY="${num(translateY)}">\n` +
            art.map((p) => androidPath(p, WHITE, "        ")).join("") +
            `    </group>\n`,
    );
};

export const backgroundColour = () =>
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<resources>\n` +
    `    <color name="ic_launcher_background">${EVERGREEN}</color>\n` +
    `</resources>\n`;

export const previewSvg = () => {
    const svgPath = (p) => {
        const colour = colourOf[p.role];
        const fill = p.role === "ground" ? `${colour.slice(3)}" fill-opacity="0.6` : colour;
        return `  <path fill="${fill}"${p.evenOdd ? ' fill-rule="evenodd"' : ""} d="${p.d}" />\n`;
    };
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}">\n` +
        `  <rect width="${CANVAS}" height="${CANVAS}" fill="${EVERGREEN}" />\n` +
        parts.map(svgPath).join("") +
        `</svg>\n`
    );
};

export const outputs = () => [
    { path: "app/src/main/res/drawable/ic_launcher_foreground.xml", text: launcherForeground() },
    { path: "app/src/main/res/drawable/ic_launcher_monochrome.xml", text: launcherMonochrome() },
    { path: "app/src/main/res/drawable/ic_notification.xml", text: notification() },
    { path: "app/src/main/res/values/ic_launcher_background.xml", text: backgroundColour() },
    { path: "docs/icon.svg", text: previewSvg() },
];

const main = () => {
    for (const { path, text } of outputs()) {
        mkdirSync(dirname(join(REPO_ROOT, path)), { recursive: true });
        writeRepoFile(path, text);
    }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
