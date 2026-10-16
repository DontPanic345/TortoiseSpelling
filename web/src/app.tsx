import { useEffect } from "preact/hooks";
import { ContainerContext, type AppContainer } from "./ui/container";
import { Snackbar, useSnackbar } from "./ui/common/Snackbar";
import { AddWordScreen } from "./ui/add/AddWordScreen";
import { CompletionScreen } from "./ui/complete/CompletionScreen";
import { HomeScreen } from "./ui/home/HomeScreen";
import { SettingsScreen } from "./ui/settings/SettingsScreen";
import { WordListScreen } from "./ui/words/WordListScreen";
import { ReviewScreen } from "./ui/review/ReviewScreen";
import { routeHash, useRoute, type Route } from "./ui/router";

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case "home":
      return <HomeScreen />;
    case "completion":
      return <CompletionScreen />;
    case "review":
    case "practice":
      return <ReviewScreen practiceMode={route.name === "practice"} />;
    case "add":
      return <AddWordScreen editingId={null} />;
    case "edit":
      return <AddWordScreen editingId={route.id} />;
    case "words":
      return <WordListScreen />;
    case "settings":
      return <SettingsScreen />;
  }
}

interface AppProps {
  container: AppContainer;
  /** Another tab upgraded the database; this one has stepped aside. */
  updatedInAnotherTab?: boolean;
}

export function App({ container, updatedInAnotherTab = false }: AppProps) {
  const route = useRoute();
  const snackbar = useSnackbar();

  useEffect(() => {
    if (updatedInAnotherTab) {
      snackbar.show("Tortoise Spelling was updated in another tab. Reload to keep going.", {
        label: "Reload",
        onClick: () => location.reload(),
      });
    }
  }, [updatedInAnotherTab, snackbar.show]);

  return (
    <ContainerContext.Provider value={container}>
      {/* Keyed by the route's hash, so entering #/review always mounts a fresh session. */}
      <Screen key={routeHash(route)} route={route} />
      <Snackbar message={snackbar.current} />
    </ContainerContext.Provider>
  );
}
