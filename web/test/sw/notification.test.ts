import { describe, expect, it } from "vitest";
import { pushKind, reminderNotification } from "../../src/sw/notification";

describe("reminderNotification", () => {
  it("says one word is ready", () => {
    expect(reminderNotification(1)).toEqual({ title: "Time to practise spelling", body: "1 word ready" });
  });

  it("counts several words", () => {
    expect(reminderNotification(12)).toEqual({ title: "Time to practise spelling", body: "12 words ready" });
  });

  it("says reminders are working when nothing is due", () => {
    expect(reminderNotification(0)).toEqual({ title: "Reminders are working", body: "Nothing is due right now." });
  });
});

describe("pushKind", () => {
  const data = (json: unknown) => ({ json: () => json });

  it("reads reminder and test", () => {
    expect(pushKind(data({ kind: "reminder" }))).toBe("reminder");
    expect(pushKind(data({ kind: "test" }))).toBe("test");
  });

  it("counts an empty or unreadable payload as a reminder", () => {
    expect(pushKind(null)).toBe("reminder");
    expect(pushKind(data("nonsense"))).toBe("reminder");
    expect(
      pushKind({
        json: () => {
          throw new SyntaxError("bad");
        },
      }),
    ).toBe("reminder");
  });
});
