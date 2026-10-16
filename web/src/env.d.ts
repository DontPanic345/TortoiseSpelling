/// <reference types="vite/client" />

/** The short commit the build came from, or "dev"; set by `define` in vite.config.ts. */
declare const __BUILD__: string;

/** The reminder server's origin, or "" for none; set by `define` in vite.config.ts. */
declare const __PUSH_SERVER__: string;

interface Window {
  /** Set by public/compat.js when the browser is too old for the app. */
  __unsupported?: boolean;
}
