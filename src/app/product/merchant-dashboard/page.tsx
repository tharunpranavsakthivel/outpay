import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, createPageMetadata } from "@/lib/seo";
import MarketingDetailPage from "../../../views/MarketingDetailPage";

/** Route page for the merchant dashboard product detail page. */
export const metadata: Metadata = createPageMetadata({
  title: "Stablecoin Payment Dashboard for Merchants",
  description:
    "Track USDC checkout status, payment volume, webhook delivery, and reconciliation context in one merchant operations dashboard.",
  path: "/product/merchant-dashboard",
  keywords: [
    "stablecoin payment dashboard",
    "USDC merchant dashboard",
    "crypto payment operations",
  ],
});

export default function MerchantDashboardPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Product", path: "/product" },
          { name: "Merchant dashboard", path: "/product/merchant-dashboard" },
        ])}
      />
      <MarketingDetailPage slug="merchant-dashboard" />
    </>
  );
}
