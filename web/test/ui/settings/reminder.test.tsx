// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { PushApiError } from "../../../src/push/pushApi";
import { createReminderSync } from "../../../src/push/reminderSync";
import { ContainerContext } from "../../../src/ui/container";
import { SettingsScreen } from "../../../src/ui/settings/SettingsScreen";
import { TestIds } from "../../../src/ui/testIds";
import { fakePlatform } from "../../support/fakePlatform";
import { fakePushApi } from "../../support/fakePushApi";
import { openTestRepository } from "../../support/repo";

async function setup(permission: "default" | "granted" = "default") {
  const { repo, clock } = await openTestRepository();
  const platform = fakePlatform();
  platform.push.granted = permission;
  const api = fakePushApi();
  const container = {
    repository: repo,
    clock,
    platform,
    autoAdvanceMillis: 0,
    reminders: { push: platform.push, api, sync: createReminderSync({ repository: repo, clock, push: platform.push, api }) },
  };
  render(
    <ContainerContext.Provider value={container}>
      <SettingsScreen />
    </ContainerContext.Provider>,
  );
  const reminderSwitch = (await screen.findByTestId(TestIds.SETTINGS_REMINDER_SWITCH)) as HTMLInputElement;
  return { repo, platform, push: platform.push, api, reminderSwitch };
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe("the Daily reminder section on the Settings screen", () => {
  it("is absent without a reminder server", async () => {
    const { repo, clock } = await openTestRepository();
    render(
      <ContainerContext.Provider
        value={{ repository: repo, clock, platform: fakePlatform(), autoAdvanceMillis: 0, reminders: null }}
      >
        <SettingsScreen />
      </ContainerContext.Provider>,
    );
    await screen.findByText("Practice");
    expect(screen.queryByText("Daily reminder")).toBeNull();
  });

  it("shows off until the browser has said yes, whatever the stored setting", async () => {
    const { reminderSwitch, push } = await setup();
    expect(push.granted).toBe("default");
    expect(reminderSwitch.checked).toBe(false);
  });

  it("shows on when enabled and granted", async () => {
    const { reminderSwitch } = await setup("granted");
    await waitFor(() => expect(reminderSwitch.checked).toBe(true));
  });

  it("turning on asks the browser before anything async, then registers", async () => {
    const { reminderSwitch, push, api, repo } = await setup();
    fireEvent.click(reminderSwitch);
    // No await yet: the prompt has to be requested inside the tap.
    expect(push.calls).toEqual(["requestPermission"]);
    await waitFor(() => expect(reminderSwitch.checked).toBe(true));
    await waitFor(() => expect(api.registered).toHaveLength(1));
    expect((await repo.settings()).reminderEnabled).toBe(true);
  });

  it("a refusal turns reminders off and says the browser blocks them", async () => {
    const { reminderSwitch, push, repo } = await setup();
    push.answer = "denied";
    fireEvent.click(reminderSwitch);
    await screen.findByText(
      "Notifications are blocked for Tortoise Spelling. Allow them in this browser's settings for this site.",
    );
    expect((await repo.settings()).reminderEnabled).toBe(false);
    expect(reminderSwitch.checked).toBe(false);
  });

  it("a prompt the user closes turns reminders off without a message", async () => {
    const { reminderSwitch, push, repo } = await setup();
    push.answer = "default";
    fireEvent.click(reminderSwitch);
    await waitFor(async () => expect((await repo.settings()).reminderEnabled).toBe(false));
    await flush();
    expect(document.querySelector(".snackbar")).toBeNull();
    expect(reminderSwitch.checked).toBe(false);
  });

  it("turning off unregisters", async () => {
    const { reminderSwitch, api, push } = await setup();
    fireEvent.click(reminderSwitch);
    await waitFor(() => expect(api.registered).toHaveLength(1));
    await waitFor(() => expect(reminderSwitch.checked).toBe(true));
    fireEvent.click(reminderSwitch);
    await waitFor(() => expect(api.calls.some((c) => c.startsWith("unregister:"))).toBe(true));
    expect(push.calls).toContain("unsubscribe");
  });

  it("an unreachable server after a change says it will try again", async () => {
    const { reminderSwitch, api } = await setup();
    api.failure = new Error("offline");
    fireEvent.click(reminderSwitch);
    await screen.findByText("Couldn't reach the reminder server. It will try again next time the app opens.");
  });

  it("a new time is stored and registered", async () => {
    const { reminderSwitch, repo, api } = await setup();
    fireEvent.click(reminderSwitch);
    await waitFor(() => expect(api.registered).toHaveLength(1));
    await waitFor(() => expect(reminderSwitch.checked).toBe(true));
    fireEvent.change(screen.getByTestId(TestIds.SETTINGS_REMINDER_TIME_BUTTON), { target: { value: "19:45" } });
    await waitFor(() => expect(api.registered).toHaveLength(2));
    expect(api.registered[1]).toMatchObject({ hour: 19, minute: 45 });
    const settings = await repo.settings();
    expect([settings.reminderHour, settings.reminderMinute]).toEqual([19, 45]);
  });

  describe("Send a test notification", () => {
    const sendTest = () => fireEvent.click(screen.getByText("Send a test notification"));

    it("asks for the reminder to be turned on first", async () => {
      const { api } = await setup();
      sendTest();
      await screen.findByText("Turn on the daily reminder first.");
      expect(api.calls.filter((c) => c.startsWith("test:"))).toEqual([]);
    });

    it("queues a test for the registered browser", async () => {
      const { reminderSwitch, api, push } = await setup();
      fireEvent.click(reminderSwitch);
      await waitFor(() => expect(reminderSwitch.checked).toBe(true));
      await waitFor(() => expect(api.registered).toHaveLength(1));
      sendTest();
      await screen.findByText("Test reminder queued.");
      expect(api.calls).toContain(`test:${push.current?.endpoint}`);
    });

    it("registers again on a 404 and tries once more", async () => {
      const { reminderSwitch, api } = await setup();
      fireEvent.click(reminderSwitch);
      await waitFor(() => expect(reminderSwitch.checked).toBe(true));
      await waitFor(() => expect(api.registered).toHaveLength(1));
      let tests = 0;
      const test = api.test;
      api.test = async (endpoint) => {
        if (tests++ === 0) throw new PushApiError(404);
        await test(endpoint);
      };
      sendTest();
      await screen.findByText("Test reminder queued.");
      expect(tests).toBe(2);
      expect(api.registered).toHaveLength(2);
    });

    it("says the server can't be reached when it refuses", async () => {
      const { reminderSwitch, api } = await setup();
      fireEvent.click(reminderSwitch);
      await waitFor(() => expect(reminderSwitch.checked).toBe(true));
      await waitFor(() => expect(api.registered).toHaveLength(1));
      api.testStatus = 500;
      sendTest();
      await screen.findByText("Couldn't reach the reminder server.");
    });
  });
});
