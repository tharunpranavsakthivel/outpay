"use client";

import { MarketingNavbar } from "../components/layout/MarketingNavbar";
import { Button } from "../components/ui/Button";

const QUICK_LINKS = [
  { label: "Pricing", href: "/pricing" },
  { label: "Developers", href: "/developers" },
  { label: "Company", href: "/" },
];

/** Marketing 404 page. */
export default function Marketing404() {
  return (
    <div className="bg-background min-h-screen font-sans flex flex-col">
      <MarketingNavbar />

      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-16 text-center">
        <div className="text-sm font-semibold tracking-[0.04em] text-foreground-lighter uppercase">
          404
        </div>
        <div className="flex flex-col gap-2 max-w-[440px]">
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-foreground m-0">
            We couldn't find that page
          </h1>
          <p className="text-sm text-foreground-lighter leading-[1.6] m-0">
            The page you're looking for may have moved or the link might be
            mistyped. Here are a few places to pick back up.
          </p>
        </div>

        <div className="flex items-center gap-2.5 mt-2">
          <Button variant="primary" size="medium">
            Go to homepage
          </Button>
          <Button variant="outline" size="medium">
            View docs
          </Button>
        </div>

        <div className="flex items-center gap-5 mt-7 pt-6 border-t border-border">
          {QUICK_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-foreground-light no-underline hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <div className="border-t border-border py-6 px-8 text-center">
        <div className="text-xs text-foreground-lighter">
          © 2026 Outpay. Non-custodial checkout for USDC on Base.
        </div>
      </div>
    </div>
  );
}
