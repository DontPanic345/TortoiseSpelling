import type { Permission, PushPlatform, PushSubscriptionInfo, PushSupport } from "../../src/push/pushPlatform";
import type { InstallState, Platform } from "../../src/ui/platform";

/** A push platform that records calls and returns what a test sets. */
export interface FakePush extends PushPlatform {
  calls: string[];
  supported: PushSupport;
  granted: Permission;
  /** What the next `requestPermission` answers; the permission then becomes it. */
  answer: Permission;
  current: PushSubscriptionInfo | null;
  /** The keys given to `subscribe`, in order. */
  subscribedWith: string[];
  /** Set to make `subscribe` throw. */
  subscribeError: Error | null;
}

export function fakePush(): FakePush {
  let serial = 0;
  const push: FakePush = {
    calls: [],
    supported: "supported",
    granted: "default",
    answer: "granted",
    current: null,
    subscribedWith: [],
    subscribeError: null,
    support: () => push.supported,
    async permission() {
      return push.granted;
    },
    requestPermission() {
      push.calls.push("requestPermission");
      push.granted = push.answer;
      return Promise.resolve(push.answer);
    },
    async subscription() {
      return push.current;
    },
    async subscribe(publicKey) {
      push.calls.push("subscribe");
      if (push.subscribeError) throw push.subscribeError;
      push.subscribedWith.push(publicKey);
      serial++;
      push.current = { endpoint: `https://fcm.googleapis.com/fcm/send/${serial}`, p256dh: `p256dh-${serial}`, auth: `auth-${serial}` };
      return push.current;
    },
    async unsubscribe() {
      push.calls.push("unsubscribe");
      push.current = null;
    },
  };
  return push;
}

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
