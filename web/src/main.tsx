import { render } from "preact";
import { App } from "./app";
import "./styles.css";
import { openDatabase } from "./data/db";
import { createRepository } from "./data/repository";
import { fakePush } from "./debug/fakePush";
import { fakePushApi } from "./debug/fakePushApi";
import { installSeedHook } from "./debug/seedHook";
import { deviceClock } from "./domain/clock";
import { createPushApi } from "./push/pushApi";
import { createReminderSync } from "./push/reminderSync";
import { browserPlatform, registerServiceWorker } from "./ui/browserPlatform";
import type { AppContainer } from "./ui/container";

const AUTO_ADVANCE_MILLIS = 1100;
const e2e = import.meta.env.MODE === "e2e";

async function start(root: HTMLElement): Promise<void> {
  if (window.__unsupported) return;
  let onVersionChange = () => {};
  let container: AppContainer;
  const fakes = e2e ? { push: fakePush(), api: fakePushApi() } : null;
  try {
    const db = await openDatabase(undefined, () => onVersionChange());
    const repository = createRepository({ db });
    const platform = browserPlatform();
    // Before anything can write a word: a notification's #/review launch must not review an
    // overdue word first and make the day it was skipped look quiet.
    await repository.settleQuietDays();
    // The test build's fakes make no requests: no browser under Playwright can subscribe to a push service.
    const push = fakes?.push ?? platform.push;
    const api = fakes?.api ?? (__PUSH_SERVER__ === "" ? null : createPushApi(__PUSH_SERVER__, fetch));
    container = {
      repository,
      clock: deviceClock,
      platform,
      autoAdvanceMillis: AUTO_ADVANCE_MILLIS,
      reminders: api && { push, api, sync: createReminderSync({ repository, clock: deviceClock, push, api }) },
    };
  } catch {
    root.textContent =
      "Tortoise Spelling can't store words in this browser. Check that it isn't blocking site data for this page.";
    return;
  }
  if (fakes) installSeedHook(container, fakes.push);
  const draw = (updatedInAnotherTab: boolean) =>
    render(<App container={container} updatedInAnotherTab={updatedInAnotherTab} />, root);
  onVersionChange = () => draw(true);
  draw(false);
  keepRemindersInSync(container);
  if (import.meta.env.PROD) registerServiceWorker();
}

/** Syncs the reminder on load, after every write and when the page comes back into view. */
function keepRemindersInSync({ repository, reminders }: AppContainer): void {
  if (!reminders) return;
  const sync = () => void reminders.sync.sync();
  sync();
  repository.subscribe(sync);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") sync();
  });
}

const root = document.getElementById("app");
if (root) void start(root);
