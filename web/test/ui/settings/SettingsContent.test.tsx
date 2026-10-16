// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import type { PushSupport } from "../../../src/push/pushPlatform";
import type { InstallState } from "../../../src/ui/platform";
import type { ReminderUi } from "../../../src/ui/settings/settingsState";
import { SettingsContent } from "../../../src/ui/settings/SettingsContent";
import { TestIds } from "../../../src/ui/testIds";

function show(
  over: { newWordsPerDay?: number; busy?: boolean; installState?: InstallState; reminder?: Partial<ReminderUi> | null } = {},
) {
  const calls: string[] = [];
  render(
    <SettingsContent
      newWordsPerDay={over.newWordsPerDay ?? 10}
      busy={over.busy ?? false}
      installState={over.installState ?? "unavailable"}
      reminder={over.reminder === undefined || over.reminder === null ? null : { on: true, support: "supported", hour: 8, minute: 0, ...over.reminder }}
      build="abc1234"
      onBack={() => calls.push("back")}
      onNewWordsPerDayChange={(v) => calls.push(`words:${v}`)}
      onExport={() => calls.push("export")}
      onImport={(file) => calls.push(`import:${file.name}`)}
      onInstall={() => calls.push("install")}
      onReminderToggle={(on) => calls.push(`reminder:${on}`)}
      onReminderTimeChange={(h, m) => calls.push(`time:${h}:${m}`)}
      onSendTest={() => calls.push("test")}
    />,
  );
  return calls;
}

const disabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled;

describe("SettingsContent", () => {
  it("sections appear in order with no key or reminder section", () => {
    show({ installState: "prompt" });
    const titles = [...document.querySelectorAll(".section-title")].map((e) => e.textContent);
    expect(titles).toEqual(["Install", "Practice", "Backup", "About"]);
    for (const text of ["API key", "Anthropic", "Daily reminder", "Google account"]) {
      expect(screen.queryByText(text, { exact: false })).toBeNull();
    }
  });

  it("the stepper calls with plus and minus one", () => {
    const calls = show();
    fireEvent.click(screen.getByTestId(TestIds.SETTINGS_NEW_WORDS_INCREASE));
    fireEvent.click(screen.getByTestId(TestIds.SETTINGS_NEW_WORDS_DECREASE));
    expect(calls).toEqual(["words:11", "words:9"]);
  });

  it("the stepper disables at 100 and at 1", () => {
    show({ newWordsPerDay: 100 });
    expect(disabled(screen.getByTestId(TestIds.SETTINGS_NEW_WORDS_INCREASE))).toBe(true);
    expect(disabled(screen.getByTestId(TestIds.SETTINGS_NEW_WORDS_DECREASE))).toBe(false);
  });

  it("the stepper disables at one", () => {
    show({ newWordsPerDay: 1 });
    expect(disabled(screen.getByTestId(TestIds.SETTINGS_NEW_WORDS_DECREASE))).toBe(true);
    expect(disabled(screen.getByTestId(TestIds.SETTINGS_NEW_WORDS_INCREASE))).toBe(false);
  });

  it("export and import call back", () => {
    const calls = show();
    fireEvent.click(screen.getByText("Export"));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.accept).toBe(".json,application/json,text/plain");
    fireEvent.change(input, { target: { files: [new File(["{}"], "b.json")] } });
    expect(calls).toEqual(["export", "import:b.json"]);
  });

  it("export and import are disabled while busy", () => {
    show({ busy: true });
    expect(disabled(screen.getByText("Export"))).toBe(true);
    expect(document.querySelector<HTMLInputElement>('input[type="file"]')!.disabled).toBe(true);
  });

  it("install shows for prompt, with its button", () => {
    const calls = show({ installState: "prompt" });
    expect(screen.getByText("Install", { selector: ".section-title" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(calls).toEqual(["install"]);
  });

  it("install shows the steps for ios, text only", () => {
    show({ installState: "ios" });
    expect(screen.getByText(/tap Share, then Add to Home Screen/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
  });

  it.each<InstallState>(["installed", "unavailable"])("install is hidden for %s", (installState) => {
    show({ installState });
    expect(screen.queryByText("Install", { selector: ".section-title" })).toBeNull();
  });

  it("about names the build and links out safely", () => {
    show();
    expect(screen.getByText("Tortoise Spelling for the web (abc1234)")).toBeTruthy();
    for (const name of ["Privacy policy", "Source code"]) {
      const link = screen.getByText(name) as HTMLAnchorElement;
      expect(link.target).toBe("_blank");
      expect(link.rel).toBe("noopener");
    }
  });

  describe("the Daily reminder section", () => {
    const sectionTitles = () => [...document.querySelectorAll(".section-title")].map((e) => e.textContent);
    const reminderSwitch = () => screen.getByTestId(TestIds.SETTINGS_REMINDER_SWITCH) as HTMLInputElement;
    const timeField = () => screen.getByTestId(TestIds.SETTINGS_REMINDER_TIME_BUTTON) as HTMLInputElement;

    it("is absent without a reminder server", () => {
      show({ reminder: null });
      expect(sectionTitles()).not.toContain("Daily reminder");
      expect(screen.queryByTestId(TestIds.SETTINGS_REMINDER_SWITCH)).toBeNull();
    });

    it("sits above Practice", () => {
      show({ installState: "prompt", reminder: {} });
      expect(sectionTitles()).toEqual(["Install", "Daily reminder", "Practice", "Backup", "About"]);
    });

    it("the switch shows the effective state", () => {
      show({ reminder: { on: true } });
      expect(reminderSwitch().checked).toBe(true);
      cleanup();
      show({ reminder: { on: false } });
      expect(reminderSwitch().checked).toBe(false);
    });

    it("toggling calls back with the wanted state", () => {
      const calls = show({ reminder: { on: false } });
      fireEvent.click(reminderSwitch());
      expect(calls).toEqual(["reminder:true"]);
    });

    it.each<[PushSupport, boolean, string]>([
      ["supported", false, "Reminders come through your browser's push service, so they arrive when this device is online, within a few minutes of the time you set."],
      ["needs-install", true, "On iPhone and iPad, reminders work once Tortoise Spelling is installed: tap Share, then Add to Home Screen, and open it from there."],
      ["unsupported", true, "This browser can't show reminders. Home still shows what's due today."],
    ])("for %s the switch is disabled=%s and the help line says why", (support, isDisabled, help) => {
      show({ reminder: { on: support === "supported", support } });
      expect(reminderSwitch().disabled).toBe(isDisabled);
      expect(screen.getByText(help)).toBeTruthy();
    });

    it("the time field shows HH:MM, and is disabled while the switch is off", () => {
      show({ reminder: { on: true, hour: 7, minute: 5 } });
      expect(timeField().value).toBe("07:05");
      expect(timeField().disabled).toBe(false);
      cleanup();
      show({ reminder: { on: false } });
      expect(timeField().disabled).toBe(true);
    });

    it("a new time calls back, and clearing the field does not", () => {
      const calls = show({ reminder: { on: true } });
      fireEvent.change(timeField(), { target: { value: "21:30" } });
      fireEvent.change(timeField(), { target: { value: "" } });
      expect(calls).toEqual(["time:21:30"]);
    });

    it("Send a test notification calls back", () => {
      const calls = show({ reminder: {} });
      fireEvent.click(screen.getByText("Send a test notification"));
      expect(calls).toEqual(["test"]);
    });
  });
});
