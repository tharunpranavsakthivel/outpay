"use client";

import { Check, CheckCircle2, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { StatusPill } from "../components/ui/StatusPill";

const TX_HASH =
  "0x3a9fc182ba6de7719d0e4a2fb1e0f9c837ab914d0b21e6a8f5c6d3e918a081be";

/** Post-payment receipt: paid confirmation, tx details, non-custodial footer note, optional redirect countdown. */
export default function PaymentReceipt({
  amount = "124.00",
  merchantName = "Acme Coffee Co.",
  orderDescription = "Espresso subscription — 1 month",
  paidAt = "Jul 6, 2026, 2:41 PM",
  redirectUrl = "https://acme-coffee.com/order-confirmed",
}: {
  amount?: string;
  merchantName?: string;
  orderDescription?: string;
  paidAt?: string;
  redirectUrl?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [redirectSeconds, setRedirectSeconds] = useState(5);

  useEffect(() => {
    if (!redirectUrl) return;
    const interval = setInterval(
      () => setRedirectSeconds((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(interval);
  }, [redirectUrl]);

  const shortHash = `${TX_HASH.slice(0, 10)}…${TX_HASH.slice(-6)}`;
  const copyHash = () => {
    navigator.clipboard?.writeText(TX_HASH).catch(() => {});
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
              {merchantName}
            </span>
            <span className="text-xs text-foreground-lighter truncate">
              {orderDescription}
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
                {amount}{" "}
                <span className="text-base text-foreground-lighter font-medium">
                  USDC
                </span>
              </div>
            </div>
            <StatusPill variant="success">Paid</StatusPill>
          </div>

          <div className="flex flex-col border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border text-sm">
              <span className="text-foreground-lighter">Merchant</span>
              <span className="text-foreground font-medium">
                {merchantName}
              </span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border text-sm">
              <span className="text-foreground-lighter">Date</span>
              <span className="text-foreground font-medium">{paidAt}</span>
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
                  {shortHash}
                </span>
                {copied ? (
                  <Check size={14} className="opacity-70 shrink-0" />
                ) : (
                  <Copy
                    size={14}
                    className="cursor-pointer shrink-0 opacity-70"
                    onClick={copyHash}
                  />
                )}
                <a
                  href={`https://basescan.org/tx/${TX_HASH}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center shrink-0"
                >
                  <ExternalLink size={14} className="opacity-70" />
                </a>
              </div>
            </div>
          </div>

          <div className="text-[11.5px] text-foreground-lighter text-center leading-[1.6]">
            This payment went directly from your wallet to the merchant's
            wallet. Outpay never held your funds.
          </div>

          <Button variant="outline" size="large" block>
            Back to {merchantName}
          </Button>

          {redirectUrl && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-foreground-lighter">
              <Loader2 size={13} className="opacity-60 animate-spin" />
              Redirecting you back to {merchantName} in {redirectSeconds}s…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
