/**
 * Playwright configuration for browser-level smoke and regression tests.
 * Starts the local Next.js app on the repository's documented development
 * port and never injects application or production database credentials.
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run dev",
    reuseExistingServer: !process.env.CI,
    url: "http://127.0.0.1:3001",
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
