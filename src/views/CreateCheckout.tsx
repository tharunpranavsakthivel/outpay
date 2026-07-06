"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useState } from "react";
import { DashboardSidebar } from "../components/layout/DashboardSidebar";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Input } from "../components/ui/Input";

function usdToUsdc(usd: string) {
  const n = parseFloat(usd.replace(/[^0-9.]/g, ""));
  if (!n || Number.isNaN(n)) return "0.00";
  return n.toFixed(2);
}

/** Create checkout: form + live customer preview, then a link-created success state. */
export default function CreateCheckout() {
  const [name, setName] = useState("Espresso subscription — 1 month");
  const [amountUsd, setAmountUsd] = useState("124.00");
  const [reference, setReference] = useState("Order #4471");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [stage, setStage] = useState<"form" | "success">("form");
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy link");

  const amountUsdc = usdToUsdc(amountUsd);
  const checkoutLink = checkoutId ? `outpay.link/c/${checkoutId}` : "";
  const qrCodeUrl = checkoutId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https://${checkoutLink}`
    : "";
  const createDisabled = !name || !amountUsd;

  const handleCreate = () => {
    if (createDisabled) return;
    setCheckoutId(Math.random().toString(16).slice(2, 14));
    setStage("success");
    setCopyLabel("Copy link");
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(checkoutLink).catch(() => {});
    setCopyLabel("Copied");
    setTimeout(() => setCopyLabel("Copy link"), 1400);
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar active="checkouts" />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between px-8 py-4 border-b border-border">
          <div>
            <h1 className="heading-title m-0">Create checkout</h1>
            <p className="m-0 mt-1 text-xs text-foreground-lighter">
              Generate a payment link to share with a customer.
            </p>
          </div>
        </div>

        <div className="px-8 pt-7 pb-12">
          {stage === "form" ? (
            <div
              className="grid gap-6 max-w-[980px]"
              style={{ gridTemplateColumns: "1fr 360px" }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Checkout details</CardTitle>
                  <CardDescription>
                    This customer will pay in USDC on Base only.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4.5 border-b-0">
                  <Input
                    label="Product or order name"
                    placeholder="e.g. Espresso subscription — 1 month"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <div>
                    <Input
                      label="Amount (USD)"
                      placeholder="0.00"
                      value={amountUsd}
                      onChange={(e) => setAmountUsd(e.target.value)}
                    />
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-foreground-lighter">
                      <span>≈</span>
                      <span className="font-mono text-foreground font-medium">
                        {amountUsdc} USDC
                      </span>
                      <span>at 1.00 USDC / USD</span>
                    </div>
                  </div>
                  <Input
                    label="Order reference (optional)"
                    placeholder="e.g. Order #4471"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                  <Input
                    label="Redirect URL (optional)"
                    placeholder="https://your-store.com/thank-you"
                    hint="Sends the customer here after payment is confirmed."
                    value={redirectUrl}
                    onChange={(e) => setRedirectUrl(e.target.value)}
                  />
                  <div className="flex gap-2 items-start text-xs leading-[1.5] bg-warning/10 border border-border-warning rounded-lg p-3 text-foreground">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <div>
                      The customer will pay the exact USDC amount on{" "}
                      <strong>Base</strong> only — no other assets or networks
                      are accepted.
                    </div>
                  </div>
                </CardContent>
                <CardContent className="flex justify-end">
                  <Button
                    variant="primary"
                    size="medium"
                    disabled={createDisabled}
                    onClick={handleCreate}
                  >
                    Create checkout link
                  </Button>
                </CardContent>
              </Card>

              <div className="h-fit">
                <div className="heading-meta text-foreground-lighter mb-2.5">
                  Customer will see
                </div>
                <div className="border border-border rounded-xl shadow-xs overflow-hidden bg-card">
                  <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                    <div className="w-[18px] h-[18px] rounded-[5px] bg-accent" />
                    <span className="font-semibold text-sm">
                      Acme Coffee Co.
                    </span>
                  </div>
                  <div className="p-6 flex flex-col gap-4">
                    <div className="text-center">
                      <div className="text-xs text-foreground-lighter mb-1">
                        {reference || name || "Order"}
                      </div>
                      <div className="text-[30px] font-medium">
                        {amountUsdc}{" "}
                        <span className="text-sm text-foreground-lighter">
                          USDC
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 items-start text-[11px] leading-[1.5] bg-warning/10 border border-border-warning rounded-lg p-2.5 text-foreground">
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      <div>
                        Base network only. Send exactly{" "}
                        <strong>{amountUsdc} USDC</strong> on Base.
                      </div>
                    </div>
                    <Button variant="primary" block disabled>
                      Pay with wallet
                    </Button>
                    <div className="text-[11px] text-foreground-lighter text-center leading-[1.5]">
                      Non-custodial: funds go directly from the customer's
                      wallet to yours.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-[560px]">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="w-[22px] h-[22px] rounded-full bg-primary/20 flex items-center justify-center">
                      <Check size={13} />
                    </div>
                    <CardTitle>Checkout link created</CardTitle>
                  </div>
                  <CardDescription>
                    Share this link with your customer to collect {amountUsdc}{" "}
                    USDC.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5 border-b-0">
                  <div>
                    <div className="text-sm font-medium mb-1.5">
                      Payment link
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 h-[38px] border border-border-control rounded-sm bg-foreground/[0.026] flex items-center px-3 font-mono text-xs text-foreground overflow-hidden whitespace-nowrap text-ellipsis">
                        {checkoutLink}
                      </div>
                      <Button
                        variant="outline"
                        size="medium"
                        onClick={handleCopy}
                      >
                        {copyLabel}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 pt-1">
                    <img
                      src={qrCodeUrl}
                      className="w-[108px] h-[108px] border border-border rounded-lg"
                      alt="Checkout QR code"
                    />
                    <div className="text-xs text-foreground-lighter leading-[1.6]">
                      Scan to open the checkout on a phone, or print this QR
                      code at point of sale.
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="medium">
                      Share
                    </Button>
                    <Button
                      variant="text"
                      size="medium"
                      onClick={() => setStage("form")}
                    >
                      Create another checkout
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
