// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ContainerContext } from "../../../src/ui/container";
import { CompletionScreen } from "../../../src/ui/complete/CompletionScreen";
import { HomeScreen } from "../../../src/ui/home/HomeScreen";
import { TestIds } from "../../../src/ui/testIds";
import { fakePlatform } from "../../support/fakePlatform";
import { fakePushApi } from "../../support/fakePushApi";
import { createReminderSync } from "../../../src/push/reminderSync";
import { content, openTestRepository } from "../../support/repo";

async function setup() {
  const { repo, clock } = await openTestRepository();
  const platform = fakePlatform();
  const container = { repository: repo, clock, platform, autoAdvanceMillis: 0, reminders: null };
  return { repo, clock, platform, container };
}

describe("HomeScreen", () => {
  it("asks for persistent storage once words exist, and not before", async () => {
    const { repo, platform, container } = await setup();
    render(
      <ContainerContext.Provider value={container}>
        <HomeScreen />
      </ContainerContext.Provider>,
    );
    await screen.findByText("No words yet");
    expect(platform.calls).not.toContain("persistStorage");

    await act(async () => {
      await repo.addWord("cat", content("a pet"));
    });
    await screen.findByTestId(TestIds.HOME_PRACTICE_COUNT);
    await waitFor(() => expect(platform.calls.filter((c) => c === "persistStorage")).toHaveLength(1));

    await act(async () => {
      await repo.addWord("dog", content("another pet"));
    });
    await waitFor(() => expect(screen.getByTestId(TestIds.HOME_PRACTICE_COUNT).textContent).toBe("2"));
    expect(platform.calls.filter((c) => c === "persistStorage")).toHaveLength(1);
  });

  it("doesn't ask when storage is already persistent", async () => {
    const { repo, platform, container } = await setup();
    platform.persisted = true;
    await repo.addWord("cat", content("a pet"));
    render(
      <ContainerContext.Provider value={container}>
        <HomeScreen />
      </ContainerContext.Provider>,
    );
    await screen.findByTestId(TestIds.HOME_PRACTICE_COUNT);
    expect(platform.calls).not.toContain("persistStorage");
    expect(screen.queryByTestId(TestIds.HOME_BACKUP_NUDGE)).toBeNull();
  });

  it("shows the nudge, and an export drops it straight away", async () => {
    const { repo, platform, container } = await setup();
    await repo.addWord("cat", content("a pet"));
    render(
      <ContainerContext.Provider value={container}>
        <HomeScreen />
      </ContainerContext.Provider>,
    );
    await screen.findByTestId(TestIds.HOME_BACKUP_NUDGE);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await screen.findByText("Backup saved.");
    await waitFor(() => expect(screen.queryByTestId(TestIds.HOME_BACKUP_NUDGE)).toBeNull());
    expect(platform.saved[0]?.name).toBe("tortoisespelling-backup.json");
    expect(platform.saved[0]?.text).toContain("cat");
    expect((await repo.settings()).lastExportedAt).not.toBeNull();
  });

  it("a cancelled export says nothing and keeps the nudge", async () => {
    const { repo, platform, container } = await setup();
    platform.saveResult = "cancelled";
    await repo.addWord("cat", content("a pet"));
    render(
      <ContainerContext.Provider value={container}>
        <HomeScreen />
      </ContainerContext.Provider>,
    );
    await screen.findByTestId(TestIds.HOME_BACKUP_NUDGE);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Export" }));
    });
    expect(screen.queryByText("Backup saved.")).toBeNull();
    expect(screen.getByTestId(TestIds.HOME_BACKUP_NUDGE)).toBeTruthy();
    expect((await repo.settings()).lastExportedAt).toBeNull();
  });

  it("a failed export says so", async () => {
    const { repo, platform, container } = await setup();
    platform.saveError = new Error("no");
    await repo.addWord("cat", content("a pet"));
    render(
      <ContainerContext.Provider value={container}>
        <HomeScreen />
      </ContainerContext.Provider>,
    );
    await screen.findByTestId(TestIds.HOME_BACKUP_NUDGE);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await screen.findByText("Couldn't write that file.");
  });

  it("re-reads when the page becomes visible again, so counts follow the clock past midnight", async () => {
    const { repo, clock, container } = await setup();
    const { id } = (await repo.addWord("cat", content("a pet"))) as { id: number };
    await repo.recordReview(id, true, "cat");
    render(
      <ContainerContext.Provider value={container}>
        <HomeScreen />
      </ContainerContext.Provider>,
    );
    await screen.findByText("All done — see you tomorrow");
    clock.nextDay();
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(screen.getByTestId(TestIds.HOME_PRACTICE_COUNT).textContent).toBe("1"));
  });
});

describe("CompletionScreen", () => {
  it("shows the panel and Done", async () => {
    const { repo, container } = await setup();
    await repo.addWord("cat", content("a pet"));
    render(
      <ContainerContext.Provider value={container}>
        <CompletionScreen />
      </ContainerContext.Provider>,
    );
    await screen.findByText("Nothing was due today.");
    await screen.findByRole("button", { name: "Done" });
    expect(screen.getByText("Practise a few more anyway")).toBeTruthy();
  });
});

describe("HomeScreen's reminder card", () => {
  async function withReminders() {
    const { repo, clock, platform } = await setup();
    const api = fakePushApi();
    const container = {
      repository: repo,
      clock,
      platform,
      autoAdvanceMillis: 0,
      reminders: { push: platform.push, api, sync: createReminderSync({ repository: repo, clock, push: platform.push, api }) },
    };
    await repo.addWord("cat", content("a pet"));
    render(
      <ContainerContext.Provider value={container}>
        <HomeScreen />
      </ContainerContext.Provider>,
    );
    await screen.findByTestId(TestIds.HOME_REMINDER_CARD);
    return { repo, platform, api };
  }

  it("Turn on asks the browser in the tap, registers and drops the card", async () => {
    const { repo, platform, api } = await withReminders();
    fireEvent.click(screen.getByTestId(TestIds.HOME_REMINDER_TURN_ON));
    expect(platform.push.calls).toEqual(["requestPermission"]);
    await waitFor(() => expect(screen.queryByTestId(TestIds.HOME_REMINDER_CARD)).toBeNull());
    await waitFor(() => expect(api.registered).toHaveLength(1));
    expect((await repo.settings()).reminderEnabled).toBe(true);
  });

  it("a refusal turns reminders off, says why, and the card stays gone", async () => {
    const { repo, platform } = await withReminders();
    platform.push.answer = "denied";
    fireEvent.click(screen.getByTestId(TestIds.HOME_REMINDER_TURN_ON));
    await screen.findByText(/Notifications are blocked for Tortoise Spelling/);
    expect((await repo.settings()).reminderEnabled).toBe(false);
    await waitFor(() => expect(screen.queryByTestId(TestIds.HOME_REMINDER_CARD)).toBeNull());
  });

  it("Not now turns reminders off without asking the browser", async () => {
    const { repo, platform } = await withReminders();
    fireEvent.click(screen.getByTestId(TestIds.HOME_REMINDER_NOT_NOW));
    await waitFor(() => expect(screen.queryByTestId(TestIds.HOME_REMINDER_CARD)).toBeNull());
    expect((await repo.settings()).reminderEnabled).toBe(false);
    expect(platform.push.calls).toEqual([]);
  });
});
