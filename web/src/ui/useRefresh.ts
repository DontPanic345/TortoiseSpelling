import { useEffect, useRef } from "preact/hooks";
import type { Repository } from "../data/repository";

/**
 * Calls `load` on mount, after every repository write and when the page becomes visible
 * again (Android's `ON_RESUME`, so counts move with the clock across midnight).
 */
export function useRefresh(repository: Repository, load: () => void): void {
  const latest = useRef(load);
  latest.current = load;
  useEffect(() => {
    const run = () => latest.current();
    run();
    const stop = repository.subscribe(run);
    const onVisibility = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [repository]);
}
