import type { Subscriptions } from "./subscriptions";

export interface Env {
  SUBSCRIPTIONS: DurableObjectNamespace<Subscriptions>;
  ALLOWED_ORIGINS: string;
  VAPID_SUBJECT: string;
  /** A secret: the P-256 private JWK from `scripts/vapid.mjs`. */
  VAPID_PRIVATE_JWK?: string;
  /** Set only by the smoke script, so subscriptions may point at `localhost`. */
  ALLOW_LOCAL_PUSH?: string;
}
