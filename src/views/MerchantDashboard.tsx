"use client";

import { Check, Copy, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { DashboardSidebar } from "../components/layout/DashboardSidebar";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import {
  StatusPill,
  type StatusPillVariant,
} from "../components/ui/StatusPill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/Table";

interface Payment {
  date: string;
  amount: string;
  statusVariant: StatusPillVariant;
  statusLabel: string;
  wallet: string;
  hash: string;
}

const RAW_PAYMENTS: Payment[] = [
  {
    date: "Jul 6, 2026",
    amount: "124.00 USDC",
    statusVariant: "success",
    statusLabel: "Paid",
    wallet: "0x71C7...976F",
    hash: "0x3a9f...81be",
  },
  {
    date: "Jul 6, 2026",
    amount: "58.50 USDC",
    statusVariant: "warning",
    statusLabel: "Pending",
    wallet: "0x4A2f...11cD",
    hash: "0x9e12...4d0a",
  },
  {
    date: "Jul 5, 2026",
    amount: "312.00 USDC",
    statusVariant: "success",
    statusLabel: "Paid",
    wallet: "0xE81b...f7A2",
    hash: "0x7c56...f2e1",
  },
  {
    date: "Jul 5, 2026",
    amount: "19.99 USDC",
    statusVariant: "destructive",
    statusLabel: "Failed",
    wallet: "0x2c9D...66Ba",
    hash: "0x1b0d...9a44",
  },
  {
    date: "Jul 4, 2026",
    amount: "85.00 USDC",
    statusVariant: "success",
    statusLabel: "Paid",
    wallet: "0x9F4e...c211",
    hash: "0xd48a...33c7",
  },
  {
    date: "Jul 3, 2026",
    amount: "46.25 USDC",
    statusVariant: "warning",
    statusLabel: "Pending",
    wallet: "0x63Ab...ee09",
    hash: "0x0f6b...7ad2",
  },
];

/**
 * Merchant dashboard — metrics + recent payments table. `hasPayments=false`
 * renders the zero-state (used before a store's first payment lands).
 */
export default function MerchantDashboard({
  hasPayments = true,
}: {
  hasPayments?: boolean;
}) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyHash = (hash: string, i: number) => {
    navigator.clipboard?.writeText(hash).catch(() => {});
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 1200);
  };

  const metrics = hasPayments
    ? [
        {
          label: "Payment volume (30d)",
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
          label: "Pending checkouts",
          value: "9",
          sub: "awaiting confirmation",
          subColor: "text-warning",
        },
        {
          label: "Webhook success rate",
          value: "99.4%",
          sub: "3 retried, 0 dropped",
          subColor: "text-foreground-lighter",
        },
      ]
    : [
        {
          label: "Payment volume (30d)",
          value: "$0.00",
          sub: "0 checkouts",
          subColor: "text-foreground-lighter",
        },
        {
          label: "Paid checkouts",
          value: "0",
          sub: "no completions yet",
          subColor: "text-foreground-lighter",
        },
        {
          label: "Pending checkouts",
          value: "0",
          sub: "nothing awaiting",
          subColor: "text-foreground-lighter",
        },
        {
          label: "Webhook success rate",
          value: "—",
          sub: "no deliveries yet",
          subColor: "text-foreground-lighter",
        },
      ];

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar active="dashboard" />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between px-8 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[7px] bg-accent flex items-center justify-center text-xs font-semibold">
              AC
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Acme Coffee Co.</span>
              <span className="text-[11px] text-foreground-lighter">
                outpay.dev/acme-coffee
              </span>
            </div>
          </div>
          <Button variant="primary" size="medium">
            Create checkout
          </Button>
        </div>

        <div className="px-8 pt-7 pb-12 flex flex-col gap-5">
          <div>
            <h1 className="heading-title m-0">Dashboard</h1>
            <p className="m-0 mt-1.5 text-xs text-foreground-lighter">
              Payment volume and checkout status across your store.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {metrics.map((m) => (
              <Card key={m.label}>
                <CardContent className="border-b-0">
                  <div className="heading-meta text-foreground-lighter mb-2">
                    {m.label}
                  </div>
                  <div className="text-2xl font-medium text-foreground">
                    {m.value}
                  </div>
                  <div className={["text-xs mt-1", m.subColor].join(" ")}>
                    {m.sub}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent payments</CardTitle>
              <CardDescription>
                Latest payment activity across your store
              </CardDescription>
            </CardHeader>

            {hasPayments ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer wallet</TableHead>
                    <TableHead>Transaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RAW_PAYMENTS.map((p, i) => (
                    <TableRow key={`${p.date}-${p.hash}`}>
                      <TableCell className="text-foreground-light">
                        {p.date}
                      </TableCell>
                      <TableCell className="font-medium">{p.amount}</TableCell>
                      <TableCell>
                        <StatusPill variant={p.statusVariant}>
                          {p.statusLabel}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground-light">
                        {p.wallet}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-foreground-light">
                          {p.hash}
                          {copiedIndex === i ? (
                            <Check
                              size={14}
                              className="cursor-pointer opacity-90"
                            />
                          ) : (
                            <Copy
                              size={14}
                              className="cursor-pointer opacity-55"
                              onClick={() => copyHash(p.hash, i)}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-16 px-8 text-center">
                <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center">
                  <LinkIcon size={20} className="opacity-70" />
                </div>
                <div className="text-sm font-semibold text-foreground">
                  No payments yet
                </div>
                <div className="text-sm text-foreground-lighter max-w-[320px] leading-[1.5]">
                  Create a checkout link and share it with a customer to see
                  your first USDC payment show up here.
                </div>
                <Button variant="primary" size="medium" className="mt-2">
                  Create your first checkout
                </Button>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
