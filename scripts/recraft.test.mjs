import assert from "node:assert/strict";
import { test } from "node:test";
import { CAP, hexToRgb, nextFileNames, pricePerImage, refusal, spentOf, unitsCharged } from "./recraft.mjs";

test("spent is the sum of every request's units", () => {
    assert.equal(spentOf({ cap: CAP, requests: [] }), 0);
    assert.equal(spentOf({ cap: CAP, requests: [{ units: 320 }, { units: 240 }, { units: 5 }] }), 565);
});

test("a request that would pass the cap is refused and one that fits is allowed", () => {
    assert.match(refusal({ spent: 9700, estimate: 320, balance: 5000 }), /cap/);
    assert.equal(refusal({ spent: 9680, estimate: 320, balance: 5000 }), null);
    assert.equal(refusal({ spent: 0, estimate: 320 }), null);
});

test("a request over the reported balance is refused", () => {
    assert.match(refusal({ spent: 0, estimate: 320, balance: 300 }), /left on the account/);
    assert.equal(refusal({ spent: 0, estimate: 320, balance: 320 }), null);
});

test("file names continue after the existing ones for that direction", () => {
    assert.deepEqual(nextFileNames([], "a", 2), ["a-01.svg", "a-02.svg"]);
    assert.deepEqual(
        nextFileNames(["a-01.svg", "a-03.svg", "b-07.svg", "sheet.png", "dropped.json"], "a", 2),
        ["a-04.svg", "a-05.svg"],
    );
    assert.deepEqual(nextFileNames(["a-09.svg"], "a", 2), ["a-10.svg", "a-11.svg"]);
});

test("units charged come from the balance, or the estimate when it doesn't move", () => {
    assert.equal(unitsCharged(10000, 9680, 320), 320);
    assert.equal(unitsCharged(10000, 9750, 320), 250);
    assert.equal(unitsCharged(10000, 10000, 320), 320);
    assert.equal(unitsCharged(undefined, undefined, 320), 320);
});

test("prices and colours", () => {
    assert.equal(pricePerImage("recraftv4_1_vector"), 80);
    assert.equal(pricePerImage("recraftv4_styles_vector"), 50);
    assert.deepEqual(hexToRgb("#2F5D50"), [47, 93, 80]);
    assert.throws(() => hexToRgb("2F5D50"), /#RRGGBB/);
});
