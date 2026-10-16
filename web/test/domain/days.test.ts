import { describe, expect, it } from "vitest";
import { deviceClock } from "../../src/domain/clock";
import { hourOf } from "../../src/domain/days";
import { testClock } from "../support/testClock";

describe("hourOf", () => {
  it("is the clock's local hour", () => {
    expect(hourOf(testClock())).toBe(9);
    const auckland = { millis: () => Date.UTC(2026, 2, 2, 9), timeZone: () => "Pacific/Auckland" };
    expect(hourOf(auckland)).toBe(22);
  });

  it("reads midnight as 0, not 24", () => {
    expect(hourOf(testClock(Date.UTC(2026, 2, 2, 0, 30)))).toBe(0);
  });
});

describe("deviceClock", () => {
  it("reads the real time and a time zone name", () => {
    expect(Math.abs(deviceClock.millis() - Date.now())).toBeLessThan(1000);
    expect(deviceClock.timeZone().length).toBeGreaterThan(0);
  });
});
