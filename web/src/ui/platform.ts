import type { PushPlatform } from "../push/pushPlatform";

export type InstallState = "installed" | "prompt" | "ios" | "unavailable";

/** Everything the screens need from the browser. Tests pass a fake; only browserPlatform.ts touches `navigator`. */
export interface Platform {
  copyText(text: string): Promise<boolean>;
  /** Throws on failure. */
  saveFile(name: string, text: string): Promise<"saved" | "cancelled">;
  persistStorage(): Promise<boolean>;
  storagePersisted(): Promise<boolean>;
  installState(): InstallState;
  onInstallStateChange(listener: () => void): () => void;
  promptInstall(): Promise<void>;
  push: PushPlatform;
}
