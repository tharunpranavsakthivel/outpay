/**
 * Static regression checks for legal copy and payment-adjacent disclaimers.
 */

import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readSource(relativePath: string): Promise<string> {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

describe("T-19 legal product surfaces", () => {
  it("ships substantive legal sections without the old placeholder marker", async () => {
    const pageSource = await readSource("src/views/LegalPage.tsx");
    const termsSource = await readSource("src/lib/legal/terms-of-service.ts");
    const privacySource = await readSource("src/lib/legal/privacy-policy.ts");

    expect(pageSource).not.toContain("[Placeholder");
    expect(termsSource).toContain("prohibited");
    expect(termsSource).toContain(
      "screen users and wallet addresses against sanctions and risk databases",
    );
    expect(privacySource).toContain("## 1. About this Privacy Policy");
    expect(privacySource).toContain("## 39. Contact and complaints");
    expect(privacySource).toContain("Data retention");
  });

  it("publishes the supplied full terms with one .tech contact address", async () => {
    const source = await readSource("src/lib/legal/terms-of-service.ts");
    const emailAddresses = source.match(/[A-Z0-9._%+-]+@outpay\.tech/gi) ?? [];

    expect(source).toContain("## 1. About Outpay and these Terms");
    expect(source).toContain("## 55. Contact");
    expect(source).not.toContain("outpay.dev");
    expect(source).not.toContain("security@outpay.tech");
    expect(source).not.toContain("support@outpay.tech");
    expect([...new Set(emailAddresses)]).toEqual(["legal@outpay.tech"]);
  });

  it("publishes the supplied full privacy policy with one .tech contact address", async () => {
    const source = await readSource("src/lib/legal/privacy-policy.ts");
    const emailAddresses = source.match(/[A-Z0-9._%+-]+@outpay\.tech/gi) ?? [];

    expect(source).not.toContain("outpay.dev");
    expect(source).not.toContain("security@outpay.tech");
    expect(source).not.toContain("support@outpay.tech");
    expect([...new Set(emailAddresses)]).toEqual(["legal@outpay.tech"]);
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
