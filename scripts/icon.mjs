// Generates the app icon, the themed icon, the notification icon and a preview SVG:
//
//   node scripts/icon.mjs
//
// The art is a list of shapes in a 108 canvas (the adaptive icon's size). The colour icon
// paints the shell solid and lays the plates on top, so the lines between them are
// parchment; the single-colour icons cut the shell open instead, so the same lines show as
// gaps. Holes (the eye, the smile, the slit under the shell) are wound against their solid
// and filled nonZero, so they never sit where two solids overlap. Edit the shapes here and
// re-run; icon.test.mjs fails if the committed files and this script disagree.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, writeRepoFile } from "./repo-files.mjs";

export const CANVAS = 108;
export const CENTRE = 54;
export const SAFE_RADIUS = 33;
export const GAP = 1.4;

const EVERGREEN = "#2F5D50";
const SHELL = "#8A5A1F";
const PARCHMENT = "#F7F4EE";
const WHITE = "#FFFFFFFF";

const num = (n) => String(Math.round(n * 100) / 100);
const pt = ([x, y]) => `${num(x)},${num(y)}`;

const signedArea = (points) =>
    points.reduce((sum, [x, y], i) => {
        const [nx, ny] = points[(i + 1) % points.length];
        return sum + x * ny - nx * y;
    }, 0) / 2;

// Solids run clockwise on screen, holes anticlockwise.
const wound = (points, sign) => (Math.sign(signedArea(points)) === sign ? points : [...points].reverse());

export const isHole = (points) => signedArea(points) < 0;

const polygonPath = (points) => `M${points.map(pt).join("L")}Z`;

const shape = (points, sign = 1) => {
    const p = wound(points, sign);
    return { d: polygonPath(p), points: p };
};

const ellipsePoints = (cx, cy, rx, ry, rotation = 0, steps = 72) =>
    Array.from({ length: steps }, (_, i) => {
        const a = (2 * Math.PI * i) / steps;
        const x = rx * Math.cos(a);
        const y = ry * Math.sin(a);
        const c = Math.cos(rotation);
        const s = Math.sin(rotation);
        return [cx + x * c - y * s, cy + x * s + y * c];
    });

const centroid = (points) => [
    points.reduce((s, [x]) => s + x, 0) / points.length,
    points.reduce((s, [, y]) => s + y, 0) / points.length,
];

// Keeps the part of a polygon on `ref`'s side of the line through a and b, `off` in from it.
const halfPlane = (points, [ax, ay], [bx, by], ref, off = 0) => {
    const length = Math.hypot(bx - ax, by - ay);
    const nx = -(by - ay) / length;
    const ny = (bx - ax) / length;
    const side = Math.sign(nx * (ref[0] - ax) + ny * (ref[1] - ay));
    const dist = ([x, y]) => side * (nx * (x - ax) + ny * (y - ay)) - off;
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

const edges = (points) => points.map((p, i) => [p, points[(i + 1) % points.length]]);

const dedupe = (points) =>
    points.filter((p, i) => {
        const q = points[(i + 1) % points.length];
        return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05;
    });

// Both arguments convex.
const intersect = (points, convex) => {
    const middle = centroid(convex);
    return edges(convex).reduce((kept, [a, b]) => halfPlane(kept, a, b, middle), points);
};

const inset = (convex, r) => {
    const middle = centroid(convex);
    return dedupe(edges(convex).reduce((kept, [a, b]) => halfPlane(kept, a, b, middle, r), convex));
};

// Grows a convex polygon by r, with round corners.
const outset = (convex, r) => {
    const middle = centroid(convex);
    const normal = ([ax, ay], [bx, by]) => {
        const length = Math.hypot(bx - ax, by - ay);
        let n = [-(by - ay) / length, (bx - ax) / length];
        if (n[0] * (middle[0] - ax) + n[1] * (middle[1] - ay) > 0) {
            n = [-n[0], -n[1]];
        }
        return Math.atan2(n[1], n[0]);
    };
    return convex.flatMap((v, i) => {
        const before = convex[(i - 1 + convex.length) % convex.length];
        const after = convex[(i + 1) % convex.length];
        const from = normal(before, v);
        let turn = normal(v, after) - from;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        const steps = Math.ceil(Math.abs(turn) / (Math.PI / 10));
        if (steps <= 1) {
            const a = from + turn / 2;
            const reach = r / Math.cos(turn / 2);
            return [[v[0] + reach * Math.cos(a), v[1] + reach * Math.sin(a)]];
        }
        return Array.from({ length: steps + 1 }, (_, k) => {
            const a = from + (turn * k) / steps;
            return [v[0] + r * Math.cos(a), v[1] + r * Math.sin(a)];
        });
    });
};

const rounded = (convex, r) => outset(inset(convex, r), r);

// A path of lines ([x, y]) and cubic curves ([control, control, end]), with its outline sampled.
const outline = (start, ...segments) => {
    let d = `M${pt(start)}`;
    const points = [start];
    let current = start;
    for (const segment of segments) {
        if (typeof segment[0] === "number") {
            d += `L${pt(segment)}`;
            points.push(segment);
            current = segment;
            continue;
        }
        const [c1, c2, end] = segment;
        d += `C${pt(c1)} ${pt(c2)} ${pt(end)}`;
        for (let i = 1; i <= 8; i++) {
            const t = i / 8;
            const u = 1 - t;
            const f = (k) => u * u * u * current[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * end[k];
            points.push([f(0), f(1)]);
        }
        current = end;
    }
    d += "Z";
    return { d, points: points.slice(0, -1) };
};

// The crescent between two curves sharing their ends, bulging by `upper` and `lower`.
const crescent = ([ax, ay], [bx, by], upper, lower) => {
    const steps = 12;
    const along = (bulge) =>
        Array.from({ length: steps + 1 }, (_, i) => {
            const t = i / steps;
            return [ax + (bx - ax) * t, ay + (by - ay) * t + bulge * 4 * t * (1 - t)];
        });
    return [...along(upper), ...along(lower).reverse().slice(1, -1)];
};

const roundRect = (x, y, w, h, r) =>
    rounded(
        [
            [x, y],
            [x + w, y],
            [x + w, y + h],
            [x, y + h],
        ],
        r,
    );

// The shell is the top of an ellipse cut off underneath by a circle, so its underside
// curves up at the ends. The rim's underside is flatter than the plates', so in colour a
// slit opens between rim and body in the middle only.
const shellShape = (rx, ry, below, radius) =>
    intersect(ellipsePoints(49, 57, rx, ry), ellipsePoints(49, below - radius, radius, radius, 0, 240));

// The bottom of a circle through (cx, bottom), from x0 to x1.
const underside = (cx, bottom, radius, x0, x1, steps) =>
    Array.from({ length: steps + 1 }, (_, i) => {
        const x = x0 + ((x1 - x0) * i) / steps;
        return [x, bottom - radius + Math.sqrt(radius * radius - (x - cx) ** 2)];
    });

const buildParts = () => {
    const rim = rounded(shellShape(16.8, 18.4, 57, 60), 1);
    const area = shellShape(15.2, 16.9, 55.9, 33);
    const left = [[44.4, 46.2], [41.4, 40.4]];
    const leftDown = [[44.4, 46.2], [40, 57]];
    const right = [[55.4, 46.2], [58.4, 40.4]];
    const rightDown = [[55.4, 46.2], [60.4, 57]];
    const across = [[40, 46.2], [60, 46.2]];
    const cut = (points, [a, b], ref) => halfPlane(points, a, b, ref, GAP / 2);
    const plates = [
        ["plate-top", (p) => cut(cut(cut(p, across, [50, 40]), left, [50, 40]), right, [50, 40])],
        ["plate-middle", (p) => cut(cut(cut(p, across, [50, 52]), leftDown, [50, 52]), rightDown, [50, 52])],
        ["plate-left", (p) => cut(cut(p, left, [35, 50]), leftDown, [35, 50])],
        ["plate-right", (p) => cut(cut(p, right, [64, 50]), rightDown, [64, 50])],
    ].map(([name, make]) => ({ name, role: "shell", ...shape(rounded(make(area), 0.6)) }));

    const body = outline(
        [29.6, 56.3],
        ...underside(49, 58, 29.9, 33.2, 64.8, 16),
        [65.4, 52],
        [64.7, 50],
        [[68.2, 49.2], [70.2, 44], [74.6, 43.5]],
        [[78.2, 43.1], [79.9, 45.2], [79.8, 47.3]],
        [[79.7, 49.6], [77.8, 50.9], [75.5, 51.4]],
        [[72, 53.2], [69, 55.8], [66.6, 57.8]],
        [[68.5, 59.5], [69.8, 62], [70.3, 64.6]],
        [[70.6, 65.8], [70, 66.3], [69, 66.3]],
        [66.3, 66.3],
        [[65.3, 66.3], [64.8, 65.5], [65.1, 64.6]],
        [62.6, 61.9],
        [60.6, 64.6],
        [[60.9, 65.6], [60.3, 66.3], [59.4, 66.3]],
        [56.8, 66.3],
        [[55.8, 66.3], [55.3, 65.4], [55.8, 64.6]],
        [57.8, 60.6],
        [[53, 61.4], [45, 61.4], [40.5, 60.6]],
        [37.5, 64.7],
        [[37.8, 65.7], [37.2, 66.3], [36.3, 66.3]],
        [32.7, 66.3],
        [[31.6, 66.3], [31, 65.4], [31.6, 64.5]],
        [35, 59.3],
        [[33, 58.4], [31.5, 57.9], [30, 57.6]],
        [[29.2, 57.5], [28.9, 56.7], [29.6, 56.3]],
    );
    const eye = shape(ellipsePoints(75.4, 46.9, 1.05, 1.05, 0, 24), -1);
    const smile = shape(crescent([75.1, 49.2], [78, 49.2], 0.65, 1.3), -1);

    const holes = [eye.points, smile.points];

    return [
        { name: "rim", role: "body", colourOnly: true, ...shape(rim) },
        ...plates,
        { name: "body", role: "body", d: body.d + eye.d + smile.d, points: body.points, holes },
        { name: "ground-long", role: "body", ...shape(roundRect(26.3, 67.8, 44.7, 1.8, 0.85)) },
        { name: "ground-short", role: "body", ...shape(roundRect(73.1, 67.8, 8.8, 1.8, 0.85)) },
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

export const singleColourParts = parts.filter((p) => !p.colourOnly);

// The group maps a point to p * scale + translate.
export const notificationTransform = () => {
    const { minX, maxX, minY, maxY } = bounds(singleColourParts);
    const scale = NOTIFICATION_ART / Math.max(maxX - minX, maxY - minY);
    const middle = NOTIFICATION_SIZE / 2;
    return {
        scale,
        translateX: middle - (scale * (minX + maxX)) / 2,
        translateY: middle - (scale * (minY + maxY)) / 2,
    };
};

const colourOf = { shell: SHELL, body: PARCHMENT };

const vector = (size, inner) =>
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n` +
    `    android:width="${size}dp"\n` +
    `    android:height="${size}dp"\n` +
    `    android:viewportWidth="${size}"\n` +
    `    android:viewportHeight="${size}">\n` +
    inner +
    `</vector>\n`;

const androidPath = (d, colour, indent) =>
    `${indent}<path\n` +
    `${indent}    android:fillColor="${colour}"\n` +
    `${indent}    android:pathData="${d}" />\n`;

const singleColour = (indent) => singleColourParts.map((p) => androidPath(p.d, WHITE, indent)).join("");

export const launcherForeground = () =>
    vector(CANVAS, parts.map((p) => androidPath(p.d, colourOf[p.role], "    ")).join(""));

export const launcherMonochrome = () => vector(CANVAS, singleColour("    "));

export const notification = () => {
    const { scale, translateX, translateY } = notificationTransform();
    return vector(
        NOTIFICATION_SIZE,
        `    <group\n` +
            `        android:scaleX="${num(scale)}"\n` +
            `        android:scaleY="${num(scale)}"\n` +
            `        android:translateX="${num(translateX)}"\n` +
            `        android:translateY="${num(translateY)}">\n` +
            singleColour("        ") +
            `    </group>\n`,
    );
};

export const backgroundColour = () =>
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<resources>\n` +
    `    <color name="ic_launcher_background">${EVERGREEN}</color>\n` +
    `</resources>\n`;

export const previewSvg = () =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}">\n` +
    `  <rect width="${CANVAS}" height="${CANVAS}" fill="${EVERGREEN}" />\n` +
    parts.map((p) => `  <path fill="${colourOf[p.role]}" d="${p.d}" />\n`).join("") +
    `</svg>\n`;

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
