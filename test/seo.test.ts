/**
 * Unit coverage for Outpay's shared metadata and structured-data builders.
 * These tests are deterministic and do not make network or database calls.
 */

import { describe, expect, it } from "bun:test";
import {
  breadcrumbJsonLd,
  createPageMetadata,
  faqPageJsonLd,
  organizationJsonLd,
  productJsonLd,
  softwareApplicationJsonLd,
} from "@/lib/seo";

describe("Outpay SEO builders", () => {
  it("creates canonical, Open Graph, Twitter, and indexable metadata", () => {
    const metadata = createPageMetadata({
      title: "Pricing for USDC Checkout",
      description: "Clear pricing for a stablecoin checkout flow.",
      path: "/pricing",
    });

    expect(metadata.alternates?.canonical).toMatch(/\/pricing$/);
    expect(metadata.openGraph).toMatchObject({
      title: "Pricing for USDC Checkout",
      url: metadata.alternates?.canonical,
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  it("creates noindex metadata for private or ephemeral routes", () => {
    const metadata = createPageMetadata({
      title: "Payment Receipt",
      description: "Private receipt details.",
      path: "/receipt/payment_123",
      noIndex: true,
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("builds the required site-wide schemas without fabricated ratings", () => {
    expect(organizationJsonLd()).toMatchObject({
      "@type": "Organization",
      name: "Outpay",
    });
    expect(softwareApplicationJsonLd()).toMatchObject({
      "@type": "SoftwareApplication",
      applicationCategory: "BusinessApplication",
    });
    expect(productJsonLd()).not.toHaveProperty("aggregateRating");
  });

  it("builds breadcrumb and FAQ schemas from visible page content", () => {
    const breadcrumbs = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Pricing", path: "/pricing" },
    ]);
    const faq = faqPageJsonLd([
      { question: "Is there a free allowance?", answer: "Yes." },
    ]);

    expect(breadcrumbs.itemListElement).toHaveLength(2);
    expect(breadcrumbs.itemListElement[1]).toMatchObject({
      name: "Pricing",
      position: 2,
    });
    expect(faq.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: "Is there a free allowance?",
    });
  });
});
