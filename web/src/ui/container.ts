import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { Repository } from "../data/repository";
import type { Clock } from "../domain/clock";
import type { PushApi } from "../push/pushApi";
import type { PushPlatform } from "../push/pushPlatform";
import type { ReminderSync } from "../push/reminderSync";
import type { Platform } from "./platform";

/** What the screens reach for: the web's `AppContainer`. Tests render with a container of their own. */
export interface AppContainer {
  repository: Repository;
  clock: Clock;
  platform: Platform;
  /** How long a correct answer shows before the next word. */
  autoAdvanceMillis: number;
  /** The daily reminder's parts, or null while there is no reminder server to talk to. */
  reminders: { push: PushPlatform; api: PushApi; sync: ReminderSync } | null;
}

export const ContainerContext = createContext<AppContainer | null>(null);

export function useContainer(): AppContainer {
  const container = useContext(ContainerContext);
  if (!container) throw new Error("No AppContainer provided");
  return container;
}
