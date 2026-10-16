import { useEffect, useState } from "preact/hooks";
import { NEW_WORDS_MAX, NEW_WORDS_MIN, type ReminderUi } from "./settingsState";
import { Snackbar, useSnackbar } from "../common/Snackbar";
import type { Permission } from "../../push/pushPlatform";
import { exportWords, importWords } from "../backupActions";
import { useContainer } from "../container";
import { changeReminderTime, sendTestReminder, turnOffReminder, turnOnReminder } from "../reminderActions";
import { back } from "../router";
import { useRefresh } from "../useRefresh";
import { SettingsContent } from "./SettingsContent";

export function SettingsScreen() {
  const container = useContainer();
  const { repository, platform, reminders } = container;
  const [newWordsPerDay, setNewWordsPerDay] = useState(10);
  const [busy, setBusy] = useState(false);
  const [installState, setInstallState] = useState(() => platform.installState());
  const [reminder, setReminder] = useState<(ReminderUi & { permission: Permission }) | null>(null);
  const snackbar = useSnackbar();

  useRefresh(repository, () => {
    void repository.settings().then(async (s) => {
      setNewWordsPerDay(s.newWordsPerDay);
      if (!reminders) return;
      const permission = await reminders.push.permission();
      setReminder({
        on: s.reminderEnabled && permission === "granted",
        support: reminders.push.support(),
        hour: s.reminderHour,
        minute: s.reminderMinute,
        permission,
      });
    });
  });
  useEffect(() => platform.onInstallStateChange(() => setInstallState(platform.installState())), [platform]);

  const whileBusy = async (work: () => Promise<string | null>) => {
    setBusy(true);
    try {
      const message = await work();
      if (message) snackbar.show(message);
    } finally {
      setBusy(false);
    }
  };

  const tell = async (work: Promise<string | null>) => {
    const message = await work;
    if (message) snackbar.show(message);
  };

  // Called straight from the tap: the permission prompt has to be the handler's first act.
  const onReminderToggle = (wantOn: boolean) => {
    if (!reminders) return;
    const given = { repository, reminders };
    void tell(wantOn ? turnOnReminder(given, reminder?.permission ?? "default") : turnOffReminder(given));
  };

  return (
    <>
      <SettingsContent
        newWordsPerDay={newWordsPerDay}
        busy={busy}
        installState={installState}
        reminder={reminder}
        build={__BUILD__}
        onBack={() => back({ name: "home" })}
        onNewWordsPerDayChange={(value) => {
          const clamped = Math.min(NEW_WORDS_MAX, Math.max(NEW_WORDS_MIN, value));
          setNewWordsPerDay(clamped);
          void repository.setNewWordsPerDay(clamped);
        }}
        onExport={() => void whileBusy(() => exportWords(container))}
        onImport={(file) => void whileBusy(() => importWords(container, file))}
        onInstall={() => void platform.promptInstall()}
        onReminderToggle={onReminderToggle}
        onReminderTimeChange={(hour, minute) => {
          if (reminders) void tell(changeReminderTime({ repository, reminders }, hour, minute));
        }}
        onSendTest={() => {
          if (reminders) void tell(sendTestReminder({ repository, reminders }, reminder?.on ?? false));
        }}
      />
      <Snackbar message={snackbar.current} />
    </>
  );
}
