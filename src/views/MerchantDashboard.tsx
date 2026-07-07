"use client";

import { Bell, Check, Copy, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { DashboardSidebar } from "../components/layout/DashboardSidebar";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
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
import { formatDashboardDate } from "../lib/dashboard/format";
import type {
  DashboardPageData,
  DashboardStatus,
} from "../lib/dashboard/types";

const STATUS_META: Record<
  DashboardStatus,
  { label: string; variant: "default" | "warning" | "success" | "destructive" }
> = {
  expired: { label: "Expired", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
  paid: { label: "Paid", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
};

/**
 * Merchant dashboard view backed by live metrics, notifications, and payment
 * rows from the existing PostgreSQL schema.
 */
export default function MerchantDashboard({
  initialData,
}: {
  initialData: DashboardPageData;
}) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [notifications, setNotifications] = useState(initialData.notifications);
  const [unreadCount, setUnreadCount] = useState(
    initialData.merchant.unreadNotifications,
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isMarkingRead, startMarkingRead] = useTransition();

  const copyHash = (hash: string | null, index: number) => {
    if (!hash) {
      return;
    }

    navigator.clipboard?.writeText(hash).catch(() => undefined);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1200);
  };

  const markAllRead = () => {
    startMarkingRead(async () => {
      const response = await fetch("/api/dashboard/notifications", {
        body: JSON.stringify({
          action: "mark-all-read",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        return;
      }

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          isRead: true,
        })),
      );
      setUnreadCount(0);
    });
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar
        active="dashboard"
        storeName={initialData.merchant.storeName}
      />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between px-8 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[7px] bg-accent flex items-center justify-center text-xs font-semibold">
              {initialData.merchant.storeName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">
                {initialData.merchant.storeName}
              </span>
              <span className="text-[11px] text-foreground-lighter">
                outpay.dev/{initialData.merchant.publicSlug}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              aria-label="Toggle notifications"
              onClick={() => setNotificationsOpen((current) => !current)}
              className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer relative border border-border-control hover:bg-accent bg-transparent"
            >
              <Bell size={17} className="opacity-75" />
              {unreadCount > 0 && (
                <div className="absolute top-[7px] right-2 w-[7px] h-[7px] rounded-full bg-destructive border-[1.5px] border-background" />
              )}
            </button>
            <Link href="/checkouts/new" className="no-underline">
              <Button variant="primary" size="medium">
                Create checkout
              </Button>
            </Link>

            {notificationsOpen && (
              <div className="absolute top-11 right-0 w-[360px] bg-popover border border-border rounded-xl shadow-lg z-40 overflow-hidden">
                <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
                  <div className="text-sm font-semibold">Notifications</div>
                  <button
                    type="button"
                    onClick={markAllRead}
                    disabled={isMarkingRead || unreadCount === 0}
                    className="text-xs text-foreground-lighter cursor-pointer hover:text-foreground bg-transparent border-0 p-0 font-inherit disabled:opacity-50"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-foreground-lighter">
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={[
                          "flex gap-2.5 px-4 py-3 border-b border-border",
                          notification.isRead
                            ? "bg-transparent"
                            : "bg-foreground/[0.026]",
                        ].join(" ")}
                      >
                        <div className="min-w-0">
                          <div className="text-[12.5px] text-foreground leading-[1.45]">
                            {notification.title}
                          </div>
                          <div className="text-[11px] text-foreground-lighter mt-0.5 leading-[1.5]">
                            {notification.body}
                          </div>
                          <div className="text-[11px] text-foreground-lighter mt-1">
                            {formatDashboardDate(notification.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-8 pt-7 pb-12 flex flex-col gap-5">
          <div>
            <h1 className="heading-title m-0">Dashboard</h1>
            <p className="m-0 mt-1.5 text-xs text-foreground-lighter">
              Payment volume, notification state, and recent payment activity
              from the live schema.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {initialData.metrics.map((metric) => (
              <Card key={metric.label}>
                <CardContent className="border-b-0">
                  <div className="heading-meta text-foreground-lighter mb-2">
                    {metric.label}
                  </div>
                  <div className="text-2xl font-medium text-foreground">
                    {metric.value}
                  </div>
                  <div
                    className={[
                      "text-xs mt-1",
                      metric.tone === "warning"
                        ? "text-warning"
                        : "text-foreground-lighter",
                    ].join(" ")}
                  >
                    {metric.sub}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent payments</CardTitle>
              <CardDescription>
                Latest confirmed or pending payment records for this merchant
              </CardDescription>
            </CardHeader>

            {initialData.recentPayments.length > 0 ? (
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
                  {initialData.recentPayments.map((payment, index) => (
                    <TableRow key={payment.paymentId}>
                      <TableCell className="text-foreground-light">
                        {formatDashboardDate(payment.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {payment.amountLabel}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          variant={STATUS_META[payment.status].variant}
                        >
                          {STATUS_META[payment.status].label}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground-light">
                        {payment.senderAddress}
                      </TableCell>
                      <TableCell>
                        {payment.txHash ? (
                          <div className="flex items-center gap-1.5 font-mono text-xs text-foreground-light">
                            {payment.txHash}
                            {copiedIndex === index ? (
                              <Check
                                size={14}
                                className="cursor-pointer opacity-90"
                              />
                            ) : (
                              <Copy
                                size={14}
                                className="cursor-pointer opacity-55"
                                onClick={() => copyHash(payment.txHash, index)}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-foreground-lighter">
                            Not detected yet
                          </span>
                        )}
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
                  your first schema-backed payment record here.
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
