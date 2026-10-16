import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import { problemsFixtureAllowing } from "../playwright/fixtures";
import { addWordByHand } from "./helpers";

// The build under test points at a closed port (9, which Chromium also blocks outright), so every
// request to the reminder server fails; that failed request is the one console error allowed.
const test = base.extend<{ problems: string[] }>({
  problems: problemsFixtureAllowing([/net::ERR_(CONNECTION_REFUSED|UNSAFE_PORT)/]),
});

// The headless shell refuses notifications whatever is granted; the full Chromium in its new headless mode shows them.
test.use({ channel: "chromium" });
test.skip(({ browserName }) => browserName !== "chromium", "WebKit can't deliver a push over the DevTools protocol");
test.skip(!!process.env.SMOKE_URL, "the deployed site has the real server, not a closed port");

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["notifications"]);
});

/** Delivers a push to the page's service worker, as a push service would. */
async function deliverPush(context: BrowserContext, page: Page, payload: object): Promise<void> {
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const cdp = await context.newCDPSession(page);
  const registered = new Promise<string>((resolve) =>
    cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
      const found = registrations.find((r: { scopeURL: string }) => r.scopeURL === new URL("./", page.url()).href);
      if (found) resolve(found.registrationId);
    }),
  );
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin: new URL(page.url()).origin,
    registrationId: await registered,
    data: JSON.stringify(payload),
  });
}

const shown = (page: Page) =>
  page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return (await registration.getNotifications()).map((n) => ({ title: n.title, body: n.body }));
  });

test("a reminder push with a word due shows the count", async ({ page, context }) => {
  await addWordByHand(page, "rhythm");
  await deliverPush(context, page, { kind: "reminder" });
  await expect.poll(() => shown(page)).toEqual([{ title: "Time to practise spelling", body: "1 word ready" }]);
});

test("a reminder push with nothing due says reminders are working", async ({ page, context }) => {
  await deliverPush(context, page, { kind: "reminder" });
  await expect
    .poll(() => shown(page))
    .toEqual([{ title: "Reminders are working", body: "Nothing is due right now." }]);
});

test("Settings shows the Daily reminder section, and an unreachable server is said so", async ({ page }) => {
  await page.goto("./#/settings");
  const reminderSwitch = page.getByTestId("settings_reminder_switch");
  await expect(page.getByText("Daily reminder", { exact: true })).toBeVisible();
  await expect(reminderSwitch).toBeChecked();

  await reminderSwitch.click();
  await expect(reminderSwitch).not.toBeChecked();
  await reminderSwitch.click();
  await expect(
    page.getByText("Couldn't reach the reminder server. It will try again next time the app opens."),
  ).toBeVisible();
});
