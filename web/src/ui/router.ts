import { useEffect, useState } from "preact/hooks";

export type Route =
  | { name: "home" | "review" | "practice" | "completion" | "add" | "words" | "settings" }
  | { name: "edit"; id: number };

const SIMPLE_ROUTES = ["review", "practice", "completion", "add", "words", "settings"] as const;

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  const simple = SIMPLE_ROUTES.find((name) => name === path);
  if (simple) return { name: simple };
  const edit = /^edit\/(\d+)$/.exec(path);
  if (edit) {
    const id = Number(edit[1]);
    if (Number.isSafeInteger(id)) return { name: "edit", id };
  }
  return { name: "home" };
}

export function routeHash(route: Route): string {
  switch (route.name) {
    case "home":
      return "#/";
    case "edit":
      return `#/edit/${route.id}`;
    default:
      return `#/${route.name}`;
  }
}

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** How many entries the app has pushed on top of the one it was loaded at. */
function depth(): number {
  const state: unknown = history.state;
  const value = state && typeof state === "object" ? (state as { depth?: unknown }).depth : undefined;
  return typeof value === "number" ? value : 0;
}

/** pushState and replaceState fire neither `hashchange` nor `popstate`, so the router tells its own listeners. */
export function navigate(route: Route): void {
  history.pushState({ depth: depth() + 1 }, "", routeHash(route));
  notify();
}

export function replace(route: Route): void {
  history.replaceState({ depth: depth() }, "", routeHash(route));
  notify();
}

/** Goes back when the app pushed the current entry, and otherwise replaces it with [fallback]. */
export function back(fallback: Route): void {
  if (depth() > 0) {
    history.back();
  } else {
    replace(fallback);
  }
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const update = () => setHash(location.hash);
    listeners.add(update);
    window.addEventListener("popstate", update);
    update();
    return () => {
      listeners.delete(update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return parseRoute(hash);
}
