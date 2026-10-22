import assert from "node:assert/strict";
import { test } from "node:test";
import {
    CENTRE,
    GAP,
    SAFE_RADIUS,
    SOURCE,
    flatten,
    inLauncher,
    inNotification,
    notificationTransform,
    outputs,
    readSource,
} from "./icon.mjs";
import { readRepoFile } from "./repo-files.mjs";

const { background, parts } = readSource(readRepoFile(SOURCE));
const launcher = parts.filter(inLauncher);
const notificationSet = parts.filter(inNotification);

const contoursOf = (set) => set.flatMap((part) => part.contours.map((points) => ({ part, points })));

test("the committed icon files match the generator", () => {
    for (const { path, text } of outputs()) {
        assert.equal(readRepoFile(path), text, `${path} is out of date: run node scripts/icon.mjs`);
    }
});

test("every launcher contour point stays inside the adaptive icon's safe circle", () => {
    for (const { part, points } of contoursOf(launcher)) {
        for (const [x, y] of points) {
            const distance = Math.hypot(x - CENTRE, y - CENTRE);
            assert.ok(distance <= SAFE_RADIUS, `${part.id} at ${x},${y} is ${distance} from the centre`);
        }
    }
});

test("the launcher art fills most of the safe circle", () => {
    const points = contoursOf(launcher).flatMap((c) => c.points);
    const width = Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x));
    const height = Math.max(...points.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y));
    assert.ok(Math.max(width, height) >= 52, `the art is only ${width} by ${height}`);
});

test("the notification art stays inside its 20 by 20 box", () => {
    const { scale, translateX, translateY } = notificationTransform();
    for (const { part, points } of contoursOf(notificationSet)) {
        for (const [x, y] of points) {
            const mapped = [x * scale + translateX, y * scale + translateY];
            for (const v of mapped) {
                assert.ok(v >= 2 - 1e-9 && v <= 22 + 1e-9, `${part.id} maps to ${mapped}`);
            }
        }
    }
});

test("the gaps are still a unit wide in the notification icon", () => {
    assert.ok(GAP * notificationTransform().scale >= 1);
});

const distanceToSegment = ([px, py], [ax, ay], [bx, by]) => {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const distanceBetween = (a, b) => {
    const oneWay = (from, to) =>
        Math.min(...from.points.flatMap((p) => to.points.map((q, i) => distanceToSegment(p, q, to.points[(i + 1) % to.points.length]))));
    return Math.min(oneWay(a, b), oneWay(b, a));
};

test("no two contours are closer than a gap, in the launcher set or the notification set", () => {
    for (const [name, set] of [["launcher", launcher], ["notification", notificationSet]]) {
        const contours = contoursOf(set);
        contours.forEach((a, i) => {
            contours.slice(i + 1).forEach((b) => {
                const distance = distanceBetween(a, b);
                assert.ok(distance >= GAP - 0.05, `${a.part.id} and ${b.part.id} are ${distance} apart in the ${name} set`);
            });
        });
    }
});

test("the themed and notification icons are single-colour", () => {
    const files = outputs().filter(({ path }) => /ic_launcher_monochrome|ic_notification/.test(path));
    assert.equal(files.length, 2);
    for (const { text } of files) {
        const colours = new Set([...text.matchAll(/fillColor="([^"]+)"/g)].map((m) => m[1]));
        assert.deepEqual([...colours], ["#FFFFFFFF"]);
    }
});

const inside = ([px, py], points) => {
    let in_ = false;
    points.forEach(([ax, ay], i) => {
        const [bx, by] = points[(i + 1) % points.length];
        if (ay > py !== by > py && px < ax + ((py - ay) / (by - ay)) * (bx - ax)) {
            in_ = !in_;
        }
    });
    return in_;
};

test("gaps are holes, not paint: nothing is the background colour or sits inside another shape", () => {
    for (const part of launcher) {
        assert.notEqual(part.fill.toUpperCase(), background.toUpperCase(), `${part.id} is painted in the background colour`);
    }
    // Both sets: a notification-only part could otherwise cover parts the launcher keeps.
    for (const [name, set] of [["launcher", launcher], ["notification", notificationSet]]) {
        const contours = contoursOf(set);
        for (const a of contours) {
            for (const b of contours) {
                if (a === b || (a.part === b.part && a.part.evenOdd)) {
                    continue;
                }
                assert.ok(!inside(a.points[0], b.points), `${a.part.id} starts inside ${b.part.id} in the ${name} set`);
            }
        }
    }
});

const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${inner}</svg>`;
const rect = '<rect id="background" width="108" height="108" fill="#2F5D50" />';

test("readSource names an unsupported path command and an unknown element", () => {
    assert.throws(
        () => readSource(svg(`${rect}<path id="curl" fill="#E7BE8A" d="M10 10A5 5 0 0 1 20 20Z" />`)),
        /command A in curl/,
    );
    assert.throws(() => readSource(svg(`${rect}<circle cx="5" cy="5" r="2" />`)), /<circle>/);
    const ok = readSource(svg(`${rect}<!-- fine --><path id="a" fill="#E7BE8A" d="M10 10H20V20Z" />`));
    assert.equal(ok.background, "#2F5D50");
    assert.equal(ok.parts[0].id, "a");
});

test("flatten gives a square's corners, absolute or relative, and a cubic's end points", () => {
    const square = [[[10, 10], [20, 10], [20, 20], [10, 20]]];
    assert.deepEqual(flatten("M10 10H20V20H10Z"), square);
    assert.deepEqual(flatten("m10 10h10v10h-10z"), square);
    assert.deepEqual(flatten("M10,10 20,10 20,20 10,20Z"), square);
    const [curve] = flatten("M0 0C0 10 10 10 10 0");
    assert.equal(curve.length, 17);
    assert.deepEqual(curve[0], [0, 0]);
    assert.deepEqual(curve[16], [10, 0]);
    const [quad] = flatten("M0 0q5 10 10 0");
    assert.deepEqual(quad[16], [10, 0]);
});
