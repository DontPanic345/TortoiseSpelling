import { useEffect } from "preact/hooks";
import { ContainerContext, type AppContainer } from "./ui/container";
import { Snackbar, useSnackbar } from "./ui/common/Snackbar";
import { TopBar } from "./ui/common/TopBar";
import { BackButton } from "./ui/common/BackButton";
import { CompletionScreen } from "./ui/complete/CompletionScreen";
import { HomeScreen } from "./ui/home/HomeScreen";
import { back, routeHash, useRoute, type Route } from "./ui/router";

const TITLES: Record<Route["name"], string> = {
  home: "Tortoise Spelling",
  review: "Review",
  practice: "Extra practice",
  completion: "All done",
  add: "Add word",
  edit: "Edit word",
  words: "All words",
  settings: "Settings",
};

/** Stands in for each screen until its build step lands. */
function Placeholder({ route }: { route: Route }) {
  return (
    <main class="screen" data-route={route.name}>
      <TopBar
        title={TITLES[route.name]}
        navigation={route.name === "home" ? undefined : <BackButton onClick={() => back({ name: "home" })} />}
      />
    </main>
  );
}

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case "home":
      return <HomeScreen />;
    case "completion":
      return <CompletionScreen />;
    default:
      return <Placeholder route={route} />;
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
