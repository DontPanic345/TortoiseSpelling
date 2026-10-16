import { fakePush, type FakePush } from "../../src/debug/fakePush";
import type { InstallState, Platform } from "../../src/ui/platform";

export { fakePush, type FakePush };

/** A platform that records calls and returns what a test sets. */
export interface FakePlatform extends Platform {
  calls: string[];
  persisted: boolean;
  copyResult: boolean;
  saveResult: "saved" | "cancelled";
  /** Set to make `saveFile` throw. */
  saveError: Error | null;
  installed: InstallState;
  saved: { name: string; text: string }[];
  push: FakePush;
}

export function fakePlatform(): FakePlatform {
  const listeners = new Set<() => void>();
  const platform: FakePlatform = {
    calls: [],
    persisted: false,
    copyResult: true,
    saveResult: "saved",
    saveError: null,
    installed: "unavailable",
    saved: [],
    push: fakePush(),
    async copyText(text) {
      platform.calls.push(`copyText:${text}`);
      return platform.copyResult;
    },
    async saveFile(name, text) {
      platform.calls.push("saveFile");
      if (platform.saveError) throw platform.saveError;
      if (platform.saveResult === "saved") platform.saved.push({ name, text });
      return platform.saveResult;
    },
    async persistStorage() {
      platform.calls.push("persistStorage");
      return platform.persisted;
    },
    async storagePersisted() {
      return platform.persisted;
    },
    installState: () => platform.installed,
    onInstallStateChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async promptInstall() {
      platform.calls.push("promptInstall");
    },
  };
  return platform;
}
