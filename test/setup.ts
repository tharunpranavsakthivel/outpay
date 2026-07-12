/**
 * Shared Vitest setup for Outpay tests.
 * Imports Testing Library's DOM matchers for component suites without
 * changing the default Node environment used by server and worker tests.
 */

import "@testing-library/jest-dom/vitest";

// Vitest runs under Node, so it does not load Bun's implicit `.env` files.
// These placeholders satisfy import-time configuration guards without ever
// reading or reusing application credentials.
process.env.BETTER_AUTH_SECRET ??= "outpay-vitest-only-auth-secret";
process.env.BETTER_AUTH_URL ??= "http://127.0.0.1:3001";
process.env.ALCHEMY_BASE_RPC_URL ??= "https://example.invalid/alchemy-test";
process.env.ALCHEMY_WEBHOOK_SIGNING_KEY ??= "outpay-vitest-only-alchemy-key";
process.env.ALCHEMY_NOTIFY_WEBHOOK_ID ??= "outpay-vitest-only-webhook";
process.env.CHAINSTACK_BASE_RPC_URL ??=
  "https://example.invalid/chainstack-test";
process.env.AWS_ENDPOINT_URL_S3 ??= "https://example.invalid/tigris-test";
process.env.TIGRIS_BUCKET_NAME ??= "outpay-vitest-only-bucket";
process.env.AWS_ACCESS_KEY_ID ??= "outpay-vitest-only-access-key";
process.env.AWS_SECRET_ACCESS_KEY ??= "outpay-vitest-only-secret-key";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL?.trim() ||
  "postgresql://outpay_test:outpay_test_password@127.0.0.1:55432/outpay_test";
const testDatabaseHost = new URL(testDatabaseUrl).hostname;

if (!new Set(["127.0.0.1", "localhost"]).has(testDatabaseHost)) {
  throw new Error(
    "Vitest requires TEST_DATABASE_URL to point to localhost or 127.0.0.1; refusing to use a remote database.",
  );
}

// Always override app database candidates inside the test process so a shell
// with production credentials cannot make unit tests connect to production.
process.env.DATABASE_URL = testDatabaseUrl;
delete process.env.DATABASE_PUBLIC_URL;
