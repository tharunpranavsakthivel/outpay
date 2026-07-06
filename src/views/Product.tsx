"use client";

import {
  ArrowDown,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Eye,
  Link2,
  Radar,
  Wallet,
  Webhook,
} from "lucide-react";
import { MarketingFooter } from "../components/layout/MarketingFooter";
import { MarketingNavbar } from "../components/layout/MarketingNavbar";
import { Button } from "../components/ui/Button";
import { StatusPill } from "../components/ui/StatusPill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/Table";

const FLOW_STEPS = [
  {
    Icon: Link2,
    title: "Merchant creates a checkout link",
    desc: "Set an amount and generate a shareable checkout link for an order.",
  },
  {
    Icon: ExternalLink,
    title: "Customer opens the checkout page",
    desc: "The hosted checkout page shows the exact USDC amount and network.",
  },
  {
    Icon: Wallet,
    title: "Customer pays USDC on Base",
    desc: "The customer sends the exact amount directly from their own wallet.",
  },
  {
    Icon: Radar,
    title: "Outpay detects the payment on-chain",
    desc: "A worker watches Base and verifies the transfer against the checkout.",
  },
  {
    Icon: Webhook,
    title: "Merchant gets a signed webhook",
    desc: "Your store receives a signed event the moment payment confirms.",
  },
  {
    Icon: CheckCircle,
    title: "Order confirmed",
    desc: "The checkout flips to paid automatically, with no manual reconciliation.",
  },
];

const METRICS = [
  { label: "Payment volume (30d)", value: "$48,204.12" },
  { label: "Webhook success rate", value: "99.4%" },
];

const RECENT_CHECKOUTS: {
  id: string;
  amount: string;
  status: "success" | "warning" | "destructive";
  label: string;
}[] = [
  { id: "chk_9k2n", amount: "124.00 USDC", status: "success", label: "Paid" },
  { id: "chk_1b7e", amount: "58.50 USDC", status: "warning", label: "Pending" },
  {
    id: "chk_5a7f",
    amount: "19.99 USDC",
    status: "destructive",
    label: "Expired",
  },
];

/** Product page: step-by-step flow, dashboard preview, webhooks, non-custodial diagram. */
export default function Product() {
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
              "radial-gradient(ellipse 820px 420px at 50% -18%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 68%)",
          }}
        />
        <div className="relative mx-auto flex max-w-[860px] flex-col items-center gap-5 px-4 pt-16 pb-14 text-center sm:px-6 lg:pt-[88px] lg:pb-[72px]">
          <div className="op-hero-in heading-meta text-foreground-lighter">
            Product
          </div>
          <h1 className="op-hero-in text-[36px] font-semibold tracking-normal leading-[1.12] text-foreground m-0 sm:text-[48px] sm:leading-[1.08]">
            Checkout, detection, and fulfillment in one payment flow.
          </h1>
          <p className="op-hero-in-delay text-base leading-[1.65] text-foreground-light max-w-[620px] m-0">
            Outpay turns USDC on Base into a provider-grade checkout system:
            hosted payment pages, automatic transfer matching, dashboard
            visibility, and signed webhooks.
          </p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-2 px-4 py-16 sm:px-6 lg:py-[88px]">
        <div className="op-reveal flex flex-col gap-2 mb-8">
          <div className="heading-meta text-foreground-lighter">The flow</div>
          <h2 className="text-[28px] font-semibold tracking-normal leading-[1.18] text-foreground m-0 sm:text-[34px] sm:leading-[1.16]">
            Six steps from checkout to confirmed order
          </h2>
        </div>
        {FLOW_STEPS.map((step, i) => (
          <div key={step.title} className="op-reveal flex gap-5">
            <div className="flex flex-col items-center shrink-0">
              <div className="w-10 h-10 rounded-[10px] bg-accent flex items-center justify-center">
                <step.Icon size={19} />
              </div>
              {i < FLOW_STEPS.length - 1 && (
                <div className="w-px flex-1 min-h-7 bg-border my-1.5" />
              )}
            </div>
            <div className="flex flex-col gap-1 pb-8">
              <div className="heading-meta text-foreground-lighter">
                Step {i + 1}
              </div>
              <div className="text-[15px] font-semibold text-foreground">
                {step.title}
              </div>
              <div className="text-sm text-foreground-light leading-[1.55] max-w-[480px]">
                {step.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border-y border-border">
        <div
          className="max-w-content mx-auto grid grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:gap-14 lg:py-[88px]"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="heading-meta text-foreground-lighter">
              Merchant dashboard
            </div>
            <h2 className="text-[28px] font-semibold tracking-normal leading-[1.18] text-foreground m-0 sm:text-[34px] sm:leading-[1.16]">
              See every payment as it happens
            </h2>
            <p className="text-sm text-foreground-light leading-[1.6] max-w-[420px] m-0">
              Payment volume, checkout status, and webhook delivery in one view.
              No spreadsheets, no manual reconciliation.
            </p>
          </div>
          <div className="op-reveal overflow-hidden rounded-xl border border-border bg-background shadow-xs">
            <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-border">
              <div className="w-2 h-2 rounded-full bg-border-strong" />
              <div className="w-2 h-2 rounded-full bg-border-strong" />
              <div className="w-2 h-2 rounded-full bg-border-strong" />
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {METRICS.map((m) => (
                  <div
                    key={m.label}
                    className="border border-border rounded-lg p-3.5"
                  >
                    <div className="heading-meta text-foreground-lighter mb-1.5">
                      {m.label}
                    </div>
                    <div className="text-xl font-medium text-foreground">
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[420px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Checkout</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {RECENT_CHECKOUTS.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs">
                          {row.id}
                        </TableCell>
                        <TableCell>{row.amount}</TableCell>
                        <TableCell>
                          <StatusPill variant={row.status}>
                            {row.label}
                          </StatusPill>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-content mx-auto grid w-full grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:py-[88px]">
        <div className="flex flex-col gap-4">
          <div className="heading-meta text-foreground-lighter">
            Signed webhooks
          </div>
          <h2 className="text-[28px] font-semibold tracking-normal leading-[1.18] text-foreground m-0 sm:text-[34px] sm:leading-[1.16]">
            Know the instant a payment confirms
          </h2>
          <p className="text-sm text-foreground-light leading-[1.6] max-w-[440px] m-0">
            Every webhook is signed so your server can verify it came from
            Outpay. No polling; your store gets notified as soon as the payment
            is detected on Base.
          </p>
        </div>
        <div className="op-reveal bg-card border border-border rounded-xl p-5 shadow-xs">
          <pre className="m-0 overflow-x-auto rounded-lg bg-secondary p-4 font-mono text-xs leading-[1.8] text-foreground whitespace-pre-wrap break-all">{`POST /webhooks/outpay
X-Outpay-Signature: t=..., v1=...

{
  "event": "checkout.paid",
  "checkout_id": "chk_9k2n",
  "amount": "124.00",
  "currency": "USDC",
  "network": "base",
  "tx_hash": "0x71c7...976f"
}`}</pre>
        </div>
      </div>

      <div className="bg-card border-y border-border">
        <div className="max-w-content mx-auto flex flex-col items-center gap-10 px-4 py-16 sm:px-6 lg:gap-12 lg:py-[88px]">
          <div className="flex flex-col gap-2 text-center max-w-[560px]">
            <div className="heading-meta text-foreground-lighter">
              Non-custodial by design
            </div>
            <h2 className="text-[24px] font-semibold tracking-normal text-foreground m-0 sm:text-[26px]">
              Outpay never touches your funds
            </h2>
            <p className="text-sm text-foreground-light leading-[1.6] m-0">
              Payments move directly from the customer's wallet to yours. Outpay
              only reads the Base network to confirm the transfer happened.
            </p>
          </div>
          <div className="flex flex-col items-center gap-4 w-full max-w-[620px]">
            <div className="flex w-full flex-col items-center justify-center gap-6 sm:flex-row">
              <div className="flex flex-col items-center gap-2.5 flex-1">
                <div className="w-12 h-12 rounded-[10px] bg-accent flex items-center justify-center">
                  <Wallet size={24} />
                </div>
                <div className="text-sm font-semibold text-foreground">
                  Customer wallet
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1.5 sm:pb-6">
                <div className="text-[11px] font-medium text-foreground-lighter whitespace-nowrap">
                  124.00 USDC
                </div>
                <ArrowRight size={22} className="opacity-40" />
              </div>
              <div className="flex flex-col items-center gap-2.5 flex-1">
                <div className="w-12 h-12 rounded-[10px] bg-accent flex items-center justify-center">
                  <Wallet size={24} />
                </div>
                <div className="text-sm font-semibold text-foreground">
                  Merchant wallet
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <ArrowDown size={16} className="opacity-30" />
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-border-strong px-4 py-2.5 sm:rounded-full">
                <Eye size={15} className="opacity-60" />
                <div className="text-xs text-foreground-light">
                  Outpay reads the chain, verifies only, never holds funds
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-content mx-auto flex w-full flex-col items-center gap-5 px-4 py-16 text-center sm:px-6 lg:py-24">
        <h2 className="text-[28px] font-semibold tracking-normal text-foreground m-0 sm:text-[30px]">
          Ready to accept USDC?
        </h2>
        <p className="text-sm text-foreground-light m-0">
          Set up your first checkout link in minutes.
        </p>
        <Button variant="primary" size="medium">
          Start accepting USDC
        </Button>
      </div>

      <MarketingFooter />
    </div>
  );
}
