import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, createPageMetadata } from "@/lib/seo";
import MarketingDetailPage from "../../../views/MarketingDetailPage";

/** Route page for the developer API reference marketing page. */
export const metadata: Metadata = createPageMetadata({
  title: "API Reference | USDC Checkout Sessions",
  description:
    "Use Outpay's REST API to create hosted USDC checkout sessions, read payment status, and connect backend fulfillment on Base.",
  path: "/developers/api-reference",
  keywords: [
    "USDC checkout API",
    "stablecoin payments API",
    "crypto checkout REST API",
  ],
});

export default function ApiReferencePage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Developers", path: "/developers/api-reference" },
          { name: "API reference", path: "/developers/api-reference" },
        ])}
      />
      <MarketingDetailPage slug="api-reference" />
    </>
  );
}
