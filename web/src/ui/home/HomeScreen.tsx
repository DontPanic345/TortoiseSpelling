import { useEffect, useState } from "preact/hooks";
import { Snackbar, useSnackbar } from "../common/Snackbar";
import { exportWords } from "../backupActions";
import { useContainer } from "../container";
import type { Platform } from "../platform";
import { navigate } from "../router";
import { useRefresh } from "../useRefresh";
import { HomeContent } from "./HomeContent";
import { initialHomeState, loadHome, type HomeUiState } from "./homeState";

/** Platforms already asked to keep storage: the request is made once per page load. */
const asked = new WeakSet<Platform>();

export function HomeScreen() {
  const container = useContainer();
  const { repository, clock, platform } = container;
  const [state, setState] = useState<HomeUiState>(initialHomeState);
  const snackbar = useSnackbar();

  // Counts move with the clock and with sessions finished elsewhere, so they are re-read
  // on every write and when the page comes back, not only when the screen mounts.
  useRefresh(repository, () => void loadHome(repository, clock, platform).then(setState));

  const ready = !state.loading && state.totalWords > 0;
  useEffect(() => {
    if (!ready || asked.has(platform)) return;
    asked.add(platform);
    void platform.storagePersisted().then((persisted) => {
      if (!persisted) void platform.persistStorage();
    });
  }, [ready, platform]);

  const onExport = async () => {
    const message = await exportWords(container);
    if (message) snackbar.show(message);
  };

  return (
    <>
      <HomeContent
        state={state}
        onStartReview={() => navigate({ name: "review" })}
        onPracticeMore={() => navigate({ name: "practice" })}
        onAddWord={() => navigate({ name: "add" })}
        onOpenWords={() => navigate({ name: "words" })}
        onOpenSettings={() => navigate({ name: "settings" })}
        onExport={onExport}
      />
      <Snackbar message={snackbar.current} />
    </>
  );
}
