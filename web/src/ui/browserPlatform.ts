import { decodeBase64Url } from "../push/base64url";
import { describeSubscription, type Permission, type PushPlatform, type PushSupport } from "../push/pushPlatform";
import { chooseVoice, SPEECH_RATE } from "../domain/speech";
import type { InstallState, Platform } from "./platform";
import type { SpeechPlatform } from "./speechPlatform";

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

function pushPlatform(installState: () => InstallState): PushPlatform {
  const registration = () => navigator.serviceWorker.getRegistration();

  return {
    support(): PushSupport {
      if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "supported";
      return installState() === "ios" ? "needs-install" : "unsupported";
    },

    async permission() {
      return Notification.permission as Permission;
    },

    requestPermission() {
      return Notification.requestPermission() as Promise<Permission>;
    },

    async subscription() {
      const subscription = await (await registration())?.pushManager.getSubscription();
      return subscription ? describeSubscription(subscription) : null;
    },

    async subscribe(publicKey) {
      const ready = await navigator.serviceWorker.ready;
      return describeSubscription(
        await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeBase64Url(publicKey) }),
      );
    },

    async unsubscribe() {
      await (await (await registration())?.pushManager.getSubscription())?.unsubscribe();
    },
  };
}

/** Speaks with `speechSynthesis`, using only voices that run on the device so nothing is sent away. */
function speechPlatform(): SpeechPlatform {
  const synth = typeof speechSynthesis === "undefined" ? null : speechSynthesis;
  const listeners = new Set<() => void>();
  let voice: SpeechSynthesisVoice | null = null;

  const choose = () => {
    const local = synth ? synth.getVoices().filter((candidate) => candidate.localService) : [];
    const index = chooseVoice(
      local.map((candidate) => candidate.lang),
      [...navigator.languages],
    );
    const chosen = index === null ? null : (local[index] ?? null);
    if (chosen === voice) return;
    voice = chosen;
    listeners.forEach((listener) => listener());
  };

  // Voices load asynchronously and Safari may never fire the event, so also look once now.
  synth?.addEventListener("voiceschanged", choose);
  choose();

  return {
    ready: () => voice !== null,

    onReadyChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    speak(text) {
      if (!synth || !voice) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = SPEECH_RATE;
      synth.cancel();
      synth.speak(utterance);
    },
  };
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

  const installState = (): InstallState => {
    if (isStandalone()) return "installed";
    if (deferred) return "prompt";
    return isIos() ? "ios" : "unavailable";
  };

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

    installState,

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

    push: pushPlatform(installState),

    speech: speechPlatform(),
  };
}

/** Registers the service worker once the page has loaded, where the browser has them. */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  const register = () => void navigator.serviceWorker.register("./sw.js");
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
}
