import type { Clock } from "../../src/domain/clock";

const DAY_MILLIS = 86_400_000;

export interface TestClock extends Clock {
  advanceDays(n: number): void;
  nextDay(): void;
}

/** A clock in UTC that only moves when told to; starts on a Monday at 09:00. */
export function testClock(start = Date.UTC(2026, 2, 2, 9)): TestClock {
  let now = start;
  return {
    millis: () => now,
    timeZone: () => "UTC",
    advanceDays(n) {
      now += n * DAY_MILLIS;
    },
    nextDay() {
      now += DAY_MILLIS;
    },
  };
}
