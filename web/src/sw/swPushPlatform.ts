import { describeSubscription, type Permission, type PushPlatform } from "../push/pushPlatform";
import { decodeBase64Url } from "../push/base64url";

/** The push half of the platform, from inside the service worker. */
export function swPushPlatform(registration: ServiceWorkerRegistration): PushPlatform {
  const permission = async (): Promise<Permission> => {
    const state = await registration.pushManager.permissionState({ userVisibleOnly: true });
    return state === "prompt" ? "default" : state;
  };

  return {
    support: () => "supported",
    permission,
    requestPermission: permission,

    async subscription() {
      const subscription = await registration.pushManager.getSubscription();
      return subscription ? describeSubscription(subscription) : null;
    },

    async subscribe(publicKey) {
      return describeSubscription(
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeBase64Url(publicKey),
        }),
      );
    },

    async unsubscribe() {
      await (await registration.pushManager.getSubscription())?.unsubscribe();
    },
  };
}
