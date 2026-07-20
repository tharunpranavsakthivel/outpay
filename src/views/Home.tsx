"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  Clock3,
  Eye,
  Globe2,
  Layers3,
  LockKeyhole,
  Radar,
  ReceiptText,
  ShieldCheck,
  Wallet,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import { MarketingFooter } from "../components/layout/MarketingFooter";
import {
  MarketingNavbar,
  type MarketingNavbarUser,
} from "../components/layout/MarketingNavbar";
import { StatusPill } from "../components/ui/StatusPill";

const PLATFORM_METRICS = [
  { value: "Seconds", label: "typical Base settlement window" },
  { value: "1,000", label: "free paid transactions each month" },
  { value: "1.5%", label: "usage fee after the allowance" },
  { value: "0", label: "custody balances held by Outpay" },
];

const INFRASTRUCTURE_PILLARS = [
  {
    Icon: ReceiptText,
    title: "Hosted checkout",
    desc: "Exact-amount payment pages with token, network, wallet, and order context locked in.",
  },
  {
    Icon: Radar,
    title: "On-chain detection",
    desc: "Outpay watches Base and confirms only matching USDC transfers.",
  },
  {
    Icon: Webhook,
    title: "Signed events",
    desc: "Your backend receives verified payment events for fulfillment and reconciliation.",
  },
  {
    Icon: Layers3,
    title: "Operations dashboard",
    desc: "Payment status, webhook delivery, and checkout history stay visible to your team.",
  },
];

const COMPARISON_ROWS = [
  {
    label: "Settlement",
    outpay: "Direct to merchant wallet",
    processor: "Processor and bank settlement",
    manual: "Manual wallet review",
  },
  {
    label: "Buyer flow",
    outpay: "Hosted USDC checkout",
    processor: "Card checkout",
    manual: "Wallet address instructions",
  },
  {
    label: "Confirmation",
    outpay: "On-chain matching plus webhook",
    processor: "Processor authorization",
    manual: "Explorer checks",
  },
  {
    label: "Custody",
    outpay: "Non-custodial",
    processor: "Custodial payment flow",
    manual: "Depends on process",
  },
];

const PROVIDER_PROOF = [
  {
    Icon: ShieldCheck,
    title: "Provider-grade controls",
    desc: "Every checkout has a deterministic amount, asset, network, and merchant wallet.",
  },
  {
    Icon: LockKeyhole,
    title: "Server-side source of truth",
    desc: "Fulfill from signed webhooks, not client redirects or screenshots.",
  },
  {
    Icon: Globe2,
    title: "Global USDC buyers",
    desc: "Offer a payment path for customers who already prefer stablecoins.",
  },
];

const ADVANTAGE_CARDS = [
  {
    Icon: Clock3,
    title: "Faster settlement",
    desc: "Customers pay in USDC on Base and funds land directly in your wallet, without multi-day card settlement delays.",
    metric: "Seconds",
  },
  {
    Icon: Eye,
    title: "Transparent payment state",
    desc: "Every order is tied to amount, token, network, destination wallet, transfer match, and webhook delivery.",
    metric: "Traceable",
  },
  {
    Icon: BarChart3,
    title: "Lower payment ops",
    desc: "No screenshots, explorer checks, or spreadsheet reconciliation for every stablecoin order.",
    metric: "Automated",
  },
];

const INTEGRATION_STEPS = [
  "Create checkout",
  "Redirect customer",
  "Detect transfer",
  "Receive signed webhook",
  "Fulfill order",
];

const AUDIENCE_CARDS = [
  {
    title: "Ecommerce teams",
    desc: "Add USDC checkout without building wallet instructions, status tracking, or webhook delivery.",
  },
  {
    title: "Platforms",
    desc: "Give merchants a clean stablecoin payment path while funds settle directly to their own wallets.",
  },
  {
    title: "Developers",
    desc: "Start with links, then use APIs and signed events for production checkout workflows.",
  },
];

/**
 * Product composite used in the homepage hero to show Outpay as a payment
 * provider surface instead of a static marketing page.
 */
function ProviderHeroVisual() {
  return (
    <div className="op-hero-in-delay w-full max-w-[520px] rounded-xl border border-border bg-card shadow-lg overflow-hidden lg:justify-self-end">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <div className="text-sm font-semibold text-foreground">
            Payment session
          </div>
        </div>
        <StatusPill variant="success">Live</StatusPill>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[190px_1fr]">
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="text-xs text-foreground-lighter mb-1">
              Amount due
            </div>
            <div className="text-[36px] font-semibold leading-none text-foreground">
              124.00
            </div>
            <div className="text-sm text-foreground-light mt-1 mb-5">
              USDC on Base
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-foreground-lighter mb-1">
                Merchant wallet
              </div>
              <div className="font-mono text-xs text-foreground break-all">
                0x8f3a...c92e
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-4">
            <div className="heading-meta text-foreground-lighter mb-4">
              Verification
            </div>
            {[
              ["Customer paid", "Wallet-to-wallet"],
              ["Outpay matched", "Amount, token, wallet"],
              ["Order ready", "Signed webhook sent"],
            ].map(([title, label], index) => (
              <div key={title} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-accent border border-border flex items-center justify-center">
                    {index === 1 ? (
                      <ShieldCheck size={14} />
                    ) : (
                      <Check size={14} />
                    )}
                  </div>
                  {index < 2 && <div className="w-px h-7 bg-border my-1" />}
                </div>
                <div className="pt-0.5">
                  <div className="text-sm font-semibold text-foreground">
                    {title}
                  </div>
                  <div className="text-xs text-foreground-light mt-0.5">
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["Detected", "8 sec"],
            ["Held by Outpay", "$0"],
            ["Settlement", "Direct"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-border bg-background px-3.5 py-3"
            >
              <div className="text-xs text-foreground-lighter">{label}</div>
              <div className="text-sm font-semibold text-foreground mt-1">
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="heading-meta text-foreground-lighter">
                Transparent state
              </div>
              <div className="text-sm font-semibold text-foreground mt-1">
                chk_9k2n
              </div>
            </div>
            <div className="font-mono text-xs text-foreground-lighter">
              checkout.paid
            </div>
          </div>
          <div className="relative h-2 rounded-full bg-background-surface-200 overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-full bg-primary" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-foreground-light">
            <div>Created</div>
            <div className="text-center">Matched</div>
            <div className="text-right">Paid</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Visualizes direct wallet-to-wallet settlement with Outpay as verifier. */
function PaymentRailVisual() {
  return (
    <div className="op-reveal border border-border rounded-xl bg-card shadow-xs p-6">
      <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_80px_1fr_80px_1fr]">
        {[
          ["Customer", "Wallet pays exact USDC"],
          ["Outpay", "Verifies transfer"],
          ["Merchant", "Wallet receives funds"],
        ].map(([title, desc], index) => (
          <div key={title} className="contents">
            <div className="rounded-xl border border-border bg-background p-5 text-center">
              <div className="w-10 h-10 rounded-[10px] bg-accent mx-auto mb-3 flex items-center justify-center">
                {index === 1 ? <ShieldCheck size={19} /> : <Wallet size={19} />}
              </div>
              <div className="text-sm font-semibold text-foreground">
                {title}
              </div>
              <div className="text-xs text-foreground-light mt-1 leading-[1.45]">
                {desc}
              </div>
            </div>
            {index < 2 && (
              <div className="relative h-px bg-border overflow-hidden">
                <div className="op-scan-line absolute inset-y-0 w-12 bg-primary" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type HomeProps = {
  authenticatedUser?: MarketingNavbarUser | null;
};

/** Home page for the public marketing site. */
export default function Home({ authenticatedUser }: HomeProps) {
  return (
    <div className="bg-background min-h-screen font-sans flex flex-col">
      <div className="sticky top-0 z-20">
        <MarketingNavbar authenticatedUser={authenticatedUser} />
      </div>

      <section className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 900px 460px at 50% -12%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 68%)",
          }}
        />
        <div className="relative max-w-content mx-auto grid grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16 lg:py-[96px]">
          <div className="op-hero-in flex flex-col gap-6">
            <div className="heading-meta text-foreground-lighter">
              Stablecoin payment infrastructure
            </div>
            <h1 className="text-[40px] font-semibold leading-[1.08] tracking-normal text-foreground m-0 sm:text-[48px] lg:text-[54px] lg:leading-[1.04]">
              Stablecoin checkout that feels like payment infrastructure.
            </h1>
            <p className="text-[17px] leading-[1.65] text-foreground-light m-0 max-w-[590px]">
              Outpay helps providers and merchants accept USDC on Base with fast
              direct settlement, transparent payment state, automatic detection,
              and signed fulfillment events.
            </p>
            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
              <Link
                href="/signup"
                className="h-[38px] px-4 text-sm gap-2 inline-flex items-center justify-center font-sans font-body whitespace-nowrap transition-all duration-200 ease-out cursor-pointer rounded-sm bg-primary text-foreground border border-primary/75 hover:brightness-95 no-underline"
              >
                Sign up
              </Link>
              <Link
                href="/company/contact"
                className="h-[38px] px-4 text-sm gap-2 inline-flex items-center justify-center font-sans font-body whitespace-nowrap transition-all duration-200 ease-out cursor-pointer rounded-sm bg-transparent border border-border-strong text-foreground hover:bg-accent no-underline"
              >
                Contact sales
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 pt-4 max-w-[520px] sm:grid-cols-2">
              {[
                "Non-custodial",
                "USDC on Base",
                "Signed webhooks",
                "API first",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <Check size={14} className="text-foreground" />
                  <span className="text-foreground-light">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <ProviderHeroVisual />
        </div>
      </section>

      <section className="op-reveal max-w-content mx-auto w-full px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 border border-border rounded-xl bg-card shadow-xs overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORM_METRICS.map((metric) => (
            <div
              key={metric.label}
              className="border-b border-border px-6 py-5 last:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b-0"
            >
              <div className="text-[30px] font-semibold leading-none text-foreground">
                {metric.value}
              </div>
              <div className="text-sm text-foreground-light mt-2 leading-[1.45]">
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="max-w-content mx-auto px-4 py-16 sm:px-6 lg:py-20">
          <div className="op-reveal mb-10 grid grid-cols-1 items-end gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:gap-12">
            <div>
              <div className="heading-meta text-foreground-lighter mb-3">
                Why Outpay wins
              </div>
              <h2 className="text-[30px] font-semibold leading-[1.16] tracking-normal text-foreground m-0 sm:text-[34px] lg:text-[38px]">
                Faster settlement, clearer records, less manual work.
              </h2>
            </div>
            <p className="text-sm text-foreground-light leading-[1.65] m-0">
              Traditional payment flows optimize for cards. Manual wallet
              payments optimize for nothing. Outpay gives stablecoin checkout a
              real operating layer.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {ADVANTAGE_CARDS.map((card) => (
              <div
                key={card.title}
                className="op-reveal relative overflow-hidden rounded-xl border border-border bg-background p-6"
              >
                <div className="absolute left-0 right-0 top-0 h-px overflow-hidden bg-border">
                  <div className="op-flow-line h-full w-24 bg-primary" />
                </div>
                <div className="w-10 h-10 rounded-[10px] bg-accent flex items-center justify-center mb-5">
                  <card.Icon size={19} />
                </div>
                <div className="text-[28px] font-semibold leading-none text-foreground mb-4">
                  {card.metric}
                </div>
                <h3 className="text-[15px] font-semibold text-foreground mb-2">
                  {card.title}
                </h3>
                <div className="text-sm text-foreground-light leading-[1.55]">
                  {card.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-content mx-auto grid w-full grid-cols-1 items-start gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:py-20">
        <div className="op-reveal flex flex-col gap-4">
          <div className="heading-meta text-foreground-lighter">
            Platform surface
          </div>
          <h2 className="text-[28px] font-semibold leading-[1.18] tracking-normal text-foreground m-0 sm:text-[34px] sm:leading-[1.16]">
            Everything around the payment, handled.
          </h2>
          <p className="text-sm text-foreground-light leading-[1.65] m-0">
            Outpay is more than a wallet address on a page. It gives your team
            the checkout, verification, events, and operational visibility
            required to run stablecoin payments as a provider-grade workflow.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {INFRASTRUCTURE_PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className="op-reveal border border-border rounded-xl bg-card p-6 flex flex-col gap-4"
            >
              <div className="w-10 h-10 rounded-[10px] bg-accent flex items-center justify-center">
                <pillar.Icon size={19} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-foreground mb-2">
                  {pillar.title}
                </h3>
                <div className="text-sm text-foreground-light leading-[1.55]">
                  {pillar.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="max-w-content mx-auto grid grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:py-20">
          <div className="op-reveal flex flex-col gap-4">
            <div className="heading-meta text-foreground-lighter">
              Settlement model
            </div>
            <h2 className="text-[28px] font-semibold leading-[1.18] tracking-normal text-foreground m-0 sm:text-[34px] sm:leading-[1.16]">
              Funds move directly. Confirmation stays automated.
            </h2>
            <p className="text-sm text-foreground-light leading-[1.65] m-0">
              Customers pay your wallet directly. Outpay sits in the workflow as
              the checkout, detection, and webhook layer, not as a custodian of
              funds.
            </p>
          </div>
          <PaymentRailVisual />
        </div>
      </section>

      <section className="max-w-content mx-auto px-4 py-16 sm:px-6 lg:py-20">
        <div className="op-reveal mb-10 grid grid-cols-1 items-end gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
          <div>
            <div className="heading-meta text-foreground-lighter mb-3">
              Compare
            </div>
            <h2 className="text-[28px] font-semibold leading-[1.18] tracking-normal text-foreground m-0 sm:text-[34px] sm:leading-[1.16]">
              A payment-provider workflow for stablecoins.
            </h2>
          </div>
          <p className="text-sm text-foreground-light leading-[1.65] m-0">
            Outpay is built for merchants who want USDC revenue without turning
            payment operations into a manual back-office process.
          </p>
        </div>
        <div className="op-reveal overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
          <div className="grid min-w-[720px] grid-cols-[0.8fr_1fr_1fr_1fr] border-b border-border bg-background-surface-75">
            {["Capability", "Outpay", "Cards", "Manual wallet"].map(
              (heading) => (
                <div
                  key={heading}
                  className="px-4 py-3 text-xs font-semibold text-foreground"
                >
                  {heading}
                </div>
              ),
            )}
          </div>
          {COMPARISON_ROWS.map((row) => (
            <div
              key={row.label}
              className="grid min-w-[720px] grid-cols-[0.8fr_1fr_1fr_1fr] border-b border-border last:border-b-0"
            >
              <div className="px-4 py-4 text-sm font-medium text-foreground">
                {row.label}
              </div>
              <div className="px-4 py-4 text-sm text-foreground">
                {row.outpay}
              </div>
              <div className="px-4 py-4 text-sm text-foreground-light">
                {row.processor}
              </div>
              <div className="px-4 py-4 text-sm text-foreground-light">
                {row.manual}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="max-w-content mx-auto grid grid-cols-1 gap-5 px-4 py-16 sm:px-6 md:grid-cols-3 lg:py-20">
          {PROVIDER_PROOF.map((point) => (
            <div
              key={point.title}
              className="op-reveal border border-border rounded-xl bg-background p-6"
            >
              <div className="w-10 h-10 rounded-[10px] bg-accent flex items-center justify-center mb-5">
                <point.Icon size={19} />
              </div>
              <h3 className="text-[15px] font-semibold text-foreground mb-2">
                {point.title}
              </h3>
              <div className="text-sm text-foreground-light leading-[1.55]">
                {point.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-content mx-auto grid grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:py-20">
        <div className="op-reveal border border-border rounded-xl bg-card shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">
              Integration path
            </div>
            <div className="font-mono text-xs text-foreground-lighter">
              /v1/checkouts
            </div>
          </div>
          <div className="p-5">
            {INTEGRATION_STEPS.map((step, index) => (
              <div key={step} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-accent border border-border flex items-center justify-center text-xs text-foreground">
                    {index + 1}
                  </div>
                  {index < INTEGRATION_STEPS.length - 1 && (
                    <div className="w-px h-8 bg-border my-1.5" />
                  )}
                </div>
                <div className="pt-1.5">
                  <div className="text-sm font-semibold text-foreground">
                    {step}
                  </div>
                  <div className="text-xs text-foreground-light mt-1">
                    {index === 0
                      ? "Create a hosted checkout from your server."
                      : "Keep order state tied to verified payment events."}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="op-reveal flex flex-col gap-4">
          <div className="heading-meta text-foreground-lighter">
            Developer ready
          </div>
          <h2 className="text-[28px] font-semibold leading-[1.18] tracking-normal text-foreground m-0 sm:text-[34px] sm:leading-[1.16]">
            Start with links. Scale with API and webhooks.
          </h2>
          <p className="text-sm text-foreground-light leading-[1.65] m-0">
            Use hosted links for early rollout, then move checkout creation and
            fulfillment into your backend when you need a deeper integration.
          </p>
          <Link
            href="/developers/quickstart"
            className="no-underline text-sm font-medium text-foreground inline-flex items-center gap-1.5"
          >
            Read the quickstart <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="max-w-content mx-auto px-4 py-16 sm:px-6 lg:py-20">
          <div className="op-reveal max-w-[640px] mb-10">
            <div className="heading-meta text-foreground-lighter mb-3">
              Built for providers
            </div>
            <h2 className="text-[28px] font-semibold leading-[1.18] tracking-normal text-foreground m-0 sm:text-[34px] sm:leading-[1.16]">
              A stablecoin checkout layer your customers can rely on.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {AUDIENCE_CARDS.map((card) => (
              <div
                key={card.title}
                className="op-reveal border border-border rounded-xl bg-background p-6"
              >
                <h3 className="text-[15px] font-semibold text-foreground mb-2">
                  {card.title}
                </h3>
                <div className="text-sm text-foreground-light leading-[1.55]">
                  {card.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-content mx-auto grid w-full grid-cols-1 items-center gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_auto] lg:gap-10 lg:py-24">
        <div className="op-reveal">
          <div className="heading-meta text-foreground-lighter mb-3">
            Ready to launch
          </div>
          <h2 className="text-[30px] font-semibold leading-[1.16] tracking-normal text-foreground m-0 max-w-[680px] sm:text-[38px] sm:leading-[1.12]">
            Add stablecoin checkout without adding custody or manual payment
            operations.
          </h2>
        </div>
        <div className="op-reveal flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/signup"
            className="h-[38px] px-4 text-sm gap-2 inline-flex items-center justify-center font-sans font-body whitespace-nowrap transition-all duration-200 ease-out cursor-pointer rounded-sm bg-primary text-foreground border border-primary/75 hover:brightness-95 no-underline"
          >
            Sign up
          </Link>
          <Link
            href="/pricing"
            className="no-underline text-sm font-medium text-foreground inline-flex items-center gap-1.5"
          >
            See pricing <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
