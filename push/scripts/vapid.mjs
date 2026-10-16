// Prints a new VAPID key pair as a P-256 private JWK (with d, x and y) on stdout, for
// `wrangler secret put VAPID_PRIVATE_JWK`. Nothing else is printed, so it can be piped.
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
const { kty, crv, d, x, y } = jwk;
process.stdout.write(JSON.stringify({ kty, crv, d, x, y }));
