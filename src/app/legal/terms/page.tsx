import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, createPageMetadata } from "@/lib/seo";
import LegalPage from "../../../views/LegalPage";

/** Route: /legal/terms */
export const metadata: Metadata = createPageMetadata({
  title: "Terms of Service",
  description:
    "Review the interim Outpay Terms of Service for merchant accounts, hosted USDC checkout, non-custodial payments, and platform responsibilities.",
  path: "/legal/terms",
  keywords: ["Outpay terms of service", "USDC checkout terms"],
});

export default function TermsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Terms of Service", path: "/legal/terms" },
        ])}
      />
      <LegalPage docType="Terms of Service" />
    </>
  );
}
