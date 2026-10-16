import { describe, expect, it } from "vitest";
import { decodeBase64Url, encodeBase64Url } from "../src/base64url";
import { createSender, encryptPayload, parsePrivateJwk, publicKeyOf, vapidAuthorization } from "../src/webpush";
import type { SenderKeys } from "../src/webpush";
import type { Subscription } from "../src/schedule";
import { newVapidKey } from "./support";

// RFC 8291, Appendix A.
const PLAINTEXT = "V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24";
const AS_PUBLIC = "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
const AS_PRIVATE = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
const UA_PUBLIC = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
const AUTH_SECRET = "BTBZMqHH6r4Tts7J_aSIgg";
const SALT = "DGv6ra1nlYgDCS1FRnbzlw";
const BODY =
  "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";

function bytes(text: string): Uint8Array {
  return decodeBase64Url(text)!;
}

async function rfcSenderKeys(): Promise<SenderKeys> {
  const publicKey = bytes(AS_PUBLIC);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: AS_PRIVATE,
    x: encodeBase64Url(publicKey.slice(1, 33)),
    y: encodeBase64Url(publicKey.slice(33)),
  };
  const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, [
    "deriveBits",
  ]);
  return { privateKey, publicKey };
}

describe("encryptPayload", () => {
  it("gives RFC 8291 Appendix A's body byte for byte", async () => {
    const body = await encryptPayload(bytes(PLAINTEXT), UA_PUBLIC, AUTH_SECRET, {
      salt: bytes(SALT),
      senderKeys: await rfcSenderKeys(),
    });
    expect(encodeBase64Url(body)).toBe(BODY);
  });

  it("fails when a byte of the salt differs", async () => {
    const salt = bytes(SALT);
    salt[0] = salt[0]! ^ 1;
    const body = await encryptPayload(bytes(PLAINTEXT), UA_PUBLIC, AUTH_SECRET, {
      salt,
      senderKeys: await rfcSenderKeys(),
    });
    expect(encodeBase64Url(body)).not.toBe(BODY);
  });

  it("uses a fresh salt and sender key each time", async () => {
    const a = await encryptPayload(bytes(PLAINTEXT), UA_PUBLIC, AUTH_SECRET);
    const b = await encryptPayload(bytes(PLAINTEXT), UA_PUBLIC, AUTH_SECRET);
    expect(encodeBase64Url(a)).not.toBe(encodeBase64Url(b));
    expect(a.length).toBe(b.length);
  });

  it("rejects keys that aren't base64url", async () => {
    await expect(encryptPayload(bytes(PLAINTEXT), "not base64!", AUTH_SECRET)).rejects.toThrow();
  });
});

describe("vapidAuthorization", () => {
  it("signs a JWT that verifies with the public key", async () => {
    const jwk = await newVapidKey();
    const header = await vapidAuthorization(jwk, "https://fcm.googleapis.com", 1_000_000, "https://example.org/contact");

    const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header);
    expect(match).not.toBeNull();
    const [, head, claims, signature, k] = match!;
    expect(k).toBe(encodeBase64Url(publicKeyOf(jwk)));

    const text = (part: string) => JSON.parse(new TextDecoder().decode(bytes(part))) as unknown;
    expect(text(head!)).toEqual({ typ: "JWT", alg: "ES256" });
    expect(text(claims!)).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: 1_000_000 + 12 * 3600,
      sub: "https://example.org/contact",
    });

    const publicKey = await crypto.subtle.importKey(
      "raw",
      publicKeyOf(jwk),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      bytes(signature!),
      new TextEncoder().encode(`${head}.${claims}`),
    );
    expect(valid).toBe(true);
  });

  it("does not verify against another key", async () => {
    const header = await vapidAuthorization(await newVapidKey(), "https://x.example", 0, "s");
    const [, head, claims, signature] = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+)/.exec(header)!;
    const other = await crypto.subtle.importKey(
      "raw",
      publicKeyOf(await newVapidKey()),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      other,
      bytes(signature!),
      new TextEncoder().encode(`${head}.${claims}`),
    );
    expect(valid).toBe(false);
  });
});

describe("parsePrivateJwk", () => {
  it("rejects a key that isn't a P-256 private JWK", () => {
    expect(() => parsePrivateJwk("")).toThrow();
    expect(() => parsePrivateJwk('{"kty":"EC","crv":"P-256","x":"a","y":"b"}')).toThrow();
    expect(() => parsePrivateJwk('{"kty":"RSA"}')).toThrow();
  });
});

describe("createSender", () => {
  const row: Subscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    p256dh: UA_PUBLIC,
    auth: AUTH_SECRET,
    timeZone: "UTC",
    hour: 8,
    minute: 0,
    dueDay: 1,
    lastSentDay: null,
    lastTestAt: null,
    updatedAt: 0,
  };

  it("returns 0 when the request fails", async () => {
    const jwk = JSON.stringify(await newVapidKey());
    const original = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new TypeError("offline"))) as typeof fetch;
    try {
      expect(await createSender(jwk, "https://example.org", 0)(row, "reminder")).toBe(0);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("posts the encrypted message with the Web Push headers", async () => {
    const jwk = JSON.stringify(await newVapidKey());
    const original = globalThis.fetch;
    const calls: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = ((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(null, { status: 201 }));
    }) as typeof fetch;
    try {
      const send = createSender(jwk, "https://example.org", 0);
      expect(await send(row, "reminder")).toBe(201);
      expect(await send(row, "test")).toBe(201);
    } finally {
      globalThis.fetch = original;
    }
    const [reminder, test] = calls;
    expect(reminder!.url).toBe(row.endpoint);
    const headers = reminder!.init.headers as Record<string, string>;
    expect(headers["Content-Encoding"]).toBe("aes128gcm");
    expect(headers.TTL).toBe("43200");
    expect(headers.Urgency).toBe("normal");
    expect(headers.Topic).toBe("reminder");
    expect(headers.Authorization).toMatch(/^vapid t=/);
    expect((test!.init.headers as Record<string, string>).TTL).toBe("600");
    // One signature per audience, reused for the second message.
    expect((test!.init.headers as Record<string, string>).Authorization).toBe(headers.Authorization);
  });
});
