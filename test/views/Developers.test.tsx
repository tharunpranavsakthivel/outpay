// @vitest-environment jsdom
/**
 * Regression tests for external developer-documentation links.
 * Ensures each documentation card exposes the authoritative Outpay resource.
 */

import { describe, expect, it } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import type { DevelopersPageData } from "@/lib/dashboard/types";
import Developers from "@/views/Developers";

/**
 * Builds the minimum schema-backed data required by the Developers view.
 *
 * @returns {DevelopersPageData} Stable merchant data for isolated rendering.
 */
function buildDevelopersData(): DevelopersPageData {
  return {
    apiKeys: [],
    lastWebhookPayload: "{}",
    merchant: {
      description: null,
      logoUrl: null,
      merchantId: "merchant_123",
      publicSlug: "test-store",
      role: "owner",
      status: "active",
      storeName: "Test Store",
      supportEmail: null,
      unreadNotifications: 0,
      userAvatarColor: null,
      userFullName: "Test User",
      verificationStatus: "verified",
    },
    webhookDeliveries: [],
    webhookSecretPrefix: null,
    webhookStatus: null,
    webhookUrl: null,
  };
}

/**
 * Renders the Developers view with its required toast context.
 *
 * @returns {void} The rendered UI is queried through Testing Library's screen.
 */
function renderDevelopers(): void {
  render(
    <ToastProvider>
      <Developers initialData={buildDevelopersData()} />
    </ToastProvider>,
  );
}

describe("Developers documentation links", () => {
  it("links each documentation card to the authoritative Outpay guide", () => {
    renderDevelopers();
    fireEvent.click(screen.getByRole("button", { name: "Docs" }));

    expect(
      screen.getByRole("link", { name: /API reference/i }),
    ).toHaveAttribute(
      "href",
      "https://docs.outpay.tech/docs/api-reference/overview",
    );
    expect(
      screen.getByRole("link", { name: /Webhook signature verification/i }),
    ).toHaveAttribute(
      "href",
      "https://docs.outpay.tech/docs/webhooks/verification",
    );
    expect(
      screen.getByRole("link", { name: /Base network & USDC/i }),
    ).toHaveAttribute(
      "href",
      "https://docs.outpay.tech/docs/api-reference/schemas",
    );
  });
});
