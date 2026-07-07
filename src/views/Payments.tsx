"use client";

import { Copy, ExternalLink, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { DashboardSidebar } from "../components/layout/DashboardSidebar";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { StatusPill } from "../components/ui/StatusPill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/Table";
import { useToast } from "../components/ui/Toast";
import { truncateIdentifier } from "../lib/dashboard/format";
import type {
  PaymentListItem,
  PaymentsPageData,
  PaymentsQuery,
} from "../lib/dashboard/types";

const STATUS_META = {
  expired: { label: "Expired", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
  paid: { label: "Paid", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
} as const;

const STATUS_OPTIONS: { id: PaymentsQuery["status"]; label: string }[] = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
  { id: "expired", label: "Expired" },
];

/**
 * Payments ledger view backed by `/api/payments`.
 */
export default function Payments({
  initialData,
}: {
  initialData: PaymentsPageData;
}) {
  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState(initialData.query);
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentListItem | null>(null);
  const [isRefreshing, startTransition] = useTransition();
  const toast = useToast();

  useEffect(() => {
    startTransition(async () => {
      const searchParams = new URLSearchParams({
        dateRange: query.dateRange,
        page: String(query.page),
        search: query.search,
        status: query.status,
      });
      const response = await fetch(`/api/payments?${searchParams.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        toast.error("Unable to load payments.");
        return;
      }

      const nextData = (await response.json()) as PaymentsPageData;
      setData(nextData);
      if (selectedPayment) {
        setSelectedPayment(
          nextData.payments.find(
            (payment) => payment.paymentId === selectedPayment.paymentId,
          ) ?? null,
        );
      }
    });
  }, [query, selectedPayment, toast]);

  const confirmationNote = (payment: PaymentListItem) =>
    payment.status === "paid"
      ? `Confirmed with ${payment.confirmations} block confirmations on Base.`
      : payment.status === "pending"
        ? `Detected on-chain, waiting for more confirmations (${payment.confirmations} so far).`
        : payment.status === "expired"
          ? "This checkout link expired before a payment was detected."
          : "This transaction did not confirm as a valid payment.";

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar
        active="payments"
        storeName={data.merchant.storeName}
        logoUrl={data.merchant.logoUrl}
        userAvatarColor={data.merchant.userAvatarColor}
        userName={data.merchant.userFullName}
      />
      <main className="flex-1 min-w-0 flex flex-col relative">
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between px-8 py-4 border-b border-border">
          <div>
            <h1 className="heading-title m-0">Payments</h1>
            <p className="m-0 mt-1 text-xs text-foreground-lighter">
              Full transaction ledger sourced from `payments`,
              `onchain_transactions`, and `checkout_sessions`.
            </p>
          </div>
          <Link href="/checkouts/new" className="no-underline">
            <Button variant="primary" size="medium">
              Create checkout
            </Button>
          </Link>
        </div>

        <div className="px-8 pt-5 pb-10 flex flex-col gap-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex gap-0.5 p-[3px] border border-border rounded-md bg-background-surface-75">
              {STATUS_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  onClick={() =>
                    setQuery((current) => ({
                      ...current,
                      page: 1,
                      status: option.id,
                    }))
                  }
                  className={[
                    "border-0 px-3 py-1.5 rounded text-xs font-medium cursor-pointer",
                    query.status === option.id
                      ? "bg-card text-foreground"
                      : "bg-transparent text-foreground-lighter",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <select
              value={query.dateRange}
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  dateRange: event.target.value as PaymentsQuery["dateRange"],
                  page: 1,
                }))
              }
              className="h-[34px] rounded-sm border border-border-control bg-background text-foreground text-xs px-2.5 font-sans"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>

            <div className="flex-1 min-w-[200px] max-w-[320px] ml-auto">
              <Input
                placeholder="Search by wallet or tx hash…"
                value={query.search}
                onChange={(event) =>
                  setQuery((current) => ({
                    ...current,
                    page: 1,
                    search: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead>Date / time</TableHead>
                  <TableHead>Order ref</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tx hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map((payment) => (
                  <TableRow
                    key={payment.paymentId}
                    onClick={() => setSelectedPayment(payment)}
                    className="cursor-pointer"
                  >
                    <TableCell className="text-foreground-light text-[12.5px] whitespace-nowrap">
                      {payment.datetime}
                    </TableCell>
                    <TableCell className="text-[12.5px] text-foreground-light">
                      {payment.orderReference}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {payment.amountLabel}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-mono text-xs text-foreground-light">
                        {truncateIdentifier(payment.senderAddress)}
                        <Copy
                          size={13}
                          className="cursor-pointer opacity-55"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigator.clipboard
                              ?.writeText(payment.senderAddress)
                              .then(() => toast.success("Address copied."))
                              .catch(() =>
                                toast.error("Unable to copy address."),
                              );
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-mono text-xs text-foreground-light">
                        {truncateIdentifier(payment.recipientAddress)}
                        <Copy
                          size={13}
                          className="cursor-pointer opacity-55"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigator.clipboard
                              ?.writeText(payment.recipientAddress)
                              .then(() => toast.success("Address copied."))
                              .catch(() =>
                                toast.error("Unable to copy address."),
                              );
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusPill variant={STATUS_META[payment.status].variant}>
                        {STATUS_META[payment.status].label}
                      </StatusPill>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-mono text-xs text-foreground-light">
                        {payment.txHash
                          ? truncateIdentifier(payment.txHash)
                          : "Not detected"}
                        {payment.explorerUrl && (
                          <a
                            href={payment.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center shrink-0"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ExternalLink size={12} className="opacity-55" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-foreground-lighter">
              {data.totalCount === 0 ? 0 : (data.query.page - 1) * 8 + 1}–
              {Math.min(data.query.page * 8, data.totalCount)} of{" "}
              {data.totalCount}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="tiny"
                disabled={query.page <= 1 || isRefreshing}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: Math.max(1, current.page - 1),
                  }))
                }
              >
                ← Prev
              </Button>
              {Array.from(
                { length: data.totalPages },
                (_, index) => index + 1,
              ).map((pageNumber) => (
                <button
                  type="button"
                  key={pageNumber}
                  onClick={() =>
                    setQuery((current) => ({
                      ...current,
                      page: pageNumber,
                    }))
                  }
                  className={[
                    "w-7 h-7 rounded-md text-xs cursor-pointer border",
                    pageNumber === data.query.page
                      ? "bg-accent border-border-strong text-foreground"
                      : "bg-transparent border-border text-foreground-lighter",
                  ].join(" ")}
                >
                  {pageNumber}
                </button>
              ))}
              <Button
                variant="outline"
                size="tiny"
                disabled={query.page >= data.totalPages || isRefreshing}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: Math.min(data.totalPages, current.page + 1),
                  }))
                }
              >
                Next →
              </Button>
            </div>
          </div>
        </div>

        {selectedPayment && (
          <>
            <button
              type="button"
              aria-label="Close payment details"
              onClick={() => setSelectedPayment(null)}
              className="fixed inset-0 bg-foreground/40 z-20 animate-[op-scrim-in_0.18s_ease] border-0 p-0"
            />
            <div className="fixed top-0 right-0 h-screen w-[420px] max-w-[92vw] bg-card border-l border-border shadow-lg z-30 overflow-y-auto animate-[op-panel-in_0.22s_cubic-bezier(0.2,0.8,0.2,1)]">
              <div className="sticky top-0 bg-card flex items-center justify-between px-6 py-4.5 border-b border-border">
                <div className="text-sm font-semibold">Payment detail</div>
                <X
                  size={16}
                  className="cursor-pointer opacity-60"
                  onClick={() => setSelectedPayment(null)}
                />
              </div>
              <div className="p-6 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div className="text-[26px] font-medium">
                    {selectedPayment.amountLabel}
                  </div>
                  <StatusPill
                    variant={STATUS_META[selectedPayment.status].variant}
                  >
                    {STATUS_META[selectedPayment.status].label}
                  </StatusPill>
                </div>
                <div className="flex flex-col gap-3.5">
                  {[
                    {
                      label: "Order reference",
                      mono: false,
                      value: selectedPayment.orderReference,
                    },
                    {
                      label: "Checkout ref",
                      mono: true,
                      value: selectedPayment.checkoutRef,
                    },
                    {
                      label: "Sender wallet",
                      mono: true,
                      value: selectedPayment.senderAddress,
                    },
                    {
                      label: "Recipient wallet",
                      mono: true,
                      value: selectedPayment.recipientAddress,
                    },
                    {
                      label: "Transaction hash",
                      mono: true,
                      value: selectedPayment.txHash ?? "Not detected",
                    },
                    {
                      label: "Confirmations",
                      mono: false,
                      value: `${selectedPayment.confirmations} confirmations`,
                    },
                    {
                      label: "Timestamp",
                      mono: false,
                      value: selectedPayment.datetime,
                    },
                  ].map((field) => (
                    <div key={field.label}>
                      <div className="heading-meta text-foreground-lighter mb-1">
                        {field.label}
                      </div>
                      <div
                        className={[
                          "text-sm text-foreground break-all",
                          field.mono ? "font-mono" : "",
                        ].join(" ")}
                      >
                        {field.value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 items-start text-xs leading-[1.5] bg-background-surface-200 border border-border rounded-lg p-3">
                  <ShieldCheck
                    size={14}
                    className="shrink-0 mt-0.5 opacity-60"
                  />
                  <div className="text-foreground-light">
                    {confirmationNote(selectedPayment)}
                  </div>
                </div>
                {selectedPayment.explorerUrl && (
                  <a
                    href={selectedPayment.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline"
                  >
                    <Button variant="outline" size="medium" block>
                      View on block explorer →
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
