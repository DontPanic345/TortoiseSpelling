import { parsePrivateJwk } from "../src/webpush";
import type { EcPrivateJwk } from "../src/webpush";

export async function newVapidKey(): Promise<EcPrivateJwk> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  return parsePrivateJwk(JSON.stringify(jwk));
}
