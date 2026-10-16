import { describe, expect, it } from "vitest";
import { createReminderSync } from "../../src/push/reminderSync";
import { fakePush } from "../support/fakePlatform";
import { fakePushApi } from "../support/fakePushApi";
import { content, openTestRepository } from "../support/repo";

const D = Date.UTC(2026, 2, 2) / 86_400_000;

async function setup() {
  const { repo, clock, db } = await openTestRepository();
  const push = fakePush();
  push.granted = "granted";
  const api = fakePushApi();
  const { sync } = createReminderSync({ repository: repo, clock, push, api });
  await repo.addWord("necessary", content("Needed.", "It is necessary."));
  return { repo, clock, db, push, api, sync };
}

const registers = (calls: string[]) => calls.filter((call) => call === "register").length;

describe("reminderSync", () => {
  it("subscribes with the server's key and registers the expected body", async () => {
    const { sync, push, api, repo } = await setup();
    expect(await sync()).toBe("ok");

    expect(push.subscribedWith).toEqual(["server-key-1"]);
    expect(api.registered).toEqual([
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/1",
        keys: { p256dh: "p256dh-1", auth: "auth-1" },
        timeZone: "UTC",
        hour: 8,
        minute: 0,
        dueDay: D,
      },
    ]);
    const stored = (await repo.settings()).pushRegistration;
    expect(stored).toMatchObject({ endpoint: "https://fcm.googleapis.com/fcm/send/1", publicKey: "server-key-1" });
    expect(stored?.sent).toBe(JSON.stringify(api.registered[0]));
  });

  it("sends nothing when nothing changed", async () => {
    const { sync, api } = await setup();
    await sync();
    await sync();
    await sync();
    expect(registers(api.calls)).toBe(1);
  });

  it("sends again for a new reminder time", async () => {
    const { sync, api, repo } = await setup();
    await sync();
    await repo.setReminderTime(7, 30);
    await sync();
    expect(api.registered.at(-1)).toMatchObject({ hour: 7, minute: 30 });
    expect(registers(api.calls)).toBe(2);
  });

  it("sends again when a review moves the reminder day", async () => {
    const { sync, api, repo } = await setup();
    await sync();
    const [card] = await repo.buildSession();
    await repo.recordReview(card!.word.id, true, "necessary");
    await sync();
    expect(api.registered.at(-1)?.dueDay).toBe(D + 1);
  });

  it("sends the same state again a day later", async () => {
    const { sync, api, clock } = await setup();
    await sync();
    clock.advanceDays(1);
    await sync();
    expect(registers(api.calls)).toBe(2);
  });

  it("resubscribes when the server's key has changed", async () => {
    const { sync, api, push, clock } = await setup();
    await sync();
    api.publicKeyValue = "server-key-2";
    clock.advanceDays(1);
    await sync();

    expect(push.subscribedWith).toEqual(["server-key-1", "server-key-2"]);
    expect(api.calls).toContain("unregister:https://fcm.googleapis.com/fcm/send/1");
    expect(api.registered.at(-1)?.endpoint).toBe("https://fcm.googleapis.com/fcm/send/2");
  });

  it("keeps the subscription when the key is the same", async () => {
    const { sync, push, clock } = await setup();
    await sync();
    clock.advanceDays(1);
    await sync();
    expect(push.subscribedWith).toEqual(["server-key-1"]);
  });

  it("unregisters the old endpoint when the browser gives a new one", async () => {
    const { sync, api, push } = await setup();
    await sync();
    push.current = { endpoint: "https://fcm.googleapis.com/fcm/send/rotated", p256dh: "p", auth: "a" };
    await sync();

    expect(api.calls).toContain("unregister:https://fcm.googleapis.com/fcm/send/1");
    expect(api.registered.at(-1)?.endpoint).toBe("https://fcm.googleapis.com/fcm/send/rotated");
    expect(push.subscribedWith).toEqual(["server-key-1"]);
  });

  it("unregisters and unsubscribes once when reminders are turned off", async () => {
    const { sync, api, push, repo } = await setup();
    await sync();
    await repo.setReminderEnabled(false);
    await sync();
    await sync();

    expect(api.calls.filter((call) => call.startsWith("unregister"))).toHaveLength(1);
    expect(push.calls.filter((call) => call === "unsubscribe")).toHaveLength(1);
    expect((await repo.settings()).pushRegistration).toBeNull();
  });

  it("does the same when permission is taken away", async () => {
    const { sync, api, push, repo } = await setup();
    await sync();
    push.granted = "denied";
    await sync();
    expect(api.calls.filter((call) => call.startsWith("unregister"))).toHaveLength(1);
    expect(push.current).toBeNull();
    expect((await repo.settings()).pushRegistration).toBeNull();
  });

  it("does nothing, and asks nothing, when it was never on", async () => {
    const { sync, api, push, repo } = await setup();
    await repo.setReminderEnabled(false);
    await sync();
    expect(api.calls).toEqual([]);
    expect(push.calls).toEqual([]);
  });

  it("does nothing without push support or before permission", async () => {
    const { sync, api, push } = await setup();
    push.granted = "default";
    await sync();
    push.granted = "granted";
    push.supported = "needs-install";
    await sync();
    expect(api.calls).toEqual([]);
    expect(push.subscribedWith).toEqual([]);
  });

  it("still unregisters when the server can't be reached", async () => {
    const { sync, api, push, repo } = await setup();
    await sync();
    await repo.setReminderEnabled(false);
    api.failure = new TypeError("offline");
    expect(await sync()).toBe("ok");
    expect(push.current).toBeNull();
    expect((await repo.settings()).pushRegistration).toBeNull();
  });

  it("leaves the stored state alone on a failure and retries on the next call", async () => {
    const { sync, api, repo } = await setup();
    api.failure = new TypeError("offline");
    expect(await sync()).toBe("offline");
    expect((await repo.settings()).pushRegistration).toBeNull();

    api.failure = null;
    expect(await sync()).toBe("ok");
    expect(registers(api.calls)).toBe(1);
    expect((await repo.settings()).pushRegistration).not.toBeNull();
  });

  it("retries a failed registration even though the browser is already subscribed", async () => {
    const { sync, api, push } = await setup();
    await sync();
    const before = registers(api.calls);
    const original = api.register;
    api.register = async () => {
      throw new TypeError("offline");
    };
    push.current = { ...push.current!, endpoint: "https://fcm.googleapis.com/fcm/send/new" };
    expect(await sync()).toBe("offline");
    api.register = original;
    expect(await sync()).toBe("ok");
    expect(registers(api.calls)).toBe(before + 1);
  });

  it("runs overlapping calls at most twice", async () => {
    const { sync, repo } = await setup();
    let reads = 0;
    const settings = repo.settings.bind(repo);
    repo.settings = async () => {
      reads++;
      return settings();
    };
    await Promise.all([sync(), sync(), sync(), sync()]);
    expect(reads).toBe(2);
  });

  it("registers an unchanged body when forced", async () => {
    const { sync, api } = await setup();
    await sync();
    await sync({ force: true });
    expect(registers(api.calls)).toBe(2);
  });

  it("forces the second run when only the overlapping call asked", async () => {
    const { sync, api } = await setup();
    await sync();
    await Promise.all([sync(), sync({ force: true })]);
    expect(registers(api.calls)).toBe(2);
  });

  it("reports no due day when nothing will ever be due", async () => {
    const { repo, sync, api } = await setup();
    const [word] = await repo.wordsWithContent();
    await repo.setSuspended(word!.id, true);
    await sync();
    expect(api.registered[0]?.dueDay).toBeNull();
  });
});
