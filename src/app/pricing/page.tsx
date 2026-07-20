import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, createPageMetadata, faqPageJsonLd } from "@/lib/seo";
import Pricing from "../../views/Pricing";

export const metadata: Metadata = createPageMetadata({
  title: "Pricing for USDC Checkout",
  description:
    "Start with 1,000 paid USDC transactions free each month, then pay 1.5% on confirmed transactions above the allowance. Contact sales for volume terms.",
  path: "/pricing",
  keywords: [
    "USDC payment processing pricing",
    "stablecoin checkout fees",
    "crypto payment gateway pricing",
  ],
});

export default function PricingPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ])}
      />
      <JsonLd
        data={faqPageJsonLd([
          {
            question: "What is free?",
            answer:
              "Your first 1,000 paid transactions each month are free. Unpaid, expired, or abandoned checkouts do not count.",
          },
          {
            question: "What happens after 1,000 transactions?",
            answer:
              "Outpay charges 1.5% per confirmed paid transaction above the monthly free allowance.",
          },
          {
            question: "Do corporate merchants get custom terms?",
            answer:
              "Yes. Contact us for volume pricing, onboarding support, and commercial terms.",
          },
          {
            question: "Does Outpay hold funds?",
            answer:
              "No. Customers pay your wallet directly in USDC on Base. Outpay verifies the transfer and sends payment events.",
          },
        ])}
      />
      <Pricing />
    </>
  );
}
