"use client";

import { CheckCircle, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { DashboardSidebar } from "../components/layout/DashboardSidebar";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import type { FirstLoginPageData } from "../lib/dashboard/types";

/**
 * First-login dashboard backed by live onboarding-adjacent schema state.
 */
export default function FirstLoginDashboard({
  initialData,
}: {
  initialData: FirstLoginPageData;
}) {
  const completeCount = initialData.checklist.filter(
    (step) => step.done,
  ).length;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar
        active="dashboard"
        storeName={initialData.merchant.storeName}
      />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between px-8 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[7px] bg-accent flex items-center justify-center text-xs font-semibold">
              {initialData.merchant.storeName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">
                {initialData.merchant.storeName}
              </span>
              <span className="text-[11px] text-foreground-lighter">
                outpay.dev/{initialData.merchant.publicSlug}
              </span>
            </div>
          </div>
          <Link href="/checkouts/new" className="no-underline">
            <Button variant="primary" size="medium">
              Create checkout
            </Button>
          </Link>
        </div>

        <div className="px-8 pt-7 pb-12 flex flex-col gap-5">
          <div>
            <h1 className="heading-title m-0">Dashboard</h1>
            <p className="m-0 mt-1.5 text-xs text-foreground-lighter">
              Complete the schema-backed setup steps before accepting live
              payments.
            </p>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Finish setting up your store</CardTitle>
                <CardDescription>
                  These steps are driven by wallet, checkout, and webhook rows
                  in the current database.
                </CardDescription>
              </div>
              <div className="text-xs font-medium text-foreground-lighter whitespace-nowrap">
                {completeCount} of {initialData.checklist.length} complete
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-0.5 border-b-0">
              {initialData.checklist.map((step, index) => (
                <div
                  key={step.key}
                  className={[
                    "flex items-center gap-3.5 py-3.5 px-1",
                    index < initialData.checklist.length - 1
                      ? "border-b border-border"
                      : "",
                  ].join(" ")}
                >
                  <div className="w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center border bg-transparent border-border-control">
                    {step.done && (
                      <CheckCircle size={14} className="opacity-70" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {step.title}
                    </div>
                    <div className="text-xs text-foreground-lighter mt-0.5">
                      {step.description}
                    </div>
                  </div>
                  <Link href={step.href} className="no-underline shrink-0">
                    <Button
                      variant={step.done ? "secondary" : "outline"}
                      size="tiny"
                    >
                      {step.done ? "Review" : step.actionLabel}
                    </Button>
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid grid-cols-4 gap-4">
            {initialData.metrics.map((metric) => (
              <Card key={metric.label}>
                <CardContent className="border-b-0">
                  <div className="heading-meta text-foreground-lighter mb-2">
                    {metric.label}
                  </div>
                  <div className="text-2xl font-medium text-foreground">
                    {metric.value}
                  </div>
                  <div className="text-xs text-foreground-lighter mt-1">
                    {metric.sub}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent payments</CardTitle>
              <CardDescription>
                No payment rows exist until a checkout reaches the payment flow
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
                customer to create your first payment record.
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
