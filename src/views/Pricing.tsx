"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calculator,
  Check,
  ReceiptText,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { MarketingFooter } from "../components/layout/MarketingFooter";
import { MarketingNavbar } from "../components/layout/MarketingNavbar";
import { Button } from "../components/ui/Button";
import {
  calculateProjectedUsageFee,
  STANDARD_FREE_TRANSACTION_ALLOWANCE,
  STANDARD_USAGE_FEE_RATE,
} from "../lib/billing/metering";

const FREE_TRANSACTIONS = STANDARD_FREE_TRANSACTION_ALLOWANCE;
const OUTPAY_RATE = STANDARD_USAGE_FEE_RATE;
const PROCESSOR_RATE = 0.029;
const PROCESSOR_FIXED_FEE = 0.3;

const INCLUDED_ITEMS = [
  "Hosted checkout links",
  "Merchant dashboard",
  "Payment detection on Base",
  "Signed webhooks",
  "REST API",
  "Checkout operations history",
];

const EXAMPLES = [
  {
    volume: "800",
    fee: "$0",
    desc: "Below the monthly free allowance.",
  },
  {
    volume: "1,250",
    fee: "1.5% on 250",
    desc: "Only the extra confirmed transactions are charged.",
  },
  {
    volume: "12,000",
    fee: "Contact us",
    desc: "Corporate terms for higher-volume merchants.",
  },
];

const VALUE_POINTS = [
  {
    Icon: Calculator,
    title: "Predictable threshold",
    desc: "The free allowance resets every month and applies to paid checkouts.",
  },
  {
    Icon: TrendingUp,
    title: "No subscription drag",
    desc: "Launch without a monthly platform fee while you prove demand.",
  },
  {
    Icon: ShieldCheck,
    title: "No custody fee",
    desc: "Funds settle directly to your wallet; Outpay does not hold balances.",
  },
];

const FAQS = [
  {
    q: "What is free?",
    a: "Your first 1,000 paid transactions each month are free. Unpaid, expired, or abandoned checkouts do not count.",
  },
  {
    q: "What happens after 1,000 transactions?",
    a: "Outpay charges 1.5% per confirmed paid transaction above the monthly free allowance.",
  },
  {
    q: "Do corporate merchants get custom terms?",
    a: "Yes. Contact us for volume pricing, onboarding support, and commercial terms.",
  },
  {
    q: "Does Outpay hold funds?",
    a: "No. Customers pay your wallet directly in USDC on Base. Outpay verifies the transfer and sends payment events.",
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function rangeStyle(value: number, min: number, max: number): CSSProperties {
  return {
    "--range-progress": `${((value - min) / (max - min)) * 100}%`,
  } as CSSProperties;
}

/** Pricing page for Outpay's free allowance, usage fee, and corporate path. */
export default function Pricing() {
  const [transactions, setTransactions] = useState(2500);
  const [averageOrderValue, setAverageOrderValue] = useState(80);

  const savingsModel = useMemo(() => {
    const monthlyVolume = transactions * averageOrderValue;
    const billableTransactions = Math.max(0, transactions - FREE_TRANSACTIONS);
    const outpayFee = calculateProjectedUsageFee({
      averageOrderValueUsd: averageOrderValue,
      freeTransactionAllowance: FREE_TRANSACTIONS,
      transactionCount: transactions,
      usageFeeRate: OUTPAY_RATE,
    });
    const processorFee =
      monthlyVolume * PROCESSOR_RATE + transactions * PROCESSOR_FIXED_FEE;
    const savings = Math.max(0, processorFee - outpayFee);

    return {
      billableTransactions,
      monthlyVolume,
      outpayFee,
      processorFee,
      savings,
    };
  }, [transactions, averageOrderValue]);

  return (
    <div className="bg-background min-h-screen font-sans flex flex-col">
      <div className="sticky top-0 z-20">
        <MarketingNavbar activeHref="/pricing" />
      </div>

      <section className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 820px 420px at 50% -18%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 68%)",
          }}
        />
        <div className="relative max-w-content mx-auto grid grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-[88px]">
          <div className="op-hero-in flex flex-col gap-5">
            <div className="heading-meta text-foreground-lighter">Pricing</div>
            <h1 className="text-[36px] font-semibold leading-[1.12] tracking-normal text-foreground m-0 sm:text-[48px] sm:leading-[1.08]">
              Start free. Pay only when volume grows.
            </h1>
            <p className="text-base leading-[1.65] text-foreground-light m-0 max-w-[560px]">
              Outpay is free for the first 1,000 paid transactions each month.
              After that, usage is 1.5% per confirmed transaction. Corporate
              merchants can contact us for custom terms.
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <Button variant="primary" size="medium">
                Start free
              </Button>
              <Link
                href="/company/contact"
                className="h-[38px] px-4 text-sm gap-2 inline-flex items-center justify-center font-sans font-body whitespace-nowrap transition-all duration-200 ease-out cursor-pointer rounded-sm bg-transparent border border-border-strong text-foreground hover:bg-accent no-underline"
              >
                Contact sales
              </Link>
            </div>
          </div>

          <div className="op-hero-in-delay rounded-xl border border-border bg-card shadow-xs p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="heading-meta text-foreground-lighter mb-1">
                  Monthly model
                </div>
                <div className="text-sm font-medium text-foreground">
                  One allowance, one usage rate
                </div>
              </div>
              <ReceiptText size={20} className="text-foreground-lighter" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div>
                <div className="text-[38px] font-semibold leading-none text-foreground sm:text-[48px]">
                  1,000
                </div>
                <div className="text-sm text-foreground-light mt-2">
                  paid transactions free every month
                </div>
              </div>
              <div className="h-px w-full bg-border sm:w-14" />
              <div>
                <div className="text-[38px] font-semibold leading-none text-foreground sm:text-[48px]">
                  1.5%
                </div>
                <div className="text-sm text-foreground-light mt-2">
                  only on paid transactions after that
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Corporate volume
                </div>
                <div className="text-xs text-foreground-light mt-1">
                  Custom pricing and onboarding for larger programs.
                </div>
              </div>
              <Link
                href="/company/contact"
                className="text-sm font-medium text-foreground no-underline inline-flex items-center gap-1.5"
              >
                Contact sales <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-content mx-auto w-full px-4 py-16 sm:px-6 lg:py-20">
        <div className="op-reveal max-w-[720px] mx-auto text-center mb-10">
          <div className="heading-meta text-foreground-lighter mb-3">
            Savings calculator
          </div>
          <h2 className="text-[30px] font-semibold leading-[1.16] tracking-normal text-foreground m-0 sm:text-[38px] sm:leading-[1.12]">
            See the monthly savings clearly.
          </h2>
          <p className="text-sm text-foreground-light leading-[1.65] mt-4 mb-0">
            Adjust volume and average order value. The benchmark is 2.9% plus
            $0.30 per paid transaction.
          </p>
        </div>

        <div className="op-reveal rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="grid grid-cols-1 border-b border-border lg:grid-cols-3">
            <div className="p-6 bg-background">
              <div className="heading-meta text-foreground-lighter mb-2">
                Estimated savings
              </div>
              <div className="text-[38px] font-semibold leading-none tracking-normal text-foreground sm:text-[48px]">
                {formatCurrency(savingsModel.savings)}
              </div>
              <div className="text-sm text-foreground-light mt-3">
                per month versus the benchmark.
              </div>
            </div>
            <div className="border-t border-border p-6 lg:border-t-0 lg:border-l">
              <div className="text-xs text-foreground-lighter mb-2">
                Outpay fee
              </div>
              <div className="text-[30px] font-semibold text-foreground">
                {formatCurrency(savingsModel.outpayFee)}
              </div>
              <div className="text-sm text-foreground-light mt-2">
                {formatNumber(savingsModel.billableTransactions)} billable after
                1,000 free.
              </div>
            </div>
            <div className="border-t border-border p-6 lg:border-t-0 lg:border-l">
              <div className="text-xs text-foreground-lighter mb-2">
                Processor benchmark
              </div>
              <div className="text-[30px] font-semibold text-foreground">
                {formatCurrency(savingsModel.processorFee)}
              </div>
              <div className="text-sm text-foreground-light mt-2">
                2.9% plus $0.30 each.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 p-6 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-foreground">
                  Paid transactions / month
                </span>
                <span className="font-mono text-sm text-foreground">
                  {formatNumber(transactions)}
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="20000"
                step="100"
                value={transactions}
                onChange={(event) =>
                  setTransactions(Number(event.target.value))
                }
                className="op-range w-full"
                style={rangeStyle(transactions, 100, 20000)}
              />
              <div className="flex justify-between text-[11px] text-foreground-lighter">
                <span>100</span>
                <span>20,000</span>
              </div>
            </label>

            <label className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-foreground">
                  Average order value
                </span>
                <span className="font-mono text-sm text-foreground">
                  {formatCurrency(averageOrderValue)}
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="500"
                step="5"
                value={averageOrderValue}
                onChange={(event) =>
                  setAverageOrderValue(Number(event.target.value))
                }
                className="op-range w-full"
                style={rangeStyle(averageOrderValue, 10, 500)}
              />
              <div className="flex justify-between text-[11px] text-foreground-lighter">
                <span>$10</span>
                <span>$500</span>
              </div>
            </label>

            <div className="rounded-lg border border-border bg-background p-4 lg:min-w-[210px]">
              <div className="text-xs text-foreground-lighter mb-1">
                Monthly volume
              </div>
              <div className="text-[26px] font-semibold tracking-normal text-foreground">
                {formatCurrency(savingsModel.monthlyVolume)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-content mx-auto w-full px-4 py-16 sm:px-6 lg:py-20">
        <div className="op-reveal mb-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:gap-12">
          <div>
            <div className="heading-meta text-foreground-lighter">
              Usage examples
            </div>
            <h2 className="text-[28px] font-semibold leading-[1.18] tracking-normal text-foreground m-0 sm:text-[34px] sm:leading-[1.16]">
              Clear before you scale.
            </h2>
          </div>
          <p className="text-sm text-foreground-light leading-[1.65] m-0">
            Pricing follows confirmed checkout volume. Teams can launch,
            validate demand, and move into corporate terms when the payment
            program is large enough to need them.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {EXAMPLES.map((example) => (
            <div
              key={example.volume}
              className="op-reveal border border-border rounded-xl bg-card p-6"
            >
              <div className="text-xs text-foreground-lighter mb-2">
                Monthly paid transactions
              </div>
              <div className="text-[38px] font-semibold leading-none text-foreground">
                {example.volume}
              </div>
              <div className="border-t border-border mt-6 pt-5">
                <div className="text-[15px] font-semibold text-foreground mb-2">
                  {example.fee}
                </div>
                <div className="text-sm text-foreground-light leading-[1.55]">
                  {example.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="max-w-content mx-auto grid grid-cols-1 items-start gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12 lg:py-20">
          <div className="op-reveal">
            <div className="heading-meta text-foreground-lighter mb-3">
              Included
            </div>
            <h2 className="text-[28px] font-semibold leading-[1.18] tracking-normal text-foreground m-0 sm:text-[34px] sm:leading-[1.16]">
              One platform surface for checkout operations.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {INCLUDED_ITEMS.map((item) => (
              <div
                key={item}
                className="op-reveal flex items-center gap-2.5 border border-border rounded-lg bg-background px-4 py-3"
              >
                <Check size={15} className="text-foreground" />
                <div className="text-sm text-foreground">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-content mx-auto grid grid-cols-1 gap-5 px-4 py-16 sm:px-6 md:grid-cols-3 lg:py-20">
        {VALUE_POINTS.map((point) => (
          <div
            key={point.title}
            className="op-reveal border border-border rounded-xl bg-card p-6"
          >
            <div className="w-10 h-10 rounded-[10px] bg-accent flex items-center justify-center mb-5">
              <point.Icon size={19} />
            </div>
            <div className="text-[15px] font-semibold text-foreground mb-2">
              {point.title}
            </div>
            <div className="text-sm text-foreground-light leading-[1.55]">
              {point.desc}
            </div>
          </div>
        ))}
      </section>

      <section className="bg-card border-y border-border">
        <div className="max-w-content mx-auto grid grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:py-20">
          <div className="op-reveal flex flex-col gap-4">
            <div className="heading-meta text-foreground-lighter">
              Corporate
            </div>
            <h2 className="text-[28px] font-semibold leading-[1.18] tracking-normal text-foreground m-0 sm:text-[34px] sm:leading-[1.16]">
              High-volume stablecoin checkout needs a direct conversation.
            </h2>
            <p className="text-sm text-foreground-light leading-[1.65] m-0">
              Contact us for corporate pricing, implementation planning,
              onboarding support, and commercial terms for larger payment
              programs.
            </p>
            <Link
              href="/company/contact"
              className="no-underline text-sm font-medium text-foreground inline-flex items-center gap-1.5"
            >
              Contact sales <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="op-reveal border border-border rounded-xl bg-background p-6">
            {[
              "Volume pricing",
              "Implementation support",
              "Commercial terms",
              "Payment operations review",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between py-4 border-b border-border last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                    <Building2 size={15} />
                  </div>
                  <span className="text-sm text-foreground">{item}</span>
                </div>
                <ArrowRight size={14} className="text-foreground-lighter" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-[760px] flex-col gap-8 px-4 py-16 sm:px-6 lg:py-20">
        <div className="op-reveal text-center">
          <div className="heading-meta text-foreground-lighter mb-3">FAQ</div>
          <h2 className="text-[28px] font-semibold leading-[1.18] tracking-normal text-foreground m-0 sm:text-[34px] sm:leading-[1.16]">
            Pricing questions, answered.
          </h2>
        </div>
        <div className="op-reveal border border-border rounded-xl bg-card overflow-hidden">
          {FAQS.map((faq) => (
            <div
              key={faq.q}
              className="p-6 border-b border-border last:border-b-0"
            >
              <div className="text-[15px] font-semibold text-foreground mb-2">
                {faq.q}
              </div>
              <div className="text-sm text-foreground-light leading-[1.6]">
                {faq.a}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-content mx-auto grid w-full grid-cols-1 items-center gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-[1fr_auto] lg:gap-10 lg:pb-24">
        <div className="op-reveal">
          <div className="heading-meta text-foreground-lighter mb-3">
            Start now
          </div>
          <h2 className="text-[30px] font-semibold leading-[1.16] tracking-normal text-foreground m-0 max-w-[680px] sm:text-[38px] sm:leading-[1.12]">
            Launch USDC checkout free, then scale into usage pricing.
          </h2>
        </div>
        <div className="op-reveal flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button variant="primary" size="medium">
            Start free
          </Button>
          <Link
            href="/company/contact"
            className="no-underline text-sm font-medium text-foreground inline-flex items-center gap-1.5"
          >
            Contact us <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
