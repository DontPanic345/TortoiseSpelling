import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  define: { __BUILD__: JSON.stringify("test") },
  test: {
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["fake-indexeddb/auto", "test/ui/setup.ts"],
  },
});
