// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import type { InstallState } from "../../../src/ui/platform";
import { SettingsContent } from "../../../src/ui/settings/SettingsContent";
import { TestIds } from "../../../src/ui/testIds";

function show(over: { newWordsPerDay?: number; busy?: boolean; installState?: InstallState } = {}) {
  const calls: string[] = [];
  render(
    <SettingsContent
      newWordsPerDay={over.newWordsPerDay ?? 10}
      busy={over.busy ?? false}
      installState={over.installState ?? "unavailable"}
      build="abc1234"
      onBack={() => calls.push("back")}
      onNewWordsPerDayChange={(v) => calls.push(`words:${v}`)}
      onExport={() => calls.push("export")}
      onImport={(file) => calls.push(`import:${file.name}`)}
      onInstall={() => calls.push("install")}
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
});
