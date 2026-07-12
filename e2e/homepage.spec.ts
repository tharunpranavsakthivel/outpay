/**
 * Browser smoke coverage for the public marketing entry point.
 * The test intentionally avoids authenticated or database-backed routes so it
 * can run with disposable local configuration in CI.
 */

import { expect, test } from "@playwright/test";

test("loads the public homepage", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Outpay/i);
  await expect(page.getByRole("main")).toBeVisible();
});
