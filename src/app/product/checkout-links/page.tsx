import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, createPageMetadata } from "@/lib/seo";
import MarketingDetailPage from "../../../views/MarketingDetailPage";

/** Route page for the checkout links product detail page. */
export const metadata: Metadata = createPageMetadata({
  title: "USDC Payment Links for Merchants",
  description:
    "Create shareable hosted payment links for exact-amount USDC checkout on Base, with direct settlement and dashboard payment status.",
  path: "/product/checkout-links",
  keywords: [
    "USDC payment links",
    "crypto payment links",
    "hosted stablecoin checkout",
  ],
});

export default function CheckoutLinksPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Product", path: "/product" },
          { name: "Checkout links", path: "/product/checkout-links" },
        ])}
      />
      <MarketingDetailPage slug="checkout-links" />
    </>
  );
}
