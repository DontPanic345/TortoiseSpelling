import { PushApiError, type PushApi, type Registration } from "../push/pushApi";

/** A reminder server that records calls and fails when told to; the e2e build uses it too. */
export interface FakePushApi extends PushApi {
  calls: string[];
  registered: Registration[];
  publicKeyValue: string;
  /** Set to make every call throw this. */
  failure: Error | null;
  /** The status `test` answers, or 0 for success. */
  testStatus: number;
}

export function fakePushApi(): FakePushApi {
  const api: FakePushApi = {
    calls: [],
    registered: [],
    publicKeyValue: "server-key-1",
    failure: null,
    testStatus: 0,
    async publicKey() {
      api.calls.push("publicKey");
      if (api.failure) throw api.failure;
      return api.publicKeyValue;
    },
    async register(registration) {
      api.calls.push("register");
      if (api.failure) throw api.failure;
      api.registered.push(registration);
    },
    async unregister(endpoint) {
      api.calls.push(`unregister:${endpoint}`);
      if (api.failure) throw api.failure;
    },
    async test(endpoint) {
      api.calls.push(`test:${endpoint}`);
      if (api.failure) throw api.failure;
      if (api.testStatus !== 0) throw new PushApiError(api.testStatus);
    },
  };
  return api;
}
