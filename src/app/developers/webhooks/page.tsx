import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, createPageMetadata } from "@/lib/seo";
import MarketingDetailPage from "../../../views/MarketingDetailPage";

/** Route page for the developer webhook guide marketing page. */
export const metadata: Metadata = createPageMetadata({
  title: "Webhooks Guide | Verify USDC Payment Events",
  description:
    "Learn how to verify Outpay webhook signatures, handle retries idempotently, and fulfill orders from confirmed Base USDC payments.",
  path: "/developers/webhooks",
  keywords: [
    "USDC payment webhooks",
    "webhook signature verification",
    "stablecoin fulfillment events",
  ],
});

export default function WebhooksGuidePage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Developers", path: "/developers/webhooks" },
          { name: "Webhooks guide", path: "/developers/webhooks" },
        ])}
      />
      <MarketingDetailPage slug="webhooks" />
    </>
  );
}
