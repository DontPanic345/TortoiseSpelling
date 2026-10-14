import assert from "node:assert/strict";
import { test } from "node:test";
import {
    CENTRE,
    GAP,
    SAFE_RADIUS,
    artBounds,
    isHole,
    launcherMonochrome,
    notification,
    notificationTransform,
    outputs,
    parts,
    singleColourParts,
} from "./icon.mjs";
import { readRepoFile } from "./repo-files.mjs";

test("the committed icon files match the generator", () => {
    for (const { path, text } of outputs()) {
        assert.equal(readRepoFile(path), text, `${path} is out of date: run node scripts/icon.mjs`);
    }
});

test("every launcher shape stays inside the adaptive icon's safe circle", () => {
    for (const part of parts) {
        for (const [x, y] of part.points) {
            const distance = Math.hypot(x - CENTRE, y - CENTRE);
            assert.ok(distance <= SAFE_RADIUS, `${part.name} at ${x},${y} is ${distance} from the centre`);
        }
    }
});

test("the art fills most of the safe circle's width", () => {
    const { minX, maxX } = artBounds();
    assert.ok(maxX - minX >= 52, `the art is only ${maxX - minX} wide`);
});

test("the notification art stays inside its 20 by 20 box", () => {
    const { scale, translateX, translateY } = notificationTransform();
    for (const part of singleColourParts) {
        for (const [x, y] of part.points) {
            const mapped = [x * scale + translateX, y * scale + translateY];
            for (const v of mapped) {
                assert.ok(v >= 2 - 1e-9 && v <= 22 + 1e-9, `${part.name} maps to ${mapped}`);
            }
        }
    }
});

test("the gaps are at least a pixel wide in the notification icon at xhdpi", () => {
    assert.ok(GAP * notificationTransform().scale * 2 >= 1);
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

test("shell plates are a full gap apart, and so are the plates from the body", () => {
    const shell = singleColourParts.filter((p) => p.role === "shell");
    const body = singleColourParts.filter((p) => p.role === "body");
    const pairs = [];
    shell.forEach((a, i) => {
        shell.slice(i + 1).forEach((b) => pairs.push([a, b]));
        body.forEach((b) => pairs.push([a, b]));
    });
    for (const [a, b] of pairs) {
        const distance = distanceBetween(a, b);
        assert.ok(distance >= GAP - 0.05, `${a.name} and ${b.name} are ${distance} apart`);
    }
});

test("the themed and notification icons are single-colour", () => {
    for (const xml of [launcherMonochrome(), notification()]) {
        const colours = new Set([...xml.matchAll(/fillColor="([^"]+)"/g)].map((m) => m[1]));
        assert.deepEqual([...colours], ["#FFFFFFFF"]);
    }
});

const inside = ([x, y], polygon) =>
    polygon.reduce((inPolygon, [ax, ay], i) => {
        const [bx, by] = polygon[(i + 1) % polygon.length];
        return ay > y !== by > y && x < ax + ((y - ay) * (bx - ax)) / (by - ay) ? !inPolygon : inPolygon;
    }, false);

test("the eye and smile are holes in the body and nothing else", () => {
    const body = parts.find((p) => p.name === "body");
    assert.equal(body.holes.length, 2);
    for (const hole of body.holes) {
        assert.ok(isHole(hole));
        assert.ok(!isHole(body.points));
        for (const point of hole) {
            assert.ok(inside(point, body.points), `${point} is outside the body`);
            for (const other of parts.filter((p) => p !== body)) {
                assert.ok(!inside(point, other.points), `${point} is also inside ${other.name}`);
            }
        }
    }
});
