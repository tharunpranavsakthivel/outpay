"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
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
import type {
  CreateCheckoutPageData,
  CreateCheckoutResult,
} from "../lib/dashboard/types";

function usdToUsdc(usd: string) {
  const numericValue = Number(usd.replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "0.00";
  }

  return numericValue.toFixed(2);
}

/**
 * Create-checkout view backed by the `/api/checkouts` collection route.
 */
export default function CreateCheckout({
  initialData,
}: {
  initialData: CreateCheckoutPageData;
}) {
  const [name, setName] = useState("");
  const [amountUsd, setAmountUsd] = useState("124.00");
  const [reference, setReference] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy link");
  const [createdCheckout, setCreatedCheckout] =
    useState<CreateCheckoutResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isCreating, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const amountUsdc = usdToUsdc(amountUsd);
  const createDisabled = !name.trim() || Number(amountUsdc) <= 0;

  const handleCreate = () => {
    if (createDisabled) {
      return;
    }

    startTransition(async () => {
      setSubmitError(null);

      const response = await fetch("/api/checkouts", {
        body: JSON.stringify({
          amountUsd,
          label: name,
          orderReference: reference,
          redirectUrl,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json()) as
        | CreateCheckoutResult
        | { error?: { message?: string } };
      const errorMessage = (payload as { error?: { message?: string } }).error
        ?.message;

      if (!response.ok || "error" in payload) {
        setSubmitError(errorMessage ?? "Unable to create checkout.");
        return;
      }

      setCreatedCheckout(payload as CreateCheckoutResult);
      setCopyLabel("Copy link");
    });
  };

  const handleCopy = () => {
    if (!createdCheckout) {
      return;
    }

    const checkoutUrl = origin
      ? `${origin}${createdCheckout.checkoutUrl}`
      : createdCheckout.checkoutUrl;
    navigator.clipboard?.writeText(checkoutUrl).catch(() => undefined);
    setCopyLabel("Copied");
    setTimeout(() => setCopyLabel("Copy link"), 1400);
  };

  const qrCodeUrl = createdCheckout
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`${origin}${createdCheckout.checkoutUrl}`)}`
    : "";

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar
        active="checkouts"
        storeName={initialData.merchant.storeName}
      />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between px-8 py-4 border-b border-border">
          <div>
            <h1 className="heading-title m-0">Create checkout</h1>
            <p className="m-0 mt-1 text-xs text-foreground-lighter">
              Generate a live checkout session that writes to
              `checkout_sessions` and `payment_intents`.
            </p>
          </div>
        </div>

        <div className="px-8 pt-7 pb-12">
          {createdCheckout ? (
            <div className="max-w-[560px]">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="w-[22px] h-[22px] rounded-full bg-primary/20 flex items-center justify-center">
                      <Check size={13} />
                    </div>
                    <CardTitle>Checkout created</CardTitle>
                  </div>
                  <CardDescription>
                    Share this checkout URL to collect{" "}
                    {createdCheckout.amountLabel}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5 border-b-0">
                  <div>
                    <div className="text-sm font-medium mb-1.5">
                      Payment link
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 h-[38px] border border-border-control rounded-sm bg-foreground/[0.026] flex items-center px-3 font-mono text-xs text-foreground overflow-hidden whitespace-nowrap text-ellipsis">
                        {origin}
                        {createdCheckout.checkoutUrl}
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
                      This QR code points to the hosted checkout backed by the
                      saved `public_token`.
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="medium"
                      onClick={() =>
                        window.open(
                          createdCheckout.checkoutUrl,
                          "_blank",
                          "noopener",
                        )
                      }
                    >
                      Open checkout
                    </Button>
                    <Button
                      variant="text"
                      size="medium"
                      onClick={() => setCreatedCheckout(null)}
                    >
                      Create another checkout
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div
              className="grid gap-6 max-w-[980px]"
              style={{ gridTemplateColumns: "1fr 360px" }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Checkout details</CardTitle>
                  <CardDescription>
                    Funds settle directly to {initialData.payoutWallet} in{" "}
                    {initialData.tokenSymbol} on {initialData.chainName}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4.5 border-b-0">
                  <Input
                    label="Product or order name"
                    placeholder="e.g. Espresso subscription - 1 month"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <div>
                    <Input
                      label="Amount (USD)"
                      placeholder="0.00"
                      value={amountUsd}
                      onChange={(event) => setAmountUsd(event.target.value)}
                    />
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-foreground-lighter">
                      <span>≈</span>
                      <span className="font-mono text-foreground font-medium">
                        {amountUsdc} {initialData.tokenSymbol}
                      </span>
                      <span>at 1.00 {initialData.tokenSymbol} / USD</span>
                    </div>
                  </div>
                  <Input
                    label="Order reference (optional)"
                    placeholder="e.g. Order #4471"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                  />
                  <Input
                    label="Redirect URL (optional)"
                    placeholder="https://your-store.com/thank-you"
                    hint="After payment confirmation the hosted receipt can redirect here."
                    value={redirectUrl}
                    onChange={(event) => setRedirectUrl(event.target.value)}
                  />
                  <div className="flex gap-2 items-start text-xs leading-[1.5] bg-warning/10 border border-border-warning rounded-lg p-3 text-foreground">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <div>
                      The customer must send the exact amount in{" "}
                      {initialData.tokenSymbol} on {initialData.chainName}. The
                      recipient wallet is fixed from the active merchant payout
                      wallet record.
                    </div>
                  </div>
                  {submitError && (
                    <div className="text-sm text-destructive">
                      {submitError}
                    </div>
                  )}
                </CardContent>
                <CardContent className="flex justify-end">
                  <Button
                    variant="primary"
                    size="medium"
                    disabled={createDisabled || isCreating}
                    onClick={handleCreate}
                  >
                    {isCreating ? "Creating…" : "Create checkout link"}
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
                      {initialData.merchant.storeName}
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
                          {initialData.tokenSymbol}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 items-start text-[11px] leading-[1.5] bg-warning/10 border border-border-warning rounded-lg p-2.5 text-foreground">
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      <div>
                        {initialData.chainName} only. Send exactly{" "}
                        <strong>
                          {amountUsdc} {initialData.tokenSymbol}
                        </strong>
                        .
                      </div>
                    </div>
                    <Button variant="primary" block disabled>
                      Pay with wallet
                    </Button>
                    <div className="text-[11px] text-foreground-lighter text-center leading-[1.5]">
                      Non-custodial: funds go directly to the merchant wallet
                      saved in the schema.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
