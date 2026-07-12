/**
 * Vitest configuration for Outpay's unit and integration-adjacent suites.
 * Exposes the `@/*` source alias, keeps tests in the repository test tree,
 * and maps the existing Bun test imports to the Vitest compatibility module.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^bun:test$/,
        replacement: path.resolve(rootDirectory, "test/bun-test-compat.ts"),
      },
      { find: "@", replacement: path.resolve(rootDirectory, "src") },
    ],
  },
  test: {
    environment: "node",
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    setupFiles: [path.resolve(rootDirectory, "test/setup.ts")],
    passWithNoTests: false,
    reporters: ["default"],
  },
});
