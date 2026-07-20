import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, createPageMetadata } from "@/lib/seo";
import Contact from "../../../views/Contact";

/** Route page for the corporate contact page. */
export const metadata: Metadata = createPageMetadata({
  title: "Contact | Stablecoin Checkout Sales",
  description:
    "Talk with Outpay about corporate pricing, API implementation, stablecoin checkout, and USDC payment operations on Base.",
  path: "/company/contact",
  keywords: [
    "stablecoin checkout sales",
    "USDC payment integration consultation",
    "crypto payment platform support",
  ],
});

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Company", path: "/company" },
          { name: "Contact", path: "/company/contact" },
        ])}
      />
      <Contact />
    </>
  );
}
