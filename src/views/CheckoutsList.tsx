"use client";

import { Ban, Check, Copy, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { DashboardSidebar } from "../components/layout/DashboardSidebar";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { StatusPill } from "../components/ui/StatusPill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/Table";
import type {
  CheckoutListItem,
  CheckoutListPageData,
} from "../lib/dashboard/types";

const STATUS_VARIANTS: Record<
  string,
  "default" | "warning" | "success" | "secondary" | "destructive"
> = {
  deactivated: "secondary",
  detected: "warning",
  expired: "secondary",
  failed: "destructive",
  paid: "success",
  pending: "default",
};

/**
 * Checkouts list view driven by checkout_sessions.
 */
export default function CheckoutsList({
  initialData,
}: {
  initialData: CheckoutListPageData;
}) {
  const [checkouts, setCheckouts] = useState(initialData.checkouts);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const copyLink = (checkout: CheckoutListItem, index: number) => {
    navigator.clipboard
      ?.writeText(`${window.location.origin}/checkout/${checkout.publicToken}`)
      .catch(() => undefined);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1200);
  };

  const deactivate = (checkoutRef: string) => {
    startTransition(async () => {
      const response = await fetch(`/api/checkouts/${checkoutRef}`, {
        body: JSON.stringify({
          action: "deactivate",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!response.ok) {
        return;
      }

      setCheckouts((current) =>
        current.map((checkout) =>
          checkout.checkoutRef === checkoutRef
            ? {
                ...checkout,
                canDeactivate: false,
                status: "deactivated",
              }
            : checkout,
        ),
      );
    });
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar
        active="checkouts"
        storeName={initialData.merchant.storeName}
      />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between px-8 py-4 border-b border-border">
          <h1 className="heading-title m-0">Checkouts</h1>
          <Link href="/checkouts/new" className="no-underline">
            <Button variant="primary" size="medium">
              Create checkout
            </Button>
          </Link>
        </div>

        <div className="px-8 pt-7 pb-12 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>All checkout links</CardTitle>
              <CardDescription>
                Every checkout session created for this merchant
              </CardDescription>
            </CardHeader>

            {checkouts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkouts.map((checkout, index) => (
                    <TableRow key={checkout.checkoutId}>
                      <TableCell className="font-medium">
                        <div>{checkout.label}</div>
                        <div className="text-xs text-foreground-lighter mt-1">
                          {checkout.orderReference ?? checkout.checkoutRef}
                        </div>
                      </TableCell>
                      <TableCell>{checkout.amountLabel}</TableCell>
                      <TableCell>
                        <StatusPill
                          variant={
                            STATUS_VARIANTS[checkout.status] ?? "default"
                          }
                        >
                          {checkout.status}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="text-foreground-light">
                        {checkout.createdAt}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => copyLink(checkout, index)}
                            title="Copy link"
                            className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer hover:bg-accent border-0 bg-transparent"
                          >
                            {copiedIndex === index ? (
                              <Check size={14} className="opacity-70" />
                            ) : (
                              <Copy size={14} className="opacity-60" />
                            )}
                          </button>
                          {checkout.canDeactivate && (
                            <button
                              type="button"
                              title="Deactivate"
                              disabled={isPending}
                              onClick={() => deactivate(checkout.checkoutRef)}
                              className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer hover:bg-accent border-0 bg-transparent disabled:opacity-50"
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
                  Create a checkout session to start accepting USDC payments on
                  Base.
                </div>
                <Link href="/checkouts/new" className="no-underline">
                  <Button variant="primary" size="medium" className="mt-2">
                    Create your first checkout
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
