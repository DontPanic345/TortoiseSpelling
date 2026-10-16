import { decodeBase64Url, encodeBase64Url } from "./base64url";
import type { Subscription } from "./schedule";

export type PushKind = "reminder" | "test";

export interface EcPrivateJwk {
  kty: "EC";
  crv: "P-256";
  d: string;
  x: string;
  y: string;
}

export interface SenderKeys {
  privateKey: CryptoKey;
  /** The 65-byte uncompressed public point. */
  publicKey: Uint8Array;
}

const encoder = new TextEncoder();
const VAPID_LIFETIME_SECONDS = 12 * 60 * 60;
const RECORD_SIZE = 4096;
const PUSH_TIMEOUT_MILLIS = 10_000;
const TTL_SECONDS: Record<PushKind, number> = { reminder: 43_200, test: 600 };

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

/** The 65-byte uncompressed public point of a private JWK. */
export function publicKeyOf(jwk: EcPrivateJwk): Uint8Array {
  const x = decodeBase64Url(jwk.x);
  const y = decodeBase64Url(jwk.y);
  if (x?.length !== 32 || y?.length !== 32) throw new Error("The VAPID key isn't a P-256 key.");
  return concat(new Uint8Array([0x04]), x, y);
}

export function parsePrivateJwk(json: string): EcPrivateJwk {
  const jwk = JSON.parse(json) as Partial<EcPrivateJwk>;
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d || !jwk.x || !jwk.y) {
    throw new Error("The VAPID key isn't a P-256 private JWK.");
  }
  return { kty: jwk.kty, crv: jwk.crv, d: jwk.d, x: jwk.x, y: jwk.y };
}

/** The `Authorization` header of RFC 8292: `vapid t=<ES256 JWT>, k=<public key>`. */
export async function vapidAuthorization(
  jwk: EcPrivateJwk,
  audience: string,
  nowSeconds: number,
  subject: string,
): Promise<string> {
  const part = (value: unknown) => encodeBase64Url(encoder.encode(JSON.stringify(value)));
  const signingInput =
    part({ typ: "JWT", alg: "ES256" }) +
    "." +
    part({ aud: audience, exp: nowSeconds + VAPID_LIFETIME_SECONDS, sub: subject });
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(signingInput)),
  );
  return `vapid t=${signingInput}.${encodeBase64Url(signature)}, k=${encodeBase64Url(publicKeyOf(jwk))}`;
}

async function randomSenderKeys(): Promise<SenderKeys> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const publicKey = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  return { privateKey: pair.privateKey, publicKey };
}

/**
 * The body of an RFC 8291 `aes128gcm` push message: RFC 8188's header (salt, record size,
 * the sender's public key) and one record holding the plaintext and the 0x02 delimiter.
 * `salt` and `senderKeys` are random unless a test passes the RFC's own.
 */
export async function encryptPayload(
  plaintext: Uint8Array,
  p256dh: string,
  auth: string,
  { salt, senderKeys }: { salt?: Uint8Array; senderKeys?: SenderKeys } = {},
): Promise<Uint8Array> {
  const uaPublic = decodeBase64Url(p256dh);
  const authSecret = decodeBase64Url(auth);
  if (uaPublic === null || authSecret === null) throw new Error("The subscription keys aren't base64url.");
  const sender = senderKeys ?? (await randomSenderKeys());
  const recordSalt = salt ?? crypto.getRandomValues(new Uint8Array(16));

  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  // The Workers typings spell the `public` member `$public`; the runtime wants `public`.
  const ecdh = { name: "ECDH", public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(ecdh, sender.privateKey, 256));
  const keyInfo = concat(encoder.encode("WebPush: info\0"), uaPublic, sender.publicKey);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(recordSalt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(recordSalt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const record = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(plaintext, new Uint8Array([0x02]))),
  );

  const header = new Uint8Array(21);
  header.set(recordSalt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = sender.publicKey.length;
  return concat(header, sender.publicKey, record);
}

export interface PushSender {
  (row: Subscription, kind: PushKind): Promise<number>;
}

/**
 * A sender for one tick or request: signs once per push-service origin and sends each
 * message, returning the push service's status, or 0 when the request failed.
 */
export function createSender(jwkJson: string, subject: string, nowMillis: number): PushSender {
  const jwk = parsePrivateJwk(jwkJson);
  const nowSeconds = Math.floor(nowMillis / 1000);
  const authorizations = new Map<string, Promise<string>>();

  return async (row, kind) => {
    try {
      const audience = new URL(row.endpoint).origin;
      let authorization = authorizations.get(audience);
      if (authorization === undefined) {
        authorization = vapidAuthorization(jwk, audience, nowSeconds, subject);
        authorizations.set(audience, authorization);
      }
      const body = await encryptPayload(encoder.encode(JSON.stringify({ kind })), row.p256dh, row.auth);
      const response = await fetch(row.endpoint, {
        method: "POST",
        headers: {
          Authorization: await authorization,
          "Content-Encoding": "aes128gcm",
          "Content-Type": "application/octet-stream",
          TTL: String(TTL_SECONDS[kind]),
          Urgency: "normal",
          Topic: "reminder",
        },
        body,
        signal: AbortSignal.timeout(PUSH_TIMEOUT_MILLIS),
      });
      await response.body?.cancel();
      return response.status;
    } catch {
      return 0;
    }
  };
}
