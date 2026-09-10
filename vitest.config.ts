import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    server: {
      deps: {
        inline: ["@electric-sql/pglite", "pglite-prisma-adapter"],
      },
    },
  },
});
