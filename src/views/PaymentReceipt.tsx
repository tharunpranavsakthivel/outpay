"use client";

import { Check, CheckCircle2, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { StatusPill } from "../components/ui/StatusPill";
import {
  formatDashboardDate,
  truncateIdentifier,
} from "../lib/dashboard/format";
import type { PublicReceiptData } from "../lib/dashboard/types";

/**
 * Public receipt page backed by payments, checkout_sessions, and
 * onchain_transactions.
 */
export default function PaymentReceipt({
  initialData,
}: {
  initialData: PublicReceiptData;
}) {
  const [copied, setCopied] = useState(false);
  const [redirectSeconds, setRedirectSeconds] = useState(5);

  useEffect(() => {
    if (!initialData.redirectUrl) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRedirectSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [initialData.redirectUrl]);

  useEffect(() => {
    if (!initialData.redirectUrl || redirectSeconds > 0) {
      return;
    }

    window.location.href = initialData.redirectUrl;
  }, [initialData.redirectUrl, redirectSeconds]);

  const copyHash = () => {
    if (!initialData.txHash) {
      return;
    }

    navigator.clipboard?.writeText(initialData.txHash).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="min-h-screen bg-background-surface-200 font-sans text-foreground flex items-center justify-center px-4 py-8">
      <div className="w-[440px] max-w-full border border-border rounded-xl shadow-sm overflow-hidden bg-card">
        <div className="px-6 py-5 border-b border-border flex items-center gap-2.5">
          <div className="w-[26px] h-[26px] rounded-[7px] bg-accent shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm text-foreground">
              {initialData.merchantName}
            </span>
            <span className="text-xs text-foreground-lighter truncate">
              {initialData.orderDescription}
            </span>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-12 h-12 rounded-full bg-primary/[0.14] flex items-center justify-center">
              <CheckCircle2 size={26} />
            </div>
            <div className="text-center">
              <div className="text-xs text-foreground-lighter mb-1.5">
                Amount paid
              </div>
              <div className="text-[36px] font-medium leading-none tracking-[-0.01em]">
                {initialData.amountLabel}
              </div>
            </div>
            <StatusPill variant="success">Paid</StatusPill>
          </div>

          <div className="flex flex-col border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border text-sm">
              <span className="text-foreground-lighter">Merchant</span>
              <span className="text-foreground font-medium">
                {initialData.merchantName}
              </span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border text-sm">
              <span className="text-foreground-lighter">Date</span>
              <span className="text-foreground font-medium">
                {initialData.paidAt
                  ? formatDashboardDate(initialData.paidAt)
                  : "Awaiting confirmation timestamp"}
              </span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border text-sm">
              <span className="text-foreground-lighter">Network</span>
              <span className="text-foreground font-medium">Base</span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5 text-sm gap-3">
              <span className="text-foreground-lighter shrink-0">
                Transaction
              </span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-xs text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                  {initialData.txHash
                    ? truncateIdentifier(initialData.txHash)
                    : "Not available"}
                </span>
                {initialData.txHash &&
                  (copied ? (
                    <Check size={14} className="opacity-70 shrink-0" />
                  ) : (
                    <Copy
                      size={14}
                      className="cursor-pointer shrink-0 opacity-70"
                      onClick={copyHash}
                    />
                  ))}
                {initialData.explorerUrl && (
                  <a
                    href={initialData.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center shrink-0"
                  >
                    <ExternalLink size={14} className="opacity-70" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="text-[11.5px] text-foreground-lighter text-center leading-[1.6]">
            This payment went directly from the customer wallet to the
            merchant&apos;s wallet. Outpay never held the funds.
          </div>

          {initialData.redirectUrl && (
            <a href={initialData.redirectUrl} className="no-underline">
              <Button variant="outline" size="large" block>
                Back to {initialData.merchantName}
              </Button>
            </a>
          )}

          {initialData.redirectUrl && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-foreground-lighter">
              <Loader2 size={13} className="opacity-60 animate-spin" />
              Redirecting you back to {initialData.merchantName} in{" "}
              {redirectSeconds}s…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
