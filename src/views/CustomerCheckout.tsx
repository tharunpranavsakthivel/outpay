"use client";

import { AlertTriangle, Check, Copy, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { StatusPill } from "../components/ui/StatusPill";
import type { PublicCheckoutData } from "../lib/dashboard/types";

const STATUS_CONFIG = {
  detected: {
    label: "Detected — confirming",
    payDisabled: true,
    payLabel: "Confirming on-chain…",
    variant: "warning",
  },
  expired: {
    label: "Expired",
    payDisabled: true,
    payLabel: "Link expired",
    variant: "destructive",
  },
  paid: {
    label: "Paid",
    payDisabled: true,
    payLabel: "Payment complete",
    variant: "success",
  },
  waiting: {
    label: "Waiting for payment",
    payDisabled: false,
    payLabel: "Open wallet",
    variant: "default",
  },
} as const;

/**
 * Customer checkout page backed by the public checkout route and polling API.
 */
export default function CustomerCheckout({
  initialData,
}: {
  initialData: PublicCheckoutData;
}) {
  const [checkout, setCheckout] = useState(initialData);
  const [copied, setCopied] = useState(false);
  const config = STATUS_CONFIG[checkout.status];

  useEffect(() => {
    if (checkout.status === "paid" || checkout.status === "expired") {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const response = await fetch(
        `/api/public/checkouts/${checkout.publicToken}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        return;
      }

      const nextCheckout = (await response.json()) as PublicCheckoutData;
      setCheckout(nextCheckout);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [checkout.publicToken, checkout.status]);

  const copyAddress = () => {
    navigator.clipboard
      ?.writeText(checkout.walletAddress)
      .catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const openWallet = () => {
    if (checkout.status !== "waiting") {
      return;
    }

    window.location.href = checkout.paymentUri;
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(checkout.paymentUri)}`;

  return (
    <div className="min-h-screen bg-background-surface-200 font-sans text-foreground flex items-center justify-center px-4 py-8">
      <div className="w-[440px] max-w-full border border-border rounded-xl shadow-sm overflow-hidden bg-card">
        <div className="px-6 py-5 border-b border-border flex items-center gap-2.5">
          <div className="w-[26px] h-[26px] rounded-[7px] bg-accent shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm text-foreground">
              {checkout.merchantName}
            </span>
            <span className="text-xs text-foreground-lighter truncate">
              {checkout.orderDescription}
            </span>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-4.5">
          <div className="text-center">
            <div className="text-xs text-foreground-lighter mb-1.5">
              Amount due
            </div>
            <div className="text-[40px] font-medium leading-none tracking-[-0.01em]">
              {checkout.amountLabel}
            </div>
          </div>

          <div className="flex gap-2.5 items-start text-sm leading-[1.5] bg-destructive/[0.09] border border-destructive rounded-lg px-3.5 py-3 text-foreground">
            <AlertTriangle size={17} className="shrink-0 mt-0.5" />
            <div>
              <strong>{checkout.chainName} network only.</strong> Sending on any
              other network will not match the checkout session.
            </div>
          </div>

          <div className="flex gap-2.5 items-start text-sm leading-[1.5] bg-warning/10 border border-border-warning rounded-lg px-3.5 py-3 text-foreground">
            <Info size={17} className="shrink-0 mt-0.5" />
            <div>
              Send the <strong>exact amount</strong> shown above. The checkout
              is matched against the expected token amount from the database.
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 py-1">
            <img
              src={qrCodeUrl}
              className="w-[168px] h-[168px] border border-border rounded-lg"
              alt="Payment QR code"
            />
            <div className="w-full">
              <div className="text-[11px] text-foreground-lighter mb-1.5 text-center">
                Merchant receiving address
              </div>
              <div className="flex items-center gap-2 bg-foreground/[0.026] border border-border-control rounded-md px-2.5 py-2">
                <span className="flex-1 font-mono text-[11.5px] text-foreground break-all leading-[1.4]">
                  {checkout.walletAddress}
                </span>
                {copied ? (
                  <Check size={16} className="shrink-0 opacity-70" />
                ) : (
                  <Copy
                    size={16}
                    className="cursor-pointer shrink-0 opacity-70"
                    onClick={copyAddress}
                  />
                )}
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="large"
            block
            disabled={config.payDisabled}
            onClick={openWallet}
          >
            {config.payLabel}
          </Button>

          <div className="flex items-center justify-between text-sm px-3.5 py-3 bg-background-surface-200 border border-border rounded-lg">
            <span className="text-foreground-lighter">Payment status</span>
            <StatusPill variant={config.variant}>{config.label}</StatusPill>
          </div>

          <div className="text-[11.5px] text-foreground-lighter text-center leading-[1.6] pt-3.5 border-t border-border mt-0.5">
            Non-custodial: this payment goes directly from your wallet to the
            merchant&apos;s wallet. Outpay never holds your funds.
          </div>
        </div>
      </div>
    </div>
  );
}
