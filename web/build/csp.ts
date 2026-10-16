import type { Plugin } from "vite";

/**
 * Every fetch, script, style, image and worker is limited to the app's own origin, plus the
 * reminder server's when there is one.
 */
export function contentSecurityPolicy(pushServer: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    pushServer === "" ? "connect-src 'self'" : `connect-src 'self' ${pushServer}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join("; ");
}

/**
 * Adds the policy to the built index.html. The dev server injects CSS through `<style>`
 * elements, which the policy would block, so it is for builds only.
 */
export function csp(pushServer: string): Plugin {
  return {
    name: "tortoise-csp",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: contentSecurityPolicy(pushServer) },
        injectTo: "head-prepend",
      },
    ],
  };
}
