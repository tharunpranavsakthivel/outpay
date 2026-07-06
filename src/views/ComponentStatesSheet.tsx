"use client";

import {
  AlertTriangle,
  Check,
  ClockAlert,
  Info,
  SearchX,
  X,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { StatusPill } from "../components/ui/StatusPill";

const WALLET_PROVIDERS = [
  { name: "MetaMask", color: "bg-amber-400" },
  { name: "Coinbase Wallet", color: "bg-blue-400" },
  { name: "WalletConnect", color: "bg-primary" },
];

const DETAIL_FIELDS = [
  {
    label: "Sender wallet",
    value: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    mono: true,
  },
  {
    label: "Recipient wallet",
    value: "0x4d92c8A1e5Bf0d3a6C71298fE4b0d9A2c1e0aa10",
    mono: true,
  },
  {
    label: "Transaction hash",
    value: "0x8f2a91b4e6d7c3a0f251b8d9e4c6a7f3b91c91d47a3f",
    mono: true,
  },
  { label: "Block confirmations", value: "24 confirmations", mono: false },
];

const skelClass =
  "bg-[linear-gradient(90deg,var(--background-surface-200)_25%,var(--background-surface-100)_37%,var(--background-surface-200)_63%)] bg-[length:400%_100%] animate-[op-shimmer_1.4s_ease_infinite] rounded-md";

/**
 * Reference sheet: toasts, modals, and system/inline states used across the
 * merchant & customer surfaces. Not a routed screen — a specimen page for
 * implementing these one-off UI states consistently.
 */
export default function ComponentStatesSheet() {
  return (
    <div className="min-h-screen bg-background-surface-200 font-sans text-foreground p-10">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-8">
          <h1 className="heading-title m-0 mb-1.5">Component states sheet</h1>
          <p className="m-0 text-xs text-foreground-lighter">
            Toasts, modals, and system states used across the Outpay merchant
            &amp; customer surfaces.
          </p>
        </div>

        {/* Toasts */}
        <div className="mb-10">
          <div className="heading-meta text-foreground-lighter mb-3.5">
            Toasts
          </div>
          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-card border border-border-brand shadow-md min-w-[300px]">
              <div className="w-5 h-5 rounded-full bg-primary/[0.15] flex items-center justify-center shrink-0">
                <Check size={12} />
              </div>
              <span className="text-sm">Checkout link created</span>
            </div>
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-card border border-border-destructive shadow-md min-w-[300px]">
              <div className="w-5 h-5 rounded-full bg-destructive/[0.15] flex items-center justify-center shrink-0">
                <X size={12} />
              </div>
              <span className="text-sm">Failed to send test webhook</span>
            </div>
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-card border border-border-info shadow-md min-w-[300px]">
              <div className="w-5 h-5 rounded-full bg-info/[0.15] flex items-center justify-center shrink-0">
                <Info size={12} />
              </div>
              <span className="text-sm">Copied to clipboard</span>
            </div>
          </div>
        </div>

        {/* Modals */}
        <div className="mb-10">
          <div className="heading-meta text-foreground-lighter mb-3.5">
            Modals
          </div>
          <div className="flex gap-5 flex-wrap items-start">
            <div>
              <div className="text-[11px] text-foreground-lighter mb-2">
                Hide API key
              </div>
              <div className="w-[360px] bg-card border border-border-destructive rounded-xl shadow-md overflow-hidden">
                <div className="px-5 py-4.5 border-b border-border text-sm font-semibold text-destructive">
                  Hide secret key?
                </div>
                <div className="p-5 flex flex-col gap-3.5">
                  <div className="text-sm leading-[1.5] text-foreground">
                    This preview only hides the currently displayed key in the
                    UI. Real backend key rotation is not implemented yet.
                  </div>
                  <div className="font-mono text-xs text-foreground-light bg-foreground/[0.026] border border-border-control rounded-md px-2.5 py-2">
                    OUTPAY_LIV••••••••
                  </div>
                </div>
                <div className="px-5 py-3.5 border-t border-border flex justify-end gap-2">
                  <Button variant="text" size="medium">
                    Cancel
                  </Button>
                  <Button variant="outline" size="medium">
                    Hide key
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-foreground-lighter mb-2">
                Change wallet address
              </div>
              <div className="w-[380px] bg-card border border-border rounded-xl shadow-md overflow-hidden">
                <div className="px-5 py-4.5 border-b border-border text-sm font-semibold">
                  Change payout wallet
                </div>
                <div className="p-5 flex flex-col gap-3.5">
                  <div className="flex gap-2 items-start text-xs leading-[1.5] bg-warning/10 border border-border-warning rounded-lg p-3 text-foreground">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      All future payments will be sent to the new address.
                      Outpay cannot recover funds sent to the wrong wallet.
                    </div>
                  </div>
                  <div className="h-[38px] border border-border-control rounded-sm bg-foreground/[0.026] flex items-center px-3 font-mono text-xs text-foreground-lighter">
                    0x…
                  </div>
                </div>
                <div className="px-5 py-3.5 border-t border-border flex justify-end gap-2">
                  <Button variant="text" size="medium">
                    Cancel
                  </Button>
                  <Button variant="primary" size="medium" disabled>
                    Confirm change
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-foreground-lighter mb-2">
                Deactivate store
              </div>
              <div className="w-[360px] bg-card border border-border-destructive rounded-xl shadow-md overflow-hidden">
                <div className="px-5 py-4.5 border-b border-border text-sm font-semibold text-destructive">
                  Deactivate Acme Coffee Co.?
                </div>
                <div className="p-5 flex flex-col gap-3.5">
                  <div className="text-sm leading-[1.5] text-foreground">
                    This immediately disables all checkout links until
                    reactivated by support.
                  </div>
                  <div>
                    <div className="text-[12.5px] mb-1.5">
                      Type{" "}
                      <strong className="font-mono">Acme Coffee Co.</strong> to
                      confirm
                    </div>
                    <div className="h-9 border border-border-control rounded-sm bg-foreground/[0.026]" />
                  </div>
                </div>
                <div className="px-5 py-3.5 border-t border-border flex justify-end gap-2">
                  <Button variant="text" size="medium">
                    Cancel
                  </Button>
                  <Button variant="danger" size="medium" disabled>
                    Deactivate store
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-foreground-lighter mb-2">
                Wallet connect — choose / connecting / connected
              </div>
              <div className="flex gap-3">
                <div className="w-60 bg-card border border-border rounded-xl shadow-md overflow-hidden">
                  <div className="px-4.5 py-4 border-b border-border text-sm font-semibold">
                    Connect wallet
                  </div>
                  <div className="p-3.5 flex flex-col gap-2">
                    {WALLET_PROVIDERS.map((w) => (
                      <div
                        key={w.name}
                        className="flex items-center gap-2.5 px-3 py-2.5 border border-border rounded-lg text-sm cursor-pointer"
                      >
                        <div
                          className={[
                            "w-[22px] h-[22px] rounded-md shrink-0",
                            w.color,
                          ].join(" ")}
                        />
                        {w.name}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="w-60 bg-card border border-border rounded-xl shadow-md overflow-hidden">
                  <div className="px-4.5 py-4 border-b border-border text-sm font-semibold">
                    Connect wallet
                  </div>
                  <div className="px-4.5 py-7.5 flex flex-col items-center gap-3.5 text-center">
                    <div className="w-8 h-8 rounded-full border-[3px] border-border border-t-foreground animate-spin" />
                    <div className="text-[12.5px] text-foreground-lighter">
                      Confirm connection in MetaMask…
                    </div>
                  </div>
                </div>
                <div className="w-60 bg-card border border-border rounded-xl shadow-md overflow-hidden">
                  <div className="px-4.5 py-4 border-b border-border text-sm font-semibold">
                    Wallet connected
                  </div>
                  <div className="px-4.5 py-5 flex flex-col items-center gap-3 text-center">
                    <div className="w-9 h-9 rounded-full bg-primary/[0.15] flex items-center justify-center">
                      <Check size={18} />
                    </div>
                    <div className="font-mono text-xs text-foreground-light">
                      0x71C7…976F
                    </div>
                    <Button variant="primary" size="small" block>
                      Pay 124.00 USDC
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-foreground-lighter mb-2">
                Full payment detail
              </div>
              <div className="w-[340px] bg-card border border-border rounded-xl shadow-md overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div className="text-sm font-semibold">Payment detail</div>
                  <X size={15} className="opacity-50" />
                </div>
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[22px] font-medium">124.00 USDC</div>
                    <StatusPill variant="success">Paid</StatusPill>
                  </div>
                  {DETAIL_FIELDS.map((f) => (
                    <div key={f.label}>
                      <div className="heading-meta text-foreground-lighter mb-1">
                        {f.label}
                      </div>
                      <div
                        className={[
                          "text-[12.5px] text-foreground break-all",
                          f.mono ? "font-mono" : "",
                        ].join(" ")}
                      >
                        {f.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Inline & system states */}
        <div>
          <div className="heading-meta text-foreground-lighter mb-3.5">
            Inline &amp; system states
          </div>
          <div className="flex gap-5 flex-wrap items-start">
            <div>
              <div className="text-[11px] text-foreground-lighter mb-2">
                Dashboard metric cards — loading
              </div>
              <div className="w-[460px] grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="border border-border rounded-lg p-4 bg-card"
                  >
                    <div
                      className={[skelClass, "w-[70%] h-2.5 mb-2.5"].join(" ")}
                    />
                    <div
                      className={[skelClass, "w-1/2 h-[22px] mb-2"].join(" ")}
                    />
                    <div className={[skelClass, "w-2/5 h-[9px]"].join(" ")} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-foreground-lighter mb-2">
                Payments table — loading
              </div>
              <div className="w-[460px] border border-border rounded-lg bg-card px-4 py-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3.5 py-3 border-b border-border last:border-b-0"
                  >
                    <div className={[skelClass, "w-[70px] h-2.5"].join(" ")} />
                    <div className={[skelClass, "w-[60px] h-2.5"].join(" ")} />
                    <div
                      className={[
                        skelClass,
                        "w-[50px] h-[18px] rounded-full",
                      ].join(" ")}
                    />
                    <div
                      className={[skelClass, "w-[90px] h-2.5 ml-auto"].join(
                        " ",
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-foreground-lighter mb-2">
                Payments — no results for filter
              </div>
              <div className="w-[340px] border border-border rounded-lg bg-card px-6 py-10 flex flex-col items-center gap-2.5 text-center">
                <SearchX size={24} className="opacity-40" />
                <div className="text-sm font-semibold">
                  No payments match this filter
                </div>
                <div className="text-xs text-foreground-lighter max-w-[240px] leading-[1.5]">
                  Try a different status or date range, or clear your filters.
                </div>
                <Button variant="outline" size="tiny">
                  Clear filters
                </Button>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-foreground-lighter mb-2">
                Network mismatch warning
              </div>
              <div className="w-[340px] flex gap-2.5 items-start text-sm leading-[1.5] bg-destructive/[0.09] border border-border-destructive rounded-lg p-3.5 text-foreground">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <strong>Wrong network detected.</strong> Your wallet is
                  connected to Ethereum Mainnet. Switch to Base before sending
                  payment.
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-foreground-lighter mb-2">
                Checkout — payment expired
              </div>
              <div className="w-[340px] border border-border rounded-xl bg-card shadow-xs overflow-hidden">
                <div className="px-6 py-8 flex flex-col items-center gap-3 text-center">
                  <div className="w-9 h-9 rounded-full bg-background-surface-200 flex items-center justify-center">
                    <ClockAlert size={18} className="opacity-60" />
                  </div>
                  <div className="text-[15px] font-semibold">
                    This checkout link has expired
                  </div>
                  <div className="text-[12.5px] text-foreground-lighter max-w-[260px] leading-[1.5]">
                    No payment was detected before the link expired. Ask the
                    merchant for a new checkout link.
                  </div>
                  <StatusPill variant="secondary">Expired</StatusPill>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-foreground-lighter mb-2">
                404 — checkout link not found
              </div>
              <div className="w-[340px] border border-border rounded-xl bg-card shadow-xs overflow-hidden">
                <div className="px-6 py-10 flex flex-col items-center gap-2.5 text-center">
                  <div className="heading-meta text-foreground-lighter">
                    404
                  </div>
                  <div className="text-[15px] font-semibold">
                    Checkout link not found
                  </div>
                  <div className="text-[12.5px] text-foreground-lighter max-w-[260px] leading-[1.5]">
                    This link may have been removed, or the URL was typed
                    incorrectly.
                  </div>
                  <Button variant="outline" size="tiny">
                    Go to Outpay
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
