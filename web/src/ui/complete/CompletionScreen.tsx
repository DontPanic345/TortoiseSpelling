import { useState } from "preact/hooks";
import { useContainer } from "../container";
import { initialHomeState, loadHome, type HomeUiState } from "../home/homeState";
import { back, navigate } from "../router";
import { useRefresh } from "../useRefresh";
import { CompletionPanel } from "./CompletionPanel";

/** Shown when a session runs out of words. Reads the numbers Home shows, so there is one source of truth. */
export function CompletionScreen() {
  const { repository, clock, platform } = useContainer();
  const [state, setState] = useState<HomeUiState>(initialHomeState);
  useRefresh(repository, () => void loadHome(repository, clock, platform).then(setState));

  return (
    <main class="screen completion-screen">
      {!state.loading && (
        <>
          <CompletionPanel
            reviewedCount={state.reviewedToday}
            streak={state.streak}
            nextDueDay={state.nextDueDay}
            today={state.today}
            onPracticeMore={() => navigate({ name: "practice" })}
          />
          <button type="button" class="button done-button" onClick={() => back({ name: "home" })}>
            Done
          </button>
        </>
      )}
    </main>
  );
}
