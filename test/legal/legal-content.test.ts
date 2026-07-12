/**
 * Static regression checks for legal copy and payment-adjacent disclaimers.
 */

import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");

async function readSource(relativePath: string): Promise<string> {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

describe("T-19 legal product surfaces", () => {
  it("ships substantive legal sections without the old placeholder marker", async () => {
    const source = await readSource("src/views/LegalPage.tsx");

    expect(source).not.toContain("[Placeholder");
    expect(source).toContain("Data retention");
    expect(source).toContain("prohibited");
    expect(source).toContain("sanctions screening");
  });

  it("includes the shared non-custodial disclaimer on every required surface", async () => {
    const relativePaths = [
      "src/views/CustomerCheckout.tsx",
      "src/views/PaymentReceipt.tsx",
      "src/views/AuthScreens.tsx",
      "src/components/layout/MarketingFooter.tsx",
    ];

    for (const relativePath of relativePaths) {
      const source = await readSource(relativePath);
      expect(source).toContain("NON_CUSTODIAL_DISCLAIMER");
    }
  });

  it("keeps irreversible-payment and signup acceptance safeguards in the UI", async () => {
    const checkout = await readSource("src/views/CustomerCheckout.tsx");
    const auth = await readSource("src/views/AuthScreens.tsx");

    expect(checkout).toContain("Cryptocurrency payments are irreversible.");
    expect(auth).toContain("Accept the Terms of Service and Privacy Policy");
    expect(auth).toContain("termsAccepted");
  });

  it("ships a reversible migration for both acceptance timestamps", async () => {
    const up = await readSource(
      "db/migrations/0009_legal_acceptance_tracking.up.sql",
    );
    const down = await readSource(
      "db/migrations/0009_legal_acceptance_tracking.down.sql",
    );

    expect(up).toContain("privacy_accepted_at");
    expect(up).toContain("terms_accepted_at");
    expect(down).toContain("drop column if exists privacy_accepted_at");
    expect(down).toContain("drop column if exists terms_accepted_at");
  });
});
