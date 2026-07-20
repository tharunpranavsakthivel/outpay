import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, createPageMetadata } from "@/lib/seo";
import MarketingDetailPage from "../../../views/MarketingDetailPage";

/** Route page for the developer quickstart marketing page. */
export const metadata: Metadata = createPageMetadata({
  title: "USDC Checkout Quickstart | Developers",
  description:
    "Create your first Outpay checkout, send the hosted payment link, and fulfill the order from a verified `checkout.paid` webhook on Base.",
  path: "/developers/quickstart",
  keywords: [
    "USDC checkout quickstart",
    "stablecoin payment integration",
    "Base payments developer guide",
  ],
});

export default function QuickstartPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Developers", path: "/developers/quickstart" },
          { name: "Quickstart", path: "/developers/quickstart" },
        ])}
      />
      <MarketingDetailPage slug="quickstart" />
    </>
  );
}
