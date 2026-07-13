"use client";

import { ArrowLeft, CircleDot } from "lucide-react";
import Link from "next/link";
import { DashboardSidebar } from "../components/layout/DashboardSidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { StatusPill } from "../components/ui/StatusPill";
import { formatDashboardDate } from "../lib/dashboard/format";
import type {
  CheckoutDetailPageData,
  CheckoutStatusHistoryItem,
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

const REASON_LABELS: Record<string, string> = {
  created: "Checkout created",
  expired_timeout: "Payment window expired",
  invalid_payment: "Invalid payment",
  manual_deactivation: "Manual deactivation",
  payment_confirmed: "Payment confirmed",
  payment_detected: "Payment detected",
  reactivated: "Checkout reactivated",
};

/**
 * Builds the human-readable transition heading for one history event.
 *
 * Parameters:
 * - event: Persisted status transition to display.
 *
 * Returns:
 * - A creation label or an explicit previous-to-current status transition.
 */
function getHistoryTitle(event: CheckoutStatusHistoryItem) {
  if (!event.fromStatus) {
    return `Created as ${event.toStatus}`;
  }

  return `${event.fromStatus} → ${event.toStatus}`;
}

/**
 * Renders a merchant checkout summary and the immutable status transition
 * timeline returned by the dashboard server loader.
 */
export default function CheckoutDetail({
  initialData,
}: {
  initialData: CheckoutDetailPageData;
}) {
  const { checkout, history, merchant } = initialData;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar
        active="checkouts"
        storeName={merchant.storeName}
        logoUrl={merchant.logoUrl}
        userAvatarColor={merchant.userAvatarColor}
        userName={merchant.userFullName}
      />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-10 bg-background flex items-center gap-3 px-8 py-4 border-b border-border">
          <Link
            href="/checkouts"
            aria-label="Back to checkouts"
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-light hover:bg-accent no-underline"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="heading-title m-0">Checkout detail</h1>
            <p className="m-0 mt-1 text-xs text-foreground-lighter">
              {checkout.checkoutRef}
            </p>
          </div>
        </div>

        <div className="px-8 pt-7 pb-12 max-w-[860px] flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>{checkout.label}</CardTitle>
              <CardDescription>
                {checkout.orderReference ?? checkout.checkoutRef}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <div>
                <div className="text-xs text-foreground-lighter">Amount</div>
                <div className="mt-1 text-sm font-medium">
                  {checkout.amountLabel}
                </div>
              </div>
              <div>
                <div className="text-xs text-foreground-lighter">Status</div>
                <div className="mt-1">
                  <StatusPill
                    variant={STATUS_VARIANTS[checkout.status] ?? "default"}
                  >
                    {checkout.status}
                  </StatusPill>
                </div>
              </div>
              <div>
                <div className="text-xs text-foreground-lighter">Created</div>
                <div className="mt-1 text-sm">{checkout.createdAt}</div>
              </div>
              <div>
                <div className="text-xs text-foreground-lighter">
                  Checkout link
                </div>
                <Link
                  href={`/checkout/${checkout.publicToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-sm text-primary no-underline hover:underline"
                >
                  Open hosted checkout
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status history</CardTitle>
              <CardDescription>
                Every recorded status change, including when and why it
                happened.
              </CardDescription>
            </CardHeader>
            <CardContent className="border-b-0">
              {history.length > 0 ? (
                <ol className="relative ml-2 border-l border-border pl-6">
                  {history.map((event) => (
                    <li key={event.id} className="relative pb-7 last:pb-0">
                      <CircleDot
                        size={14}
                        className="absolute -left-[33px] top-0.5 fill-background text-primary"
                        aria-hidden="true"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {getHistoryTitle(event)}
                        </span>
                        <StatusPill
                          variant={STATUS_VARIANTS[event.toStatus] ?? "default"}
                        >
                          {event.toStatus}
                        </StatusPill>
                      </div>
                      <div className="mt-1 text-xs text-foreground-lighter">
                        {formatDashboardDate(event.createdAt)} ·{" "}
                        {event.actorName ?? event.actorType}
                      </div>
                      <div className="mt-2 text-sm text-foreground-light">
                        {event.message ??
                          REASON_LABELS[event.reasonCode ?? ""] ??
                          "Status updated."}
                      </div>
                      {event.reasonCode && event.message && (
                        <div className="mt-1 text-xs text-foreground-lighter">
                          Reason:{" "}
                          {REASON_LABELS[event.reasonCode] ?? event.reasonCode}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="py-8 text-sm text-foreground-lighter">
                  No status history has been recorded for this checkout.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
