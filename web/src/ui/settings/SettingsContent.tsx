import type { ComponentChildren } from "preact";
import { BackButton } from "../common/BackButton";
import { Stepper } from "../common/Stepper";
import { TopBar } from "../common/TopBar";
import type { InstallState } from "../platform";
import { TestIds } from "../testIds";
import {
  NEW_WORDS_MAX,
  NEW_WORDS_MIN,
  parseTime,
  PRIVACY_POLICY_URL,
  REMINDER_HELP,
  SOURCE_CODE_URL,
  timeValue,
  type ReminderUi,
} from "./settingsState";

export interface SettingsContentProps {
  newWordsPerDay: number;
  busy: boolean;
  installState: InstallState;
  /** The Daily reminder section, or null while there is no reminder server. */
  reminder: ReminderUi | null;
  /** The short commit the build came from, or "dev". */
  build: string;
  onBack: () => void;
  onNewWordsPerDayChange: (value: number) => void;
  onExport: () => void;
  /** The file the user picked in the Import dialog. */
  onImport: (file: File) => void;
  onInstall: () => void;
  onReminderToggle: (wantOn: boolean) => void;
  onReminderTimeChange: (hour: number, minute: number) => void;
  onSendTest: () => void;
}

export function SettingsContent({
  newWordsPerDay,
  busy,
  installState,
  reminder,
  build,
  onBack,
  onNewWordsPerDayChange,
  onExport,
  onImport,
  onInstall,
  onReminderToggle,
  onReminderTimeChange,
  onSendTest,
}: SettingsContentProps) {
  const showInstall = installState === "prompt" || installState === "ios";
  return (
    <main class="screen settings">
      <TopBar title="Settings" navigation={<BackButton onClick={onBack} />} />

      {showInstall && (
        <>
          <section class="settings-section">
            <h2 class="section-title">Install</h2>
            {installState === "prompt" ? (
              <>
                <HelpText>
                  Install Tortoise Spelling so it opens like an app, works offline and is less likely to lose your words.
                </HelpText>
                <div>
                  <button type="button" class="button tonal" onClick={onInstall}>
                    Install
                  </button>
                </div>
              </>
            ) : (
              <HelpText>
                On iPhone or iPad, tap Share, then Add to Home Screen. It then opens like an app and is less likely
                to lose your words.
              </HelpText>
            )}
          </section>
          <hr />
        </>
      )}

      {reminder && (
        <>
          <section class="settings-section">
            <h2 class="section-title">Daily reminder</h2>
            <label class="setting-row">
              <span>Remind me daily</span>
              <input
                type="checkbox"
                role="switch"
                class="switch"
                data-testid={TestIds.SETTINGS_REMINDER_SWITCH}
                checked={reminder.on}
                disabled={reminder.support !== "supported"}
                onChange={(event) => onReminderToggle(event.currentTarget.checked)}
              />
            </label>
            <label class="setting-row">
              <span>Reminder time</span>
              <input
                type="time"
                class="time-input"
                data-testid={TestIds.SETTINGS_REMINDER_TIME_BUTTON}
                value={timeValue(reminder.hour, reminder.minute)}
                disabled={!reminder.on}
                onChange={(event) => {
                  const time = parseTime(event.currentTarget.value);
                  if (time) onReminderTimeChange(time.hour, time.minute);
                }}
              />
            </label>
            <div>
              <button type="button" class="text-button" onClick={onSendTest}>
                Send a test notification
              </button>
            </div>
            <HelpText>{REMINDER_HELP[reminder.support]}</HelpText>
          </section>
          <hr />
        </>
      )}

      <section class="settings-section">
        <h2 class="section-title">Practice</h2>
        <div class="setting-row">
          <span>New words per day</span>
          <Stepper
            value={newWordsPerDay}
            min={NEW_WORDS_MIN}
            max={NEW_WORDS_MAX}
            onChange={onNewWordsPerDayChange}
            testIds={{
              value: TestIds.SETTINGS_NEW_WORDS_VALUE,
              decrease: TestIds.SETTINGS_NEW_WORDS_DECREASE,
              increase: TestIds.SETTINGS_NEW_WORDS_INCREASE,
            }}
          />
        </div>
      </section>

      <hr />
      <section class="settings-section">
        <h2 class="section-title">Backup</h2>
        <HelpText>
          Your word list and its scheduling. Importing adds words you don't already have and leaves existing ones
          untouched.
        </HelpText>
        <HelpText>
          On the web, your words are kept in this browser on this device. A backup moves them to another browser or
          to the Android app.
        </HelpText>
        <div class="button-row">
          <button type="button" class="button tonal" disabled={busy} onClick={onExport}>
            Export
          </button>
          <label class={`button tonal ${busy ? "disabled" : ""}`.trim()} aria-disabled={busy}>
            Import
            <input
              type="file"
              class="sr-only"
              accept=".json,application/json,text/plain"
              disabled={busy}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                // Cleared so picking the same file again still fires a change.
                event.currentTarget.value = "";
                if (file) onImport(file);
              }}
            />
          </label>
        </div>
      </section>

      <hr />
      <section class="settings-section">
        <h2 class="section-title">About</h2>
        <p class="about-title">{`Tortoise Spelling for the web (${build})`}</p>
        <HelpText>
          Free and open source under the MIT licence. No ads, no accounts, no tracking: your words stay on this
          device.
        </HelpText>
        <div class="button-row">
          <a class="text-button" href={PRIVACY_POLICY_URL} target="_blank" rel="noopener">
            Privacy policy
          </a>
          <a class="text-button" href={SOURCE_CODE_URL} target="_blank" rel="noopener">
            Source code
          </a>
        </div>
      </section>
    </main>
  );
}

function HelpText({ children }: { children: ComponentChildren }) {
  return <p class="help-text">{children}</p>;
}
