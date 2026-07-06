"use client";

import {
  ArrowUpRight,
  Building2,
  Globe2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { MarketingFooter } from "../components/layout/MarketingFooter";
import { MarketingNavbar } from "../components/layout/MarketingNavbar";
import { Button } from "../components/ui/Button";

const PRINCIPLES = [
  {
    Icon: Wallet,
    title: "Merchant-controlled funds",
    desc: "Customers pay merchant wallets directly. Outpay verifies, records, and notifies.",
  },
  {
    Icon: ShieldCheck,
    title: "Verification over promises",
    desc: "Checkout state is based on matching on-chain transfers, not screenshots or manual review.",
  },
  {
    Icon: Globe2,
    title: "Global payment reach",
    desc: "USDC on Base gives commerce teams a stablecoin path for buyers across markets.",
  },
];

const COMPANY_STATS = [
  { value: "USDC", label: "single-asset checkout focus" },
  { value: "Base", label: "settlement network" },
  { value: "0", label: "custody balances held by Outpay" },
];

/** Company marketing page explaining Outpay's mission, principles, and contact path. */
export default function Company() {
  return (
    <div className="bg-background min-h-screen font-sans flex flex-col">
      <div className="sticky top-0 z-20">
        <MarketingNavbar activeHref="/company" />
      </div>

      <div className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 820px 420px at 50% -18%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 68%)",
          }}
        />
        <div className="relative max-w-content mx-auto grid grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-[88px]">
          <div className="op-hero-in flex flex-col gap-5">
            <div className="heading-meta text-foreground-lighter">Company</div>
            <h1 className="text-[36px] font-semibold tracking-normal leading-[1.12] text-foreground m-0 sm:text-[48px] sm:leading-[1.08]">
              Building payment infrastructure for stablecoin commerce.
            </h1>
            <p className="text-base leading-[1.6] text-foreground-light m-0">
              Outpay gives merchants the checkout, verification, and operations
              layer required to accept USDC professionally, while keeping funds
              wallet-to-wallet.
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <Button variant="primary" size="medium">
                Start building
              </Button>
              <a
                href="/company/contact"
                className="h-[38px] px-4 text-sm gap-2 inline-flex items-center justify-center font-sans font-body whitespace-nowrap transition-all duration-200 ease-out cursor-pointer rounded-sm bg-transparent border border-border-strong text-foreground hover:bg-accent no-underline"
              >
                Contact sales
              </a>
            </div>
          </div>
          <div className="op-hero-in-delay border border-border rounded-xl bg-card shadow-xs p-6 grid grid-cols-1 gap-4">
            {COMPANY_STATS.map((stat) => (
              <div
                key={stat.label}
                className="border border-border rounded-lg bg-background px-5 py-4"
              >
                <div className="text-[30px] font-semibold tracking-normal text-foreground">
                  {stat.value}
                </div>
                <div className="text-sm text-foreground-light mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-content mx-auto flex flex-col gap-10 px-4 py-16 sm:px-6 lg:py-20">
        <div className="op-reveal max-w-[640px]">
          <div className="heading-meta text-foreground-lighter mb-2">
            Principles
          </div>
          <h2 className="text-[28px] font-semibold tracking-normal leading-[1.18] text-foreground m-0 sm:text-[34px] sm:leading-[1.16]">
            A provider should make payment state reliable.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PRINCIPLES.map((principle) => (
            <div
              key={principle.title}
              className="op-reveal border border-border rounded-xl bg-card p-6 flex flex-col gap-4"
            >
              <div className="w-10 h-10 rounded-[10px] bg-accent flex items-center justify-center">
                <principle.Icon size={20} />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-foreground mb-2">
                  {principle.title}
                </div>
                <div className="text-sm text-foreground-light leading-[1.55]">
                  {principle.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border-y border-border">
        <div className="max-w-content mx-auto grid grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:py-20">
          <div className="op-reveal flex flex-col gap-3">
            <div className="heading-meta text-foreground-lighter">
              Work with us
            </div>
            <h2 className="text-[28px] font-semibold tracking-normal leading-[1.18] text-foreground m-0 sm:text-[34px] sm:leading-[1.16]">
              Building at corporate scale?
            </h2>
            <p className="text-sm text-foreground-light leading-[1.6] m-0">
              For higher transaction volume, corporate onboarding, or platform
              payment programs, contact the Outpay team to shape the right
              commercial setup.
            </p>
          </div>
          <a
            href="/company/contact"
            className="op-reveal flex flex-col gap-6 rounded-xl border border-border bg-background p-6 no-underline hover:bg-accent sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-[10px] bg-accent flex items-center justify-center mb-4">
                <Building2 size={19} />
              </div>
              <div className="text-[15px] font-semibold text-foreground mb-1.5">
                Contact Outpay
              </div>
              <div className="text-sm text-foreground-light">
                Corporate pricing, onboarding, partnerships, and support.
              </div>
            </div>
            <ArrowUpRight size={18} className="text-foreground" />
          </a>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
