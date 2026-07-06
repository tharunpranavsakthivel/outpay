"use client";

import { AlertTriangle, Check, Copy, Info } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/Button";
import {
  StatusPill,
  type StatusPillVariant,
} from "../components/ui/StatusPill";

type Status = "waiting" | "detected" | "paid" | "expired";

const STATUS_CONFIG: Record<
  Status,
  {
    heading: string;
    label: string;
    variant: StatusPillVariant;
    payLabel: string;
    payDisabled: boolean;
  }
> = {
  waiting: {
    heading: "Payment status",
    label: "Waiting for payment",
    variant: "default",
    payLabel: "Pay with wallet",
    payDisabled: false,
  },
  detected: {
    heading: "Payment status",
    label: "Detected — confirming",
    variant: "warning",
    payLabel: "Confirming on Base…",
    payDisabled: true,
  },
  paid: {
    heading: "Payment status",
    label: "Paid",
    variant: "success",
    payLabel: "Payment complete",
    payDisabled: true,
  },
  expired: {
    heading: "Payment status",
    label: "Expired",
    variant: "destructive",
    payLabel: "Link expired",
    payDisabled: true,
  },
};

const WALLET = "0x8f2A91b4E6d7C3a0F251b8D9e4C6A7f3B91c91D4";

/**
 * Customer-facing checkout page. Network + exact-amount warnings are always
 * visible; the non-custodial nature is stated in the footer. `showDemoControl`
 * exposes the status-state switcher used in design review — remove it (and
 * drive `status` from real payment-detection data) in production.
 */
export default function CustomerCheckout({
  amount = "124.00",
  orderDescription = "Espresso subscription — 1 month",
  showDemoControl = true,
}: {
  amount?: string;
  orderDescription?: string;
  showDemoControl?: boolean;
}) {
  const [status, setStatus] = useState<Status>("waiting");
  const [copied, setCopied] = useState(false);
  const cfg = STATUS_CONFIG[status];

  const copyAddress = () => {
    navigator.clipboard?.writeText(WALLET).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=ethereum:${WALLET}@8453?amount=${amount}`;

  return (
    <div className="min-h-screen bg-background-surface-200 font-sans text-foreground flex items-center justify-center px-4 py-8">
      <div className="w-[440px] max-w-full border border-border rounded-xl shadow-sm overflow-hidden bg-card">
        <div className="px-6 py-5 border-b border-border flex items-center gap-2.5">
          <div className="w-[26px] h-[26px] rounded-[7px] bg-accent shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm text-foreground">
              Acme Coffee Co.
            </span>
            <span className="text-xs text-foreground-lighter truncate">
              {orderDescription}
            </span>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-4.5">
          <div className="text-center">
            <div className="text-xs text-foreground-lighter mb-1.5">
              Amount due
            </div>
            <div className="text-[40px] font-medium leading-none tracking-[-0.01em]">
              {amount}{" "}
              <span className="text-[17px] text-foreground-lighter font-medium">
                USDC
              </span>
            </div>
          </div>

          <div className="flex gap-2.5 items-start text-sm leading-[1.5] bg-destructive/[0.09] border border-destructive rounded-lg px-3.5 py-3 text-foreground">
            <AlertTriangle size={17} className="shrink-0 mt-0.5" />
            <div>
              <strong>Base network only.</strong> Sending on any other network
              will result in lost funds.
            </div>
          </div>

          <div className="flex gap-2.5 items-start text-sm leading-[1.5] bg-warning/10 border border-border-warning rounded-lg px-3.5 py-3 text-foreground">
            <Info size={17} className="shrink-0 mt-0.5" />
            <div>
              Send the <strong>exact amount</strong> shown above. Partial
              payments will not be detected as paid.
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
                  {WALLET}
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
            disabled={cfg.payDisabled}
            onClick={() => setStatus("detected")}
          >
            {cfg.payLabel}
          </Button>

          <div className="flex items-center justify-between text-sm px-3.5 py-3 bg-background-surface-200 border border-border rounded-lg">
            <span className="text-foreground-lighter">{cfg.heading}</span>
            <StatusPill variant={cfg.variant}>{cfg.label}</StatusPill>
          </div>

          {showDemoControl && (
            <div className="flex gap-1.5 justify-center flex-wrap">
              {(Object.keys(STATUS_CONFIG) as Status[]).map((key) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setStatus(key)}
                  className={[
                    "text-[10px] px-2 py-1 rounded-full border border-border cursor-pointer",
                    status === key ? "bg-accent" : "bg-transparent",
                    "text-foreground-lighter",
                  ].join(" ")}
                >
                  {key}
                </button>
              ))}
            </div>
          )}

          <div className="text-[11.5px] text-foreground-lighter text-center leading-[1.6] pt-3.5 border-t border-border mt-0.5">
            Non-custodial: this payment goes directly from your wallet to the
            merchant's wallet. Outpay never holds your funds.
          </div>
        </div>
      </div>
    </div>
  );
}
