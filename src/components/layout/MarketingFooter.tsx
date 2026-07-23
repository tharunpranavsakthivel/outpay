import Link from "next/link";
import { NON_CUSTODIAL_DISCLAIMER } from "../../lib/legal/compliance";
import { BrandWordmark } from "../ui/BrandWordmark";

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Checkout Links", href: "/product/checkout-links" },
      { label: "Merchant Dashboard", href: "/product/merchant-dashboard" },
      { label: "Signed Webhooks", href: "/product/signed-webhooks" },
      { label: "Payment Detection", href: "/product/payment-detection" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "API Reference", href: "/developers/api-reference" },
      { label: "Webhooks Guide", href: "/developers/webhooks" },
      { label: "Quickstart", href: "/developers/quickstart" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/company" },
      { label: "Contact", href: "/company/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/legal/terms" },
      { label: "Privacy", href: "/legal/privacy" },
    ],
  },
];

/** Shared marketing footer used on Home, Pricing, Product. */
export function MarketingFooter() {
  return (
    <div className="bg-card border-t border-border">
      <div className="max-w-content mx-auto flex flex-col gap-12 px-4 pt-14 pb-8 sm:px-6 lg:pt-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="col-span-2 flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-foreground md:col-span-4 lg:col-span-1 lg:items-start">
            <img
              src="/logo/light-32.png"
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 shrink-0"
            />
            <BrandWordmark />
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3.5">
              <div className="heading-meta text-foreground-lighter">
                {col.title}
              </div>
              {col.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm text-foreground-light no-underline hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-6">
          <div className="flex flex-col gap-2 text-xs text-foreground-lighter">
            <div>© 2026 Outpay. Non-custodial checkout for USDC on Base.</div>
            <div className="max-w-[680px] leading-[1.6]">
              {NON_CUSTODIAL_DISCLAIMER}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
