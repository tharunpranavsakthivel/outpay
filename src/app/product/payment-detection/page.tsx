import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, createPageMetadata } from "@/lib/seo";
import MarketingDetailPage from "../../../views/MarketingDetailPage";

/** Route page for the payment detection product detail page. */
export const metadata: Metadata = createPageMetadata({
  title: "On-Chain USDC Payment Detection on Base",
  description:
    "Match the expected USDC amount, token, network, and merchant wallet on Base so paid checkout events can trigger fulfillment.",
  path: "/product/payment-detection",
  keywords: [
    "on-chain payment detection",
    "USDC payment verification",
    "Base transaction monitoring",
  ],
});

export default function PaymentDetectionPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Product", path: "/product" },
          { name: "Payment detection", path: "/product/payment-detection" },
        ])}
      />
      <MarketingDetailPage slug="payment-detection" />
    </>
  );
}
