import type { InstallState, Platform } from "./platform";

/** Chrome's install prompt event, which lib.dom doesn't type. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

function isIos(): boolean {
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return true;
  // An iPad can report itself as a Mac, with touch points.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function touchFirst(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

function download(name: string, file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The real browser behind [Platform]. The only code that touches `navigator`. */
export function browserPlatform(): Platform {
  let deferred: BeforeInstallPromptEvent | null = null;
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    changed();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    changed();
  });

  return {
    async copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    },

    async saveFile(name, text) {
      const file = new File([text], name, { type: "application/json" });
      if (touchFirst() && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: name });
          return "saved";
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
          // Safari refuses a share that is no longer part of the tap; the download still works.
        }
      }
      download(name, file);
      return "saved";
    },

    async persistStorage() {
      return (await navigator.storage?.persist?.()) ?? false;
    },

    async storagePersisted() {
      return (await navigator.storage?.persisted?.()) ?? false;
    },

    installState(): InstallState {
      if (isStandalone()) return "installed";
      if (deferred) return "prompt";
      return isIos() ? "ios" : "unavailable";
    },

    onInstallStateChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async promptInstall() {
      const event = deferred;
      if (!event) return;
      await event.prompt();
      deferred = null;
      changed();
    },
  };
}

/** Registers the service worker once the page has loaded, where the browser has them. */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  const register = () => void navigator.serviceWorker.register("./sw.js");
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
}
