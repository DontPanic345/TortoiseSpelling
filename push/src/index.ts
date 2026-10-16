import { handleRequest } from "./api";
import type { Env } from "./env";
import type { SubscriptionService } from "./service";

export { Subscriptions } from "./subscriptions";

function subscriptions(env: Env): SubscriptionService {
  return env.SUBSCRIPTIONS.get(env.SUBSCRIPTIONS.idFromName("all"));
}

export default {
  fetch(request, env) {
    return handleRequest(request, env, subscriptions(env), Date.now());
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(subscriptions(env).tick(controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
