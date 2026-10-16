import { encodeBase64Url } from "./base64url";
import type { SubscriptionService } from "./service";
import { parseEndpointBody, parseRegistration } from "./validate";
import { parsePrivateJwk, publicKeyOf } from "./webpush";

export interface ApiEnv {
  ALLOWED_ORIGINS: string;
  VAPID_PRIVATE_JWK?: string;
  ALLOW_LOCAL_PUSH?: string;
}

const MAX_BODY_BYTES = 4096;

function corsHeaders(request: Request, env: ApiEnv): Headers {
  const headers = new Headers();
  const origin = request.headers.get("Origin");
  if (origin !== null && env.ALLOWED_ORIGINS.split(",").includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return headers;
}

function respond(cors: Headers, status: number, body?: unknown): Response {
  const headers = new Headers(cors);
  if (body === undefined) return new Response(null, { status, headers });
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

/** The JSON body, or the response to send instead. */
async function readJson(request: Request): Promise<{ json: unknown } | { tooLarge: true } | { invalid: true }> {
  const declared = Number(request.headers.get("Content-Length"));
  if (declared > MAX_BODY_BYTES) return { tooLarge: true };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return { tooLarge: true };
  try {
    return { json: JSON.parse(text) as unknown };
  } catch {
    return { invalid: true };
  }
}

export async function handleRequest(
  request: Request,
  env: ApiEnv,
  service: SubscriptionService,
  now: number,
): Promise<Response> {
  const cors = corsHeaders(request, env);
  const { pathname } = new URL(request.url);
  const allowLocal = env.ALLOW_LOCAL_PUSH === "true";

  if (request.method === "OPTIONS") {
    if (cors.has("Access-Control-Allow-Origin")) {
      cors.set("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
      cors.set("Access-Control-Allow-Headers", "Content-Type");
      cors.set("Access-Control-Max-Age", "86400");
    }
    return respond(cors, 204);
  }

  if (request.method === "GET" && pathname === "/key") {
    try {
      const publicKey = publicKeyOf(parsePrivateJwk(env.VAPID_PRIVATE_JWK ?? ""));
      return respond(cors, 200, { publicKey: encodeBase64Url(publicKey) });
    } catch {
      return respond(cors, 503, { error: "The reminder key isn't set up yet." });
    }
  }

  const route = `${request.method} ${pathname}`;
  if (route !== "PUT /subscription" && route !== "DELETE /subscription" && route !== "POST /test") {
    return respond(cors, 404, { error: "Not found." });
  }

  const body = await readJson(request);
  if ("tooLarge" in body) return respond(cors, 413, { error: "The body is too large." });
  if ("invalid" in body) return respond(cors, 400, { error: "The body isn't JSON." });

  if (route === "PUT /subscription") {
    const parsed = parseRegistration(body.json, allowLocal);
    if (!parsed.ok) return respond(cors, 400, { error: parsed.error });
    const result = await service.register(parsed.value, now);
    return result === "ok" ? respond(cors, 204) : respond(cors, 503, { error: "The server is full." });
  }

  const endpoint = parseEndpointBody(body.json, allowLocal);
  if (!endpoint.ok) return respond(cors, 400, { error: endpoint.error });

  if (route === "DELETE /subscription") {
    await service.remove(endpoint.value);
    return respond(cors, 204);
  }

  switch (await service.test(endpoint.value, now)) {
    case "sent":
      return respond(cors, 204);
    case "unknown":
      return respond(cors, 404, { error: "Unknown subscription." });
    case "rate":
      return respond(cors, 429, { error: "Try again in a moment." });
    case "refused":
      return respond(cors, 502, { error: "The push service refused the message." });
  }
}
