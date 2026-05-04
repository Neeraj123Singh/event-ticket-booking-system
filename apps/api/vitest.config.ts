import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    /** DB-backed suites share one server; avoid cross-file races on `events`. */
    fileParallelism: false,
  },
});
