import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, createPageMetadata } from "@/lib/seo";
import LegalPage from "../../../views/LegalPage";

/** Route: /legal/privacy */
export const metadata: Metadata = createPageMetadata({
  title: "Privacy Policy",
  description:
    "Read how Outpay handles merchant account data, checkout metadata, wallet addresses, transaction records, and public blockchain information.",
  path: "/legal/privacy",
  keywords: ["Outpay privacy policy", "crypto payment data privacy"],
});

export default function PrivacyPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Privacy Policy", path: "/legal/privacy" },
        ])}
      />
      <LegalPage docType="Privacy Policy" />
    </>
  );
}
