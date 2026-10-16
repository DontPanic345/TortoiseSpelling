import { useEffect, useState } from "preact/hooks";
import { NEW_WORDS_MAX, NEW_WORDS_MIN } from "./settingsState";
import { Snackbar, useSnackbar } from "../common/Snackbar";
import { exportWords, importWords } from "../backupActions";
import { useContainer } from "../container";
import { back } from "../router";
import { useRefresh } from "../useRefresh";
import { SettingsContent } from "./SettingsContent";

export function SettingsScreen() {
  const container = useContainer();
  const { repository, platform } = container;
  const [newWordsPerDay, setNewWordsPerDay] = useState(10);
  const [busy, setBusy] = useState(false);
  const [installState, setInstallState] = useState(() => platform.installState());
  const snackbar = useSnackbar();

  useRefresh(repository, () => void repository.settings().then((s) => setNewWordsPerDay(s.newWordsPerDay)));
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

  return (
    <>
      <SettingsContent
        newWordsPerDay={newWordsPerDay}
        busy={busy}
        installState={installState}
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
      />
      <Snackbar message={snackbar.current} />
    </>
  );
}
