/** The body of `PUT /subscription`; `push/src/validate.ts` has the server's twin. */
export interface Registration {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  timeZone: string;
  hour: number;
  minute: number;
  dueDay: number | null;
}

export class PushApiError extends Error {
  constructor(readonly status: number) {
    super(`The reminder server answered ${status}`);
  }
}

export interface PushApi {
  publicKey(): Promise<string>;
  register(registration: Registration): Promise<void>;
  unregister(endpoint: string): Promise<void>;
  test(endpoint: string): Promise<void>;
}

/** The reminder server's client. Every call throws `PushApiError` on a non-2xx answer. */
export function createPushApi(origin: string, fetcher: typeof fetch): PushApi {
  async function call(method: string, path: string, body?: unknown): Promise<Response> {
    const response = await fetcher(`${origin}${path}`, {
      method,
      keepalive: true,
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new PushApiError(response.status);
    return response;
  }

  return {
    async publicKey() {
      const { publicKey } = (await (await call("GET", "/key")).json()) as { publicKey: string };
      return publicKey;
    },
    async register(registration) {
      await call("PUT", "/subscription", registration);
    },
    async unregister(endpoint) {
      await call("DELETE", "/subscription", { endpoint });
    },
    async test(endpoint) {
      await call("POST", "/test", { endpoint });
    },
  };
}
