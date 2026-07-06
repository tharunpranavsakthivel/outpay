"use client";

import { Ban, Check, Copy, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { DashboardSidebar } from "../components/layout/DashboardSidebar";
import { Button } from "../components/ui/Button";
import {
  Card,
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

interface Checkout {
  name: string;
  amount: string;
  statusVariant: StatusPillVariant;
  statusLabel: string;
  created: string;
  canDeactivate: boolean;
}

const RAW: Checkout[] = [
  {
    name: "Order #4192",
    amount: "124.00 USDC",
    statusVariant: "success",
    statusLabel: "Paid",
    created: "Jul 6, 2026",
    canDeactivate: false,
  },
  {
    name: "Order #4191",
    amount: "58.50 USDC",
    statusVariant: "default",
    statusLabel: "Active",
    created: "Jul 6, 2026",
    canDeactivate: true,
  },
  {
    name: "Wholesale invoice — Fern & Co.",
    amount: "1,240.00 USDC",
    statusVariant: "default",
    statusLabel: "Active",
    created: "Jul 5, 2026",
    canDeactivate: true,
  },
  {
    name: "Order #4188",
    amount: "19.99 USDC",
    statusVariant: "secondary",
    statusLabel: "Expired",
    created: "Jul 2, 2026",
    canDeactivate: false,
  },
  {
    name: "Order #4183",
    amount: "312.00 USDC",
    statusVariant: "success",
    statusLabel: "Paid",
    created: "Jun 29, 2026",
    canDeactivate: false,
  },
  {
    name: "Pop-up event pass",
    amount: "45.00 USDC",
    statusVariant: "default",
    statusLabel: "Active",
    created: "Jun 27, 2026",
    canDeactivate: true,
  },
];

/** Checkouts list — table of every checkout link created for the store, with an empty state. */
export default function CheckoutsList({
  hasCheckouts = true,
}: {
  hasCheckouts?: boolean;
}) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const copy = (i: number) => {
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 1200);
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar active="checkouts" />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between px-8 py-4 border-b border-border">
          <h1 className="heading-title m-0">Checkouts</h1>
          <Button
            variant="primary"
            size="medium"
            onClick={() => {
              window.location.href = "/checkouts/new";
            }}
          >
            Create checkout
          </Button>
        </div>

        <div className="px-8 pt-7 pb-12 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>All checkout links</CardTitle>
              <CardDescription>
                Every checkout link you've created for this store
              </CardDescription>
            </CardHeader>

            {hasCheckouts ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RAW.map((c, i) => (
                    <TableRow key={`${c.name}-${c.created}`}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.amount}</TableCell>
                      <TableCell>
                        <StatusPill variant={c.statusVariant}>
                          {c.statusLabel}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="text-foreground-light">
                        {c.created}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => copy(i)}
                            title="Copy link"
                            className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer hover:bg-accent border-0 bg-transparent"
                          >
                            {copiedIndex === i ? (
                              <Check size={14} className="opacity-70" />
                            ) : (
                              <Copy size={14} className="opacity-60" />
                            )}
                          </button>
                          {c.canDeactivate && (
                            <button
                              type="button"
                              title="Deactivate"
                              className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer hover:bg-accent border-0 bg-transparent"
                            >
                              <Ban size={14} className="opacity-60" />
                            </button>
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
                  No checkout links yet
                </div>
                <div className="text-sm text-foreground-lighter max-w-[320px] leading-[1.5]">
                  Create a checkout link to start accepting USDC payments for an
                  order.
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
