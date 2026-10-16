import { defineConfig } from "vite";
import { csp } from "./build/csp.ts";

export default defineConfig({
  base: "./",
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  build: { target: ["es2022", "safari16.4"] },
  define: { __BUILD__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? "dev") },
  plugins: [csp()],
});
