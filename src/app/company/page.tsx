import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, createPageMetadata } from "@/lib/seo";
import Company from "../../views/Company";

/** Route page for the company marketing page. */
export const metadata: Metadata = createPageMetadata({
  title: "About | Non-Custodial Stablecoin Payments",
  description:
    "Learn how Outpay helps merchants accept USDC on Base with wallet-to-wallet settlement, on-chain verification, and reliable payment operations.",
  path: "/company",
  keywords: [
    "non-custodial stablecoin payments",
    "USDC payment infrastructure",
    "Base payment platform",
  ],
});

export default function CompanyPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Company", path: "/company" },
        ])}
      />
      <Company />
    </>
  );
}
