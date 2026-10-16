import { defineConfig } from "vite";
import { csp } from "./build/csp.ts";
import { precache } from "./build/precache.ts";
import { PUSH_SERVER } from "./src/push/server.ts";

// The smoke build points at a closed port, so the reminder section shows and every request fails.
const pushServer = process.env.PUSH_SERVER_OVERRIDE ?? PUSH_SERVER;
const target = ["es2022", "safari16.4"];
const define = { __PUSH_SERVER__: JSON.stringify(pushServer) };

export default defineConfig({
  base: "./",
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  build: { target },
  define: { __BUILD__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? "dev"), ...define },
  plugins: [csp(pushServer), precache({ entry: "src/sw/sw.ts", target, define })],
});
