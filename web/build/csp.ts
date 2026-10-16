import type { Plugin } from "vite";

/** Every fetch, script, style, image and worker is limited to the app's own origin. */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");

/**
 * Adds the policy to the built index.html. The dev server injects CSS through `<style>`
 * elements, which the policy would block, so it is for builds only.
 */
export function csp(): Plugin {
  return {
    name: "tortoise-csp",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: CONTENT_SECURITY_POLICY },
        injectTo: "head-prepend",
      },
    ],
  };
}
