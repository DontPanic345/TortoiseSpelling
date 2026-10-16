import { render } from "preact";
import { App } from "./app";
import "./styles.css";
import { openDatabase } from "./data/db";
import { createRepository } from "./data/repository";
import { installSeedHook } from "./debug/seedHook";
import { deviceClock } from "./domain/clock";
import { browserPlatform, registerServiceWorker } from "./ui/browserPlatform";
import type { AppContainer } from "./ui/container";

const AUTO_ADVANCE_MILLIS = 1100;

async function start(root: HTMLElement): Promise<void> {
  if (window.__unsupported) return;
  let onVersionChange = () => {};
  let container: AppContainer;
  try {
    const db = await openDatabase(undefined, () => onVersionChange());
    container = {
      repository: createRepository({ db }),
      clock: deviceClock,
      platform: browserPlatform(),
      autoAdvanceMillis: AUTO_ADVANCE_MILLIS,
    };
  } catch {
    root.textContent =
      "Tortoise Spelling can't store words in this browser. Check that it isn't blocking site data for this page.";
    return;
  }
  if (import.meta.env.MODE === "e2e") installSeedHook(container);
  const draw = (updatedInAnotherTab: boolean) =>
    render(<App container={container} updatedInAnotherTab={updatedInAnotherTab} />, root);
  onVersionChange = () => draw(true);
  draw(false);
  if (import.meta.env.PROD) registerServiceWorker();
}

const root = document.getElementById("app");
if (root) void start(root);
