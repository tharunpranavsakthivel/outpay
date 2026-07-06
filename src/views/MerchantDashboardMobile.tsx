"use client";

import {
  ArrowLeftRight,
  Bell,
  Check,
  Copy,
  LayoutDashboard,
  Link as LinkIcon,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "../components/ui/Card";
import {
  StatusPill,
  type StatusPillVariant,
} from "../components/ui/StatusPill";

const TABS = [
  { id: "dashboard", label: "Home", Icon: LayoutDashboard },
  { id: "checkouts", label: "Checkouts", Icon: LinkIcon },
  { id: "payments", label: "Payments", Icon: ArrowLeftRight },
  { id: "settings", label: "Settings", Icon: Settings },
];

const METRICS = [
  {
    label: "Volume (30d)",
    value: "$48,204.12",
    sub: "312 checkouts",
    subColor: "text-foreground-lighter",
  },
  {
    label: "Paid checkouts",
    value: "287",
    sub: "92% completion",
    subColor: "text-foreground-lighter",
  },
  {
    label: "Pending",
    value: "9",
    sub: "awaiting confirm.",
    subColor: "text-warning",
  },
  {
    label: "Webhook success",
    value: "99.4%",
    sub: "3 retried",
    subColor: "text-foreground-lighter",
  },
];

const RAW_PAYMENTS: {
  date: string;
  amount: string;
  statusVariant: StatusPillVariant;
  statusLabel: string;
  wallet: string;
  hash: string;
}[] = [
  {
    date: "Jul 6, 2:41 PM",
    amount: "124.00 USDC",
    statusVariant: "success",
    statusLabel: "Paid",
    wallet: "0x71C7…976F",
    hash: "0x3a9f…81be",
  },
  {
    date: "Jul 6, 11:02 AM",
    amount: "58.50 USDC",
    statusVariant: "warning",
    statusLabel: "Pending",
    wallet: "0x4A2f…11cD",
    hash: "0x9e12…4d0a",
  },
  {
    date: "Jul 5, 4:18 PM",
    amount: "312.00 USDC",
    statusVariant: "success",
    statusLabel: "Paid",
    wallet: "0xE81b…f7A2",
    hash: "0x7c56…f2e1",
  },
  {
    date: "Jul 5, 9:47 AM",
    amount: "19.99 USDC",
    statusVariant: "destructive",
    statusLabel: "Failed",
    wallet: "0x2c9D…66Ba",
    hash: "0x1b0d…9a44",
  },
  {
    date: "Jul 4, 3:05 PM",
    amount: "85.00 USDC",
    statusVariant: "success",
    statusLabel: "Paid",
    wallet: "0x9F4e…c211",
    hash: "0xd48a…33c7",
  },
  {
    date: "Jul 3, 1:29 PM",
    amount: "46.25 USDC",
    statusVariant: "warning",
    statusLabel: "Pending",
    wallet: "0x63Ab…ee09",
    hash: "0x0f6b…7ad2",
  },
];

/** Mobile (393px phone-canvas) merchant dashboard with bottom tab bar. */
export default function MerchantDashboardMobile() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const copyHash = (hash: string, i: number) => {
    navigator.clipboard?.writeText(hash).catch(() => {});
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 1200);
  };

  return (
    <div className="min-h-screen bg-background-surface-200 font-sans text-foreground flex justify-center py-6">
      <div className="w-[393px] max-w-full min-h-[852px] bg-background border border-border rounded-[28px] shadow-md overflow-hidden flex flex-col relative">
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-[26px] h-[26px] rounded-[7px] bg-accent shrink-0 flex items-center justify-center text-[11px] font-semibold">
              AC
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-semibold text-foreground truncate">
                Acme Coffee Co.
              </span>
              <span className="text-[10.5px] text-foreground-lighter">
                outpay.dev/acme-coffee
              </span>
            </div>
          </div>
          <Bell size={18} className="opacity-70 shrink-0" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-24 flex flex-col gap-4">
          <div>
            <h1 className="heading-title m-0 text-[19px]">Dashboard</h1>
            <p className="m-0 mt-1 text-[12.5px] text-foreground-lighter">
              Payment volume and checkout status.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {METRICS.map((m) => (
              <Card key={m.label}>
                <CardContent className="border-b-0 p-3">
                  <div className="heading-meta text-foreground-lighter mb-1.5 text-[10px] leading-[1.3]">
                    {m.label}
                  </div>
                  <div className="text-lg font-medium text-foreground leading-[1.1]">
                    {m.value}
                  </div>
                  <div className={["text-[11px] mt-1", m.subColor].join(" ")}>
                    {m.sub}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-foreground">
                Recent payments
              </span>
              <span className="text-xs text-foreground-lighter">See all</span>
            </div>
            {RAW_PAYMENTS.map((p, i) => (
              <Card key={`${p.date}-${p.amount}`}>
                <CardContent className="border-b-0 px-3.5 py-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-medium text-foreground">
                      {p.amount}
                    </span>
                    <StatusPill variant={p.statusVariant}>
                      {p.statusLabel}
                    </StatusPill>
                  </div>
                  <div className="flex items-center justify-between text-[11.5px] text-foreground-lighter">
                    <span>{p.date}</span>
                    <span className="font-mono">{p.wallet}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-foreground-light border-t border-border pt-2">
                    {p.hash}
                    {copiedIndex === i ? (
                      <Check size={13} className="opacity-90" />
                    ) : (
                      <Copy
                        size={13}
                        className="cursor-pointer opacity-55"
                        onClick={() => copyHash(p.hash, i)}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <nav className="absolute left-0 right-0 bottom-0 bg-background border-t border-border grid grid-cols-5 px-1 pt-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))]">
          {TABS.map((tab, i) => (
            <div
              key={tab.id}
              className="flex flex-col items-center gap-[3px] px-0.5 py-1 cursor-pointer"
            >
              <tab.Icon
                size={20}
                className={i === 0 ? "opacity-95" : "opacity-55"}
              />
              <span
                className={[
                  "text-[10px] font-body",
                  i === 0 ? "text-foreground" : "text-foreground-lighter",
                ].join(" ")}
              >
                {tab.label}
              </span>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
