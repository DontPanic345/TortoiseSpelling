import type { Permission, PushPlatform, PushSubscriptionInfo, PushSupport } from "../push/pushPlatform";

/** A push platform that records calls and returns what a test sets; the e2e build uses it too. */
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
