/**
 * Registers a payout wallet address on the configured Alchemy Address Activity
 * webhook so provider webhooks can track real-time Base transfer activity.
 */

import { addAlchemyWebhookAddresses } from "../src/lib/providers/alchemy";

/**
 * CLI entrypoint.
 *
 * Parameters:
 * - process.argv[2]: Wallet address to register on the Alchemy webhook.
 *
 * Returns:
 * - Resolves when the address registration request completes successfully.
 */
async function main(): Promise<void> {
  const address = process.argv[2]?.trim();

  if (!address) {
    throw new Error(
      "Usage: bun scripts/add-alchemy-address.ts <base-wallet-address>",
    );
  }

  const result = await addAlchemyWebhookAddresses([address]);

  console.info(
    JSON.stringify({
      address,
      addressCount: result.addressCount,
      level: "info",
      message: "Alchemy webhook address registered",
      module: "scripts/add-alchemy-address",
      timestamp: new Date().toISOString(),
      webhookId: result.webhookId,
    }),
  );
}

void main().catch((error) => {
  console.error(
    JSON.stringify({
      error:
        error instanceof Error ? error.message : "Unknown Alchemy script error",
      level: "error",
      message: "Alchemy webhook address registration failed",
      module: "scripts/add-alchemy-address",
      timestamp: new Date().toISOString(),
    }),
  );
  process.exitCode = 1;
});
