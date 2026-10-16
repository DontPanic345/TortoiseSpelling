import { describe, expect, it } from "vitest";
import { localDay, localMinute, sentDayOnRegister, shouldSend } from "../src/schedule";

const AUCKLAND = "Pacific/Auckland";
const LOS_ANGELES = "America/Los_Angeles";

function utc(text: string): number {
  return Date.parse(text);
}

function epochDay(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

describe("localDay and localMinute", () => {
  it("roll over at local midnight in Auckland (UTC+12 in winter)", () => {
    expect(localDay(utc("2026-06-30T11:59:00Z"), AUCKLAND)).toBe(epochDay(2026, 6, 30));
    expect(localMinute(utc("2026-06-30T11:59:00Z"), AUCKLAND)).toBe(23 * 60 + 59);
    expect(localDay(utc("2026-06-30T12:00:00Z"), AUCKLAND)).toBe(epochDay(2026, 7, 1));
    expect(localMinute(utc("2026-06-30T12:00:00Z"), AUCKLAND)).toBe(0);
  });

  it("roll over at local midnight in Los Angeles (UTC-7 in summer)", () => {
    expect(localDay(utc("2026-07-01T06:59:00Z"), LOS_ANGELES)).toBe(epochDay(2026, 6, 30));
    expect(localMinute(utc("2026-07-01T06:59:00Z"), LOS_ANGELES)).toBe(23 * 60 + 59);
    expect(localDay(utc("2026-07-01T07:00:00Z"), LOS_ANGELES)).toBe(epochDay(2026, 7, 1));
    expect(localMinute(utc("2026-07-01T07:00:00Z"), LOS_ANGELES)).toBe(0);
  });

  it("follow Auckland's clock forward on 27 September 2026", () => {
    // 02:00 NZST becomes 03:00 NZDT at 14:00 UTC on the 26th.
    expect(localMinute(utc("2026-09-26T13:59:00Z"), AUCKLAND)).toBe(1 * 60 + 59);
    expect(localMinute(utc("2026-09-26T14:00:00Z"), AUCKLAND)).toBe(3 * 60);
    expect(localDay(utc("2026-09-26T14:00:00Z"), AUCKLAND)).toBe(epochDay(2026, 9, 27));
  });

  it("follow Auckland's clock back on 5 April 2026", () => {
    // 03:00 NZDT becomes 02:00 NZST at 14:00 UTC on the 4th.
    expect(localMinute(utc("2026-04-04T13:59:00Z"), AUCKLAND)).toBe(2 * 60 + 59);
    expect(localMinute(utc("2026-04-04T14:00:00Z"), AUCKLAND)).toBe(2 * 60);
    expect(localDay(utc("2026-04-04T14:00:00Z"), AUCKLAND)).toBe(epochDay(2026, 4, 5));
  });

  it("follow Los Angeles' clock forward on 8 March 2026", () => {
    // 02:00 PST becomes 03:00 PDT at 10:00 UTC.
    expect(localMinute(utc("2026-03-08T09:59:00Z"), LOS_ANGELES)).toBe(1 * 60 + 59);
    expect(localMinute(utc("2026-03-08T10:00:00Z"), LOS_ANGELES)).toBe(3 * 60);
  });

  it("follow Los Angeles' clock back on 1 November 2026", () => {
    // 02:00 PDT becomes 01:00 PST at 09:00 UTC.
    expect(localMinute(utc("2026-11-01T08:59:00Z"), LOS_ANGELES)).toBe(1 * 60 + 59);
    expect(localMinute(utc("2026-11-01T09:00:00Z"), LOS_ANGELES)).toBe(1 * 60);
    expect(localDay(utc("2026-11-01T09:00:00Z"), LOS_ANGELES)).toBe(epochDay(2026, 11, 1));
  });

  it("read midnight as 0, not 24", () => {
    expect(localMinute(utc("2026-01-01T00:00:00Z"), "UTC")).toBe(0);
  });
});

describe("shouldSend", () => {
  const today = epochDay(2026, 6, 30);
  const base = { timeZone: "UTC", hour: 8, minute: 30, dueDay: today, lastSentDay: null };
  const at = (time: string) => utc(`2026-06-30T${time}:00Z`);

  it("waits for the day to reach dueDay", () => {
    expect(shouldSend({ ...base, dueDay: today + 1 }, at("12:00"))).toBe(false);
  });

  it("waits for the reminder time", () => {
    expect(shouldSend(base, at("08:29"))).toBe(false);
  });

  it("sends at the reminder time", () => {
    expect(shouldSend(base, at("08:30"))).toBe(true);
  });

  it("keeps reminding while words are overdue", () => {
    expect(shouldSend({ ...base, dueDay: today - 5, lastSentDay: today - 1 }, at("09:00"))).toBe(true);
  });

  it("sends once a day", () => {
    expect(shouldSend({ ...base, lastSentDay: today }, at("12:00"))).toBe(false);
  });

  it("never sends without a due day", () => {
    expect(shouldSend({ ...base, dueDay: null }, at("12:00"))).toBe(false);
  });

  it("fires at 03:00 when the reminder time falls in a skipped hour", () => {
    const row = { timeZone: AUCKLAND, hour: 2, minute: 30, dueDay: epochDay(2026, 9, 27), lastSentDay: null };
    expect(shouldSend(row, utc("2026-09-26T13:59:00Z"))).toBe(false);
    expect(shouldSend(row, utc("2026-09-26T14:00:00Z"))).toBe(true);
  });

  it("does not send twice when the clock repeats the reminder time", () => {
    const sent = { timeZone: LOS_ANGELES, hour: 1, minute: 30, dueDay: 0, lastSentDay: epochDay(2026, 11, 1) };
    expect(shouldSend({ ...sent, lastSentDay: null }, utc("2026-11-01T08:30:00Z"))).toBe(true);
    expect(shouldSend(sent, utc("2026-11-01T09:30:00Z"))).toBe(false);
  });
});

describe("sentDayOnRegister", () => {
  const reg = { timeZone: "UTC", hour: 8, minute: 0 };
  const today = epochDay(2026, 6, 30);

  it("keeps the previous day before the reminder time", () => {
    expect(sentDayOnRegister(null, reg, utc("2026-06-30T07:59:00Z"))).toBeNull();
    expect(sentDayOnRegister(today - 1, reg, utc("2026-06-30T07:59:00Z"))).toBe(today - 1);
  });

  it("counts today as sent at the reminder time", () => {
    expect(sentDayOnRegister(null, reg, utc("2026-06-30T08:00:00Z"))).toBe(today);
  });

  it("counts today as sent after the reminder time", () => {
    expect(sentDayOnRegister(today - 3, reg, utc("2026-06-30T10:00:00Z"))).toBe(today);
  });

  it("never moves the sent day back", () => {
    expect(sentDayOnRegister(today + 1, reg, utc("2026-06-30T10:00:00Z"))).toBe(today + 1);
  });

  it("reads the time on the device's zone", () => {
    // 10:00 UTC is 22:00 in Auckland, after 08:00 there, and still the 30th in Los Angeles' morning.
    expect(sentDayOnRegister(null, { ...reg, timeZone: AUCKLAND }, utc("2026-06-30T10:00:00Z"))).toBe(today);
    expect(sentDayOnRegister(null, { ...reg, timeZone: LOS_ANGELES }, utc("2026-06-30T10:00:00Z"))).toBeNull();
  });
});
