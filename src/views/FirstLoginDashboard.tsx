"use client";

import { Check, CheckCircle, Link as LinkIcon } from "lucide-react";
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

/** First-login (empty) dashboard: setup checklist + zero-state metrics/payments. */
export default function FirstLoginDashboard() {
  const [walletDone, setWalletDone] = useState(false);
  const [checkoutDone, setCheckoutDone] = useState(false);
  const [webhookDone, setWebhookDone] = useState(false);

  const checklist = [
    {
      key: "wallet",
      done: walletDone,
      set: setWalletDone,
      title: "Add your wallet address",
      desc: "Payments will be sent directly here — no custody, ever.",
      actionLabel: "Add wallet",
    },
    {
      key: "checkout",
      done: checkoutDone,
      set: setCheckoutDone,
      title: "Create your first checkout link",
      desc: "Generate a shareable payment page for an order.",
      actionLabel: "Create checkout",
    },
    {
      key: "webhook",
      done: webhookDone,
      set: setWebhookDone,
      title: "Send a test webhook",
      desc: "Confirm your endpoint receives signed payment events.",
      actionLabel: "Send test",
    },
  ];
  const completeCount = checklist.filter((c) => c.done).length;

  const metrics = [
    { label: "Payment volume (30d)", value: "$0.00", sub: "0 checkouts" },
    { label: "Paid checkouts", value: "0", sub: "no completions yet" },
    { label: "Pending checkouts", value: "0", sub: "nothing awaiting" },
    { label: "Webhook success rate", value: "—", sub: "no deliveries yet" },
  ];

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar active="dashboard" storeName="New Store" />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between px-8 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[7px] bg-accent flex items-center justify-center text-xs font-semibold">
              NS
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">New Store</span>
              <span className="text-[11px] text-foreground-lighter">
                outpay.dev/new-store
              </span>
            </div>
          </div>
          <Button variant="primary" size="medium">
            Create checkout
          </Button>
        </div>

        <div className="px-8 pt-7 pb-12 flex flex-col gap-5">
          <div>
            <h1 className="heading-title m-0">Dashboard</h1>
            <p className="m-0 mt-1.5 text-xs text-foreground-lighter">
              Payment volume and checkout status across your store.
            </p>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Finish setting up your store</CardTitle>
                <CardDescription>
                  A few steps left before you can accept live payments.
                </CardDescription>
              </div>
              <div className="text-xs font-medium text-foreground-lighter whitespace-nowrap">
                {completeCount} of 3 complete
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-0.5 border-b-0">
              {checklist.map((step, i) => (
                <div
                  key={step.key}
                  className={[
                    "flex items-center gap-3.5 py-3.5 px-1",
                    i < checklist.length - 1 ? "border-b border-border" : "",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center border",
                      step.done
                        ? "bg-foreground border-transparent"
                        : "bg-transparent border-border-control",
                    ].join(" ")}
                  >
                    {step.done && (
                      <Check size={12} className="text-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {step.title}
                    </div>
                    <div className="text-xs text-foreground-lighter mt-0.5">
                      {step.desc}
                    </div>
                  </div>
                  {step.done ? (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground-lighter shrink-0">
                      <CheckCircle size={14} className="opacity-60" /> Done
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="tiny"
                      onClick={() => step.set(true)}
                      className="shrink-0"
                    >
                      {step.actionLabel}
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid grid-cols-4 gap-4">
            {metrics.map((m) => (
              <Card key={m.label}>
                <CardContent className="border-b-0">
                  <div className="heading-meta text-foreground-lighter mb-2">
                    {m.label}
                  </div>
                  <div className="text-2xl font-medium text-foreground">
                    {m.value}
                  </div>
                  <div className="text-xs text-foreground-lighter mt-1">
                    {m.sub}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent payments</CardTitle>
              <CardDescription>
                Latest payment activity across your store
              </CardDescription>
            </CardHeader>
            <div className="flex flex-col items-center justify-center gap-3 py-16 px-8 text-center">
              <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center">
                <LinkIcon size={20} className="opacity-70" />
              </div>
              <div className="text-sm font-semibold text-foreground">
                No payments yet
              </div>
              <div className="text-sm text-foreground-lighter max-w-[320px] leading-[1.5]">
                Finish the setup steps above, then share a checkout link with a
                customer to see your first USDC payment show up here.
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
