import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, createPageMetadata } from "@/lib/seo";
import MarketingDetailPage from "../../../views/MarketingDetailPage";

/** Route page for the signed webhooks product detail page. */
export const metadata: Metadata = createPageMetadata({
  title: "Signed Webhooks for USDC Payment Fulfillment",
  description:
    "Verify signed `checkout.paid` events after Outpay matches a Base USDC transfer, then fulfill orders safely from your backend.",
  path: "/product/signed-webhooks",
  keywords: [
    "signed payment webhooks",
    "USDC webhook verification",
    "crypto payment fulfillment",
  ],
});

export default function SignedWebhooksPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Product", path: "/product" },
          { name: "Signed webhooks", path: "/product/signed-webhooks" },
        ])}
      />
      <MarketingDetailPage slug="signed-webhooks" />
    </>
  );
}
