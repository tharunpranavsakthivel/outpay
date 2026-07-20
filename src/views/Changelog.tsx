"use client";

import { MarketingNavbar } from "../components/layout/MarketingNavbar";

const ENTRIES = [
  {
    date: "Jul 2, 2026",
    title: "Faster payment detection on Base",
    desc: "Checkout links now flip to paid within one confirmation instead of three, cutting typical detection time to under 10 seconds.",
  },
  {
    date: "Jun 18, 2026",
    title: "Signed webhook retries",
    desc: "Failed webhook deliveries now retry automatically with exponential backoff, up to 5 attempts.",
  },
  {
    date: "May 22, 2026",
    title: "API: idempotency keys",
    desc: "POST /v1/checkout now accepts an Idempotency-Key header to safely retry checkout creation.",
  },
  {
    date: "May 9, 2026",
    title: "Dashboard performance",
    desc: "The payments table now loads instantly for stores with thousands of transactions.",
  },
  {
    date: "Apr 28, 2026",
    title: "Fixed: webhook signature mismatch",
    desc: "Resolved an issue where signatures could fail to verify for payloads over 8kb.",
  },
];

/** Developer changelog list. */
export default function Changelog() {
  return (
    <div className="bg-background min-h-screen font-sans flex flex-col">
      <MarketingNavbar activeHref="/developers" />

      <div className="max-w-[680px] mx-auto w-full px-6 pt-16 pb-24 flex flex-col gap-2">
        <div className="heading-meta text-foreground-lighter">Developers</div>
        <h1 className="text-[30px] font-semibold tracking-[-0.01em] text-foreground mb-2">
          Changelog
        </h1>
        <p className="text-sm text-foreground-light leading-[1.6] mb-8">
          What's new on Outpay — API changes, dashboard updates, and fixes.
        </p>

        {ENTRIES.map((entry) => (
          <div
            key={entry.title}
            className="flex gap-6 py-6 border-t border-border"
          >
            <div className="shrink-0 w-[110px] font-mono text-xs text-foreground-lighter pt-0.5">
              {entry.date}
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[15px] font-semibold text-foreground">
                {entry.title}
              </h2>
              <div className="text-[13.5px] text-foreground-light leading-[1.6]">
                {entry.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border py-6 px-8 text-center">
        <div className="text-xs text-foreground-lighter">
          © 2026 Outpay. Non-custodial checkout for USDC on Base.
        </div>
      </div>
    </div>
  );
}
