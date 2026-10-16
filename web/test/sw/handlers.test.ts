import { describe, expect, it } from "vitest";
import { createReminderSync } from "../../src/push/reminderSync";
import { handleClick, handlePush, type WorkerDeps } from "../../src/sw/handlers";
import type { ReminderText } from "../../src/sw/notification";
import { fakePush } from "../support/fakePlatform";
import { fakePushApi } from "../support/fakePushApi";
import { content, openTestRepository } from "../support/repo";

const D = Date.UTC(2026, 2, 2) / 86_400_000;

async function setup() {
  const { repo, clock, db } = await openTestRepository();
  const push = fakePush();
  push.granted = "granted";
  const api = fakePushApi();
  const sync = createReminderSync({ repository: repo, clock, push, api });
  const shown: ReminderText[] = [];
  const focused: string[] = [];
  const opened: string[] = [];
  let windows: string[] = [];
  const deps: WorkerDeps = {
    repository: async () => repo,
    sync: () => sync.sync(),
    show: async (text) => void shown.push(text),
    windows: async () => windows.map((name) => ({ focus: async () => void focused.push(name) })),
    openWindow: async (url) => void opened.push(url),
  };
  return {
    repo,
    db,
    push,
    api,
    sync,
    deps,
    shown,
    focused,
    opened,
    setWindows: (names: string[]) => (windows = names),
  };
}

describe("handlePush", () => {
  it("shows how many words are ready", async () => {
    const { repo, deps, shown } = await setup();
    await repo.addWord("necessary", content("Needed.", "It is necessary."));
    await handlePush("reminder", deps);
    expect(shown).toEqual([{ title: "Time to practise spelling", body: "1 word ready" }]);
  });

  it("counts due and new words together", async () => {
    const { repo, deps, shown } = await setup();
    await repo.addWord("necessary", content("Needed.", "It is necessary."));
    await repo.addWord("separate", content("Apart.", "Keep them separate."));
    await handlePush("test", deps);
    expect(shown[0]?.body).toBe("2 words ready");
  });

  it("shows that reminders are working, and marks the day satisfied, when a reminder finds nothing due", async () => {
    const { deps, shown, db } = await setup();
    await handlePush("reminder", deps);
    expect(shown).toEqual([{ title: "Reminders are working", body: "Nothing is due right now." }]);
    expect(await db.get("settings", "satisfiedDays")).toEqual([D]);
  });

  it("shows the same for a test but marks nothing", async () => {
    const { deps, shown, db } = await setup();
    await handlePush("test", deps);
    expect(shown).toHaveLength(1);
    expect(await db.get("settings", "satisfiedDays")).toBeUndefined();
  });

  it("marks nothing when reminders are off, as Android's worker does", async () => {
    const { deps, repo, db } = await setup();
    await repo.setReminderEnabled(false);
    await handlePush("reminder", deps);
    expect(await db.get("settings", "satisfiedDays")).toBeUndefined();
  });

  it("syncs after a reminder, correcting a stale due day", async () => {
    const { deps, repo, api, push } = await setup();
    await repo.addWord("necessary", content("Needed.", "It is necessary."));
    await handlePush("reminder", deps);
    expect(api.registered.at(-1)?.dueDay).toBe(D);
    expect(push.current).not.toBeNull();
  });

  it("doesn't sync after a test", async () => {
    const { deps, api } = await setup();
    await handlePush("test", deps);
    expect(api.calls).toEqual([]);
  });

  it("still shows a notification with reminders off, then unregisters", async () => {
    const { deps, repo, sync, api, shown, push } = await setup();
    await repo.addWord("necessary", content("Needed.", "It is necessary."));
    await sync.sync();
    await repo.setReminderEnabled(false);
    await handlePush("reminder", deps);

    expect(shown).toHaveLength(1);
    expect(api.calls).toContain("unregister:https://fcm.googleapis.com/fcm/send/1");
    expect(push.current).toBeNull();
  });

  it("still shows a notification when the sync fails", async () => {
    const { deps, shown } = await setup();
    deps.sync = async () => {
      throw new Error("offline");
    };
    await handlePush("reminder", deps);
    expect(shown).toHaveLength(1);
  });

  it("still shows a notification when the words can't be read", async () => {
    const { deps, shown } = await setup();
    deps.repository = async () => {
      throw new Error("no database");
    };
    await handlePush("reminder", deps);
    expect(shown).toEqual([{ title: "Reminders are working", body: "Nothing is due right now." }]);
  });
});

describe("handleClick", () => {
  it("focuses an open window and does nothing else", async () => {
    const { deps, setWindows, focused, opened } = await setup();
    setWindows(["one"]);
    await handleClick(deps);
    expect(focused).toEqual(["one"]);
    expect(opened).toEqual([]);
  });

  it("opens today's session when no window is open", async () => {
    const { deps, focused, opened } = await setup();
    await handleClick(deps);
    expect(opened).toEqual(["./#/review"]);
    expect(focused).toEqual([]);
  });
});
