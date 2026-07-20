import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, createPageMetadata, productJsonLd } from "@/lib/seo";
import Product from "../../views/Product";

export const metadata: Metadata = createPageMetadata({
  title: "Stablecoin Checkout Platform for USDC Payments",
  description:
    "Explore Outpay's hosted checkout, Base payment detection, merchant dashboard, direct settlement, and signed webhook flow for USDC payments.",
  path: "/product",
  keywords: [
    "stablecoin checkout platform",
    "USDC payment processing",
    "Base payment infrastructure",
    "crypto payment webhooks",
  ],
});

export default function ProductPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Product", path: "/product" },
        ])}
      />
      <JsonLd data={productJsonLd()} />
      <Product />
    </>
  );
}
