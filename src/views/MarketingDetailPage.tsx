"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Check,
  LayoutDashboard,
  Link2,
  Radar,
  Rocket,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import { MarketingFooter } from "../components/layout/MarketingFooter";
import { MarketingNavbar } from "../components/layout/MarketingNavbar";

type DetailPageConfig = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  primaryCta: string;
  secondaryCta: string;
  secondaryHref: string;
  highlights: string[];
  sections: {
    title: string;
    description: string;
  }[];
  proof: {
    label: string;
    value: string;
  }[];
  offers?: string[];
  advantages?: string[];
  code?: string;
};

const PAGE_CONFIGS: Record<string, DetailPageConfig> = {
  "checkout-links": {
    eyebrow: "Product",
    title: "Hosted payment links for USDC commerce",
    description:
      "Launch a polished USDC checkout without building wallet instructions, status handling, and payment pages from scratch.",
    icon: Link2,
    primaryCta: "Create checkout link",
    secondaryCta: "See pricing",
    secondaryHref: "/pricing",
    highlights: [
      "Share payment requests over email, chat, invoice, or storefront flows.",
      "Use exact-amount USDC requests so customers do not guess what to send.",
      "Track paid, pending, and expired checkout states from the dashboard.",
    ],
    sections: [
      {
        title: "Hosted by Outpay",
        description:
          "Send customers to a clean checkout page without building wallet instructions from scratch.",
      },
      {
        title: "Direct settlement",
        description:
          "The customer pays your wallet directly on Base. Outpay verifies the transfer but never receives custody.",
      },
      {
        title: "Works before a full integration",
        description:
          "Launch with links first, then move to the API when you need checkout creation inside your app.",
      },
    ],
    proof: [
      { value: "60 sec", label: "to create a link" },
      { value: "0", label: "custody steps" },
      { value: "USDC", label: "on Base" },
    ],
    offers: [
      "Hosted payment page for every order",
      "Locked amount, token, network, and merchant wallet",
      "Buyer-facing payment status after funds are sent",
      "Dashboard visibility for paid, pending, and expired links",
    ],
    advantages: [
      "No improvised wallet instructions",
      "No customer confusion about token or network",
      "No engineering work required to launch first payments",
    ],
  },
  "merchant-dashboard": {
    eyebrow: "Product",
    title: "Payment operations for stablecoin checkout",
    description:
      "Give support, finance, and engineering one operational view for checkout volume, payment state, and webhook delivery.",
    icon: LayoutDashboard,
    primaryCta: "Open dashboard",
    secondaryCta: "View product tour",
    secondaryHref: "/product",
    highlights: [
      "See paid, pending, and expired checkouts without checking wallets by hand.",
      "Review webhook delivery history and retry operational issues quickly.",
      "Keep non-technical teams aligned on order and settlement status.",
    ],
    sections: [
      {
        title: "Live payment status",
        description:
          "Track each checkout as it moves from created to paid, expired, or action needed.",
      },
      {
        title: "Operational context",
        description:
          "Amounts, labels, timestamps, and webhook results stay connected to each checkout.",
      },
      {
        title: "Team-friendly",
        description:
          "Customer support and finance teams can reconcile USDC payments without developer help.",
      },
    ],
    proof: [
      { value: "1 view", label: "for payments" },
      { value: "99%+", label: "webhook visibility" },
      { value: "0", label: "spreadsheets needed" },
    ],
    offers: [
      "Payment volume and checkout status overview",
      "Recent checkouts with amount, status, and labels",
      "Webhook delivery visibility for operations teams",
      "Clean reconciliation view for support and finance",
    ],
    advantages: [
      "No explorer checks for every order",
      "No disconnected spreadsheets",
      "One payment state shared across the team",
    ],
  },
  "signed-webhooks": {
    eyebrow: "Product",
    title: "Signed payment events for production fulfillment",
    description:
      "Fulfill orders from server-side events after Outpay verifies the matching USDC transfer on Base.",
    icon: Webhook,
    primaryCta: "Read webhook guide",
    secondaryCta: "API reference",
    secondaryHref: "/developers/api-reference",
    highlights: [
      "Confirm orders from server-side events instead of client-side redirects.",
      "Verify every event with a signature before updating order state.",
      "Retry and audit delivery attempts from the dashboard.",
    ],
    sections: [
      {
        title: "Server-side confidence",
        description:
          "Your backend receives checkout.paid only after Outpay verifies the on-chain transfer.",
      },
      {
        title: "Signature verification",
        description:
          "Use the webhook secret to verify the payload came from Outpay before fulfilling an order.",
      },
      {
        title: "Delivery observability",
        description:
          "Track response codes and timestamps so failed deliveries are visible to your team.",
      },
    ],
    proof: [
      { value: "HMAC", label: "signed events" },
      { value: "Base", label: "payment source" },
      { value: "201", label: "created checkout" },
    ],
    offers: [
      "Signed checkout.paid events",
      "Server-side fulfillment trigger",
      "Retry-safe delivery model",
      "Audit trail for webhook attempts",
    ],
    advantages: [
      "No fulfillment from browser redirects",
      "No trusting unsigned payloads",
      "No duplicated orders when retries happen",
    ],
    code: `POST /webhooks/outpay
X-Outpay-Signature: t=..., v1=...

{
  "event": "checkout.paid",
  "checkout_id": "chk_9k2n",
  "amount": "124.00",
  "currency": "USDC"
}`,
  },
  "payment-detection": {
    eyebrow: "Product",
    title: "On-chain payment detection without manual review",
    description:
      "Outpay watches Base, matches the transfer to the checkout, and updates payment state without polling or wallet checks.",
    icon: Radar,
    primaryCta: "See how it works",
    secondaryCta: "View quickstart",
    secondaryHref: "/developers/quickstart",
    highlights: [
      "Match amount, token, network, and destination wallet before confirming.",
      "Turn confirmed transfers into reliable checkout.paid events.",
      "Reduce support tickets caused by ambiguous wallet payment instructions.",
    ],
    sections: [
      {
        title: "Exact transfer matching",
        description:
          "Outpay verifies the payment against the checkout request instead of only trusting a redirect.",
      },
      {
        title: "Fast status changes",
        description:
          "Orders move to paid as soon as the confirmed Base transfer matches the checkout.",
      },
      {
        title: "Less manual reconciliation",
        description:
          "Your team no longer needs to inspect block explorers for every paid order.",
      },
    ],
    proof: [
      { value: "Base", label: "network watched" },
      { value: "USDC", label: "token verified" },
      { value: "0", label: "manual checks" },
    ],
    offers: [
      "Base transfer monitoring",
      "Exact amount and merchant wallet matching",
      "Checkout state updates after confirmed payment",
      "Reliable signal for webhooks and dashboards",
    ],
    advantages: [
      "No manual block explorer review",
      "No guessing whether a transfer belongs to an order",
      "No paid orders left in pending limbo",
    ],
  },
  "api-reference": {
    eyebrow: "Developers",
    title: "API primitives for stablecoin checkout",
    description:
      "Create checkout sessions, inspect payment state, and connect your backend to Outpay with a focused REST surface.",
    icon: BookOpen,
    primaryCta: "Generate API key",
    secondaryCta: "Start quickstart",
    secondaryHref: "/developers/quickstart",
    highlights: [
      "Create hosted checkout sessions from your backend.",
      "Read checkout status using stable identifiers.",
      "Use signed webhooks for fulfillment and reconciliation.",
    ],
    sections: [
      {
        title: "Small API surface",
        description:
          "The core flow is create checkout, redirect customer, receive checkout.paid.",
      },
      {
        title: "Server-first integration",
        description:
          "Keep secret keys on your backend and expose only hosted checkout URLs to customers.",
      },
      {
        title: "Predictable objects",
        description:
          "Checkout responses include amount, currency, network, status, and checkout URL.",
      },
    ],
    proof: [
      { value: "REST", label: "API style" },
      { value: "JSON", label: "response format" },
      { value: "USDC", label: "currency" },
    ],
    code: `curl -X POST https://api.outpay.dev/v1/checkouts \\
  -H "Authorization: Bearer OUTPAY_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":"124.00","currency":"USDC","network":"base"}'`,
  },
  webhooks: {
    eyebrow: "Developers",
    title: "Webhook handling for reliable fulfillment",
    description:
      "Verify signatures, handle retries, and update order state only after Outpay confirms a matching on-chain payment.",
    icon: Webhook,
    primaryCta: "Configure endpoint",
    secondaryCta: "API reference",
    secondaryHref: "/developers/api-reference",
    highlights: [
      "Use checkout.paid as the server-side source of truth.",
      "Reject unsigned or mismatched events before fulfillment.",
      "Make handlers idempotent so webhook retries stay safe.",
    ],
    sections: [
      {
        title: "Verify first",
        description:
          "Check the X-Outpay-Signature header before trusting the payload or updating your database.",
      },
      {
        title: "Fulfill once",
        description:
          "Store processed event or checkout IDs so repeated deliveries do not duplicate shipments.",
      },
      {
        title: "Monitor delivery",
        description:
          "Use dashboard logs to inspect response codes and fix endpoint failures quickly.",
      },
    ],
    proof: [
      { value: "HMAC", label: "verification" },
      { value: "Retry", label: "delivery model" },
      { value: "Paid", label: "fulfillment event" },
    ],
    code: `const signature = request.headers.get("X-Outpay-Signature");
const verified = verifyOutpaySignature(rawBody, signature, webhookSecret);

if (verified && event.event === "checkout.paid") {
  await fulfillOrder(event.checkout_id);
}`,
  },
  quickstart: {
    eyebrow: "Developers",
    title: "Go from checkout link to verified payment",
    description:
      "Create a checkout, send the hosted payment link, and receive a signed webhook when the transfer confirms.",
    icon: Rocket,
    primaryCta: "Start integration",
    secondaryCta: "See pricing",
    secondaryHref: "/pricing",
    highlights: [
      "Create an account and add the wallet that should receive USDC.",
      "Generate a checkout for the order amount and send the hosted URL.",
      "Listen for checkout.paid before fulfilling the order.",
    ],
    sections: [
      {
        title: "1. Add your wallet",
        description:
          "Choose the merchant wallet that should receive customer USDC payments on Base.",
      },
      {
        title: "2. Create checkout",
        description:
          "Use the dashboard or API to create an exact-amount payment request.",
      },
      {
        title: "3. Fulfill from webhook",
        description:
          "Update your order only when your backend receives a verified checkout.paid event.",
      },
    ],
    proof: [
      { value: "3", label: "integration steps" },
      { value: "1", label: "API call to start" },
      { value: "0", label: "custody setup" },
    ],
    code: `1. Add merchant wallet
2. Create checkout for 124.00 USDC
3. Send checkout_url to customer
4. Fulfill when checkout.paid arrives`,
  },
};

export type MarketingDetailSlug = keyof typeof PAGE_CONFIGS;

/**
 * Route-specific hero visual. The dropdown pages share data plumbing, but the
 * first viewport changes by page so each feature reads as a distinct product
 * surface instead of a repeated template.
 */
function HeroVisual({
  slug,
  config,
}: {
  slug: MarketingDetailSlug;
  config: DetailPageConfig;
}) {
  const Icon = config.icon;

  if (slug === "checkout-links") {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="border border-border rounded-lg bg-background overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">
              Checkout link
            </div>
            <div className="font-mono text-xs text-foreground-lighter">
              chk_9k2n
            </div>
          </div>
          <div className="p-5 flex flex-col gap-4">
            <div>
              <div className="text-xs text-foreground-lighter mb-1">Amount</div>
              <div className="text-[34px] font-semibold tracking-[-0.02em] text-foreground">
                124.00 USDC
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {["Base only", "Wallet-to-wallet"].map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-border bg-card px-3.5 py-3 text-sm font-medium text-foreground"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-background-surface-200 p-3.5 font-mono text-xs text-foreground break-all">
              https://outpay.dev/checkout/chk_9k2n
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (slug === "merchant-dashboard") {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            ["Payment volume", "$48,204.12"],
            ["Webhook success", "99.4%"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border border-border rounded-lg bg-background p-3.5"
            >
              <div className="heading-meta text-foreground-lighter mb-1.5">
                {label}
              </div>
              <div className="text-xl font-semibold text-foreground">
                {value}
              </div>
            </div>
          ))}
        </div>
        <div className="border border-border rounded-lg bg-background overflow-hidden">
          {["chk_9k2n paid", "chk_1b7e pending", "chk_5a7f expired"].map(
            (row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <span className="font-mono text-xs text-foreground">
                  {row.split(" ")[0]}
                </span>
                <span className="text-xs text-foreground-light">
                  {row.split(" ")[1]}
                </span>
              </div>
            ),
          )}
        </div>
      </div>
    );
  }

  if (slug === "payment-detection") {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        {[
          "Checkout created",
          "USDC transfer observed",
          "Amount and wallet matched",
          "checkout.paid emitted",
        ].map((step, index) => (
          <div key={step} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-accent border border-border flex items-center justify-center text-xs font-medium text-foreground">
                {index + 1}
              </div>
              {index < 3 && <div className="w-px h-9 bg-border my-1.5" />}
            </div>
            <div className="pt-1.5">
              <div className="text-sm font-semibold text-foreground">
                {step}
              </div>
              <div className="text-xs text-foreground-lighter mt-1">
                Base · USDC · exact amount
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (config.code) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Icon size={16} />
          </div>
          <div className="text-sm font-semibold text-foreground">
            Implementation preview
          </div>
        </div>
        <pre className="m-0 bg-background-surface-200 border border-border rounded-lg p-4 font-mono text-xs leading-[1.8] text-foreground whitespace-pre-wrap break-all">
          {config.code}
        </pre>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
      <div className="w-12 h-12 rounded-[10px] bg-accent flex items-center justify-center mb-6">
        <Icon size={24} />
      </div>
      <div className="flex flex-col gap-4">
        {config.highlights.map((item) => (
          <div key={item} className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-background-surface-200 flex items-center justify-center shrink-0">
              <Check size={13} />
            </div>
            <div className="text-sm text-foreground-light leading-[1.55]">
              {item}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Marketing detail route renderer for product and developer dropdown pages.
 * It exposes one consistent page structure while each route supplies its own
 * product positioning, proof points, and implementation guidance.
 */
export default function MarketingDetailPage({
  slug,
}: {
  slug: MarketingDetailSlug;
}) {
  const config = PAGE_CONFIGS[slug];
  const isDeveloperPage = config.eyebrow === "Developers";

  return (
    <div className="bg-background min-h-screen font-sans flex flex-col">
      <div className="sticky top-0 z-20">
        <MarketingNavbar />
      </div>

      <div className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 780px 400px at 50% -20%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 68%)",
          }}
        />
        <div className="relative max-w-content mx-auto grid grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-[88px]">
          <div className="op-hero-in flex flex-col gap-5">
            <div className="heading-meta text-foreground-lighter">
              {config.eyebrow}
            </div>
            <h1 className="text-[34px] font-semibold tracking-normal leading-[1.12] text-foreground m-0 sm:text-[46px] sm:leading-[1.1]">
              {config.title}
            </h1>
            <p className="text-base leading-[1.6] text-foreground-light m-0">
              {config.description}
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <Link
                href="/signup"
                className="h-[38px] px-4 text-sm gap-2 inline-flex items-center justify-center font-sans font-body whitespace-nowrap transition-all duration-200 ease-out cursor-pointer rounded-sm bg-primary text-foreground border border-primary/75 hover:brightness-95 no-underline"
              >
                {config.primaryCta}
              </Link>
              <Link
                href={config.secondaryHref}
                className="h-[38px] px-4 text-sm gap-2 inline-flex items-center justify-center font-sans font-body whitespace-nowrap transition-all duration-200 ease-out cursor-pointer rounded-sm bg-transparent border border-border-strong text-foreground hover:bg-accent no-underline"
              >
                {config.secondaryCta}
              </Link>
            </div>
          </div>
          <div className="op-hero-in-delay">
            <HeroVisual slug={slug} config={config} />
          </div>
        </div>
      </div>

      <div className="op-reveal max-w-content mx-auto w-full px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card shadow-xs sm:grid-cols-3">
          {config.proof.map((item) => (
            <div
              key={item.label}
              className="border-b border-border px-7 py-6 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
            >
              <div className="text-[30px] font-semibold tracking-[-0.02em] text-foreground">
                {item.value}
              </div>
              <div className="text-sm text-foreground-light mt-1">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {config.offers && config.advantages && (
        <div className="max-w-content mx-auto w-full px-4 pb-16 sm:px-6 lg:pb-20">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="op-reveal border border-border rounded-xl bg-card shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <div className="heading-meta text-foreground-lighter mb-1">
                    What it offers
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    Product capabilities
                  </div>
                </div>
                <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
                  <config.icon size={17} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
                {config.offers.map((offer) => (
                  <div
                    key={offer}
                    className="border-b border-border p-5 sm:border-r sm:odd:border-r sm:last:border-b-0"
                  >
                    <div className="w-6 h-6 rounded-full bg-accent border border-border flex items-center justify-center mb-3">
                      <Check size={12} />
                    </div>
                    <div className="text-sm text-foreground leading-[1.5]">
                      {offer}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="op-reveal border border-border rounded-xl bg-background shadow-xs p-5">
              <div className="heading-meta text-foreground-lighter mb-2">
                Why Outpay is better
              </div>
              <h2 className="text-[24px] font-semibold tracking-normal leading-[1.2] text-foreground m-0 mb-5">
                Built for operational trust, not manual crypto payment handling.
              </h2>
              <div className="flex flex-col gap-3">
                {config.advantages.map((advantage, index) => (
                  <div
                    key={advantage}
                    className="relative overflow-hidden rounded-lg border border-border bg-card p-4"
                  >
                    <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
                    <div className="font-mono text-[11px] text-foreground-lighter mb-1">
                      0{index + 1}
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      {advantage}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card border-y border-border">
        <div
          className={[
            "max-w-content mx-auto gap-5 px-4 py-16 sm:px-6 lg:py-20",
            isDeveloperPage
              ? "grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr]"
              : "grid grid-cols-1 md:grid-cols-3",
          ].join(" ")}
        >
          {isDeveloperPage ? (
            <>
              <div className="flex flex-col gap-2">
                <div className="heading-meta text-foreground-lighter">
                  Build path
                </div>
                <h2 className="text-[24px] font-semibold tracking-normal text-foreground m-0 sm:text-[26px]">
                  Server-side first, checkout last
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {config.sections.map((section) => (
                  <div
                    key={section.title}
                    className="op-reveal border border-border rounded-xl bg-background p-5 flex gap-4"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
                      <Check size={15} />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-foreground mb-1.5">
                        {section.title}
                      </h3>
                      <div className="text-sm text-foreground-light leading-[1.55]">
                        {section.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            config.sections.map((section, index) => (
              <div
                key={section.title}
                className={[
                  "op-reveal border border-border rounded-xl p-6 flex flex-col gap-3",
                  index === 1 ? "bg-background" : "bg-card",
                ].join(" ")}
              >
                <div className="heading-meta text-foreground-lighter">
                  0{index + 1}
                </div>
                <h3 className="text-[15px] font-semibold text-foreground">
                  {section.title}
                </h3>
                <div className="text-sm text-foreground-light leading-[1.55]">
                  {section.description}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {config.code && (
        <div className="max-w-content mx-auto grid w-full grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:py-20">
          <div className="op-reveal flex flex-col gap-4">
            <div className="heading-meta text-foreground-lighter">
              Implementation
            </div>
            <h2 className="text-[24px] font-semibold tracking-normal text-foreground m-0 sm:text-[26px]">
              Designed for backend-controlled checkout
            </h2>
            <p className="text-sm text-foreground-light leading-[1.6] m-0">
              Keep payment creation, webhook verification, and order fulfillment
              on your server. Customers only see the hosted checkout page and
              wallet payment request.
            </p>
          </div>
          <div className="op-reveal bg-card border border-border rounded-xl p-5 shadow-xs">
            <pre className="m-0 bg-background-surface-200 border border-border rounded-lg p-4 font-mono text-xs leading-[1.8] text-foreground whitespace-pre-wrap break-all">
              {config.code}
            </pre>
          </div>
        </div>
      )}

      <div className="max-w-content mx-auto flex w-full flex-col items-center gap-5 px-4 py-16 text-center sm:px-6 lg:py-20">
        <h2 className="op-reveal text-[28px] font-semibold tracking-normal text-foreground m-0 sm:text-[34px]">
          Ready to run USDC checkout like payment infrastructure?
        </h2>
        <p className="op-reveal text-sm text-foreground-light m-0 max-w-[520px]">
          Start with hosted checkout links, then add the API and webhooks when
          you want a deeper store integration.
        </p>
        <Link
          href="/pricing"
          className="no-underline text-sm font-medium text-foreground inline-flex items-center gap-1.5"
        >
          Review pricing <ArrowRight size={14} />
        </Link>
      </div>

      <MarketingFooter />
    </div>
  );
}
