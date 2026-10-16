export type PushSupport = "supported" | "needs-install" | "unsupported";
export type Permission = "granted" | "denied" | "default";

export interface PushSubscriptionInfo {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** The push half of the platform, implemented for the page and for the service worker. */
export interface PushPlatform {
  support(): PushSupport;
  permission(): Promise<Permission>;
  /** Page only. Call it first thing in a tap, before any `await`. */
  requestPermission(): Promise<Permission>;
  subscription(): Promise<PushSubscriptionInfo | null>;
  subscribe(publicKey: string): Promise<PushSubscriptionInfo>;
  unsubscribe(): Promise<void>;
}

/** The subscription's address and the two keys the server encrypts to. */
export function describeSubscription(subscription: PushSubscription): PushSubscriptionInfo {
  const { keys } = subscription.toJSON();
  return { endpoint: subscription.endpoint, p256dh: keys?.p256dh ?? "", auth: keys?.auth ?? "" };
}
