"use client";

import { AlertTriangle, Check, Copy, Info } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button } from "../components/ui/Button";
import { PaymentSuccessBadge } from "../components/ui/PaymentSuccessBadge";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import type { PublicCheckoutData } from "../lib/dashboard/types";
import { NON_CUSTODIAL_DISCLAIMER } from "../lib/legal/compliance";

/** Statuses that will never change again: once reached, polling stops. */
const TERMINAL_STATUSES = new Set<PublicCheckoutData["status"]>([
  "paid",
  "expired",
]);

function isTerminalStatus(status: PublicCheckoutData["status"]): boolean {
  return TERMINAL_STATUSES.has(status);
}

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
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showPaidCelebration, setShowPaidCelebration] = useState(false);
  const previousStatusRef = useRef(initialData.status);
  const config = STATUS_CONFIG[checkout.status];
  const toast = useToast();
  const expiresAtMs = Date.parse(checkout.expiresAt);
  const secondsRemaining =
    checkout.status === "waiting" && Number.isFinite(expiresAtMs)
      ? Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000))
      : null;

  const refreshCheckout = useEffectEvent(async () => {
    try {
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
    } catch {
      // Network failure (offline, DNS blip, etc.) — the next interval tick,
      // or the visibility/online listeners below, will retry. Swallowing
      // this here is what prevents an unhandled rejection from killing the
      // polling loop.
    }
  });

  // Detects the live pending/detected -> paid transition (as opposed to
  // loading a page that is already paid) so the celebration animation plays
  // exactly once, only for someone actually watching it happen.
  useEffect(() => {
    if (previousStatusRef.current !== "paid" && checkout.status === "paid") {
      setShowPaidCelebration(true);
    }

    previousStatusRef.current = checkout.status;
  }, [checkout.status]);

  useEffect(() => {
    if (isTerminalStatus(checkout.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshCheckout();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [checkout.status, refreshCheckout]);

  // Background tabs throttle setInterval (sometimes to once a minute or
  // less), so a payment that lands while this tab isn't focused can sit
  // unreflected for a while even though the 5s poll above is "running".
  // Refresh immediately whenever the tab regains focus instead of waiting
  // for the throttled interval to catch up.
  useEffect(() => {
    if (isTerminalStatus(checkout.status)) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshCheckout();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [checkout.status, refreshCheckout]);

  // Recovers promptly from a dropped connection instead of waiting up to
  // 5s for the next scheduled poll once the browser reports it's back
  // online.
  useEffect(() => {
    if (isTerminalStatus(checkout.status)) {
      return;
    }

    const handleOnline = () => {
      void refreshCheckout();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [checkout.status, refreshCheckout]);

  useEffect(() => {
    if (isTerminalStatus(checkout.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [checkout.status]);

  useEffect(() => {
    const nextExpiresAtMs = Date.parse(checkout.expiresAt);

    if (checkout.status !== "waiting" || !Number.isFinite(nextExpiresAtMs)) {
      return;
    }

    const refreshDelayMs = Math.max(0, nextExpiresAtMs - Date.now() + 250);
    const timeoutId = window.setTimeout(() => {
      void refreshCheckout();
    }, refreshDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [checkout.status, checkout.expiresAt, refreshCheckout]);

  const copyAddress = () => {
    navigator.clipboard
      ?.writeText(checkout.walletAddress)
      .then(() => toast.success("Wallet address copied."))
      .catch(() => toast.error("Unable to copy wallet address."));
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
          {checkout.status === "paid" && (
            <div className="flex justify-center">
              <PaymentSuccessBadge animate={showPaidCelebration} />
            </div>
          )}

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
            <div className="flex gap-2 items-start text-xs leading-[1.5] text-warning">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                <strong>Cryptocurrency payments are irreversible.</strong>{" "}
                Verify the wallet address, network, token, and exact amount
                before sending.
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

          <div
            className="flex items-center justify-between text-sm px-3.5 py-3 bg-background-surface-200 border border-border rounded-lg"
            aria-live="polite"
          >
            <span className="text-foreground-lighter">Payment status</span>
            <StatusPill variant={config.variant}>{config.label}</StatusPill>
          </div>

          {secondsRemaining !== null && (
            <div className="flex items-center justify-between text-sm px-3.5 py-3 bg-background-surface-200 border border-border rounded-lg">
              <span className="text-foreground-lighter">Time remaining</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatCountdown(secondsRemaining)}
              </span>
            </div>
          )}

          <div className="text-[11.5px] text-foreground-lighter text-center leading-[1.6] pt-3.5 border-t border-border mt-0.5">
            {NON_CUSTODIAL_DISCLAIMER}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Formats a remaining-second counter for the hosted checkout countdown timer.
 *
 * Parameters:
 * - totalSeconds: Rounded-up number of seconds remaining before expiry.
 *
 * Returns:
 * - `MM:SS` countdown label for the customer checkout page.
 */
function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
