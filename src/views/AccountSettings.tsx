"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AvatarColorPicker } from "../components/account/AvatarColorPicker";
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
import { useToast } from "../components/ui/Toast";
import { formatDashboardDate } from "../lib/dashboard/format";
import type { AccountSettingsData } from "../lib/dashboard/types";

/**
 * Account settings view backed by user_profiles and aligned with Better Auth
 * credentials.
 */
export default function AccountSettings({
  initialData,
}: {
  initialData: AccountSettingsData;
}) {
  const [fullName, setFullName] = useState(initialData.fullName ?? "");
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const saveProfile = () => {
    startTransition(async () => {
      const response = await fetch("/api/settings/account-profile", {
        body: JSON.stringify({
          fullName,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const payload = (await response.json()) as
        | { error?: { message?: string } }
        | Record<string, unknown>;
      const responseError = (payload as { error?: { message?: string } }).error
        ?.message;

      if (!response.ok || "error" in payload) {
        toast.error(responseError ?? "Unable to save account.");
        return;
      }

      toast.success("Account profile saved.");
    });
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar
        active="settings"
        storeName={initialData.merchant.storeName}
        logoUrl={initialData.merchant.logoUrl}
        userAvatarColor={initialData.merchant.userAvatarColor}
        userName={initialData.merchant.userFullName}
      />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-10 bg-background px-8 py-4 border-b border-border">
          <h1 className="heading-title m-0">Settings</h1>
          <p className="m-0 mt-1 text-xs text-foreground-lighter">
            User profile data from `user_profiles`, with credentials managed by
            Better Auth.
          </p>
        </div>

        <div className="px-8 pt-5">
          <div className="flex items-center gap-5 border-b border-border">
            <Link
              href="/settings"
              className="py-2 text-sm border-b-2 border-transparent text-foreground-lighter no-underline"
            >
              Store
            </Link>
            <div className="py-2 text-sm border-b-2 border-foreground text-foreground cursor-pointer">
              Account
            </div>
          </div>
        </div>

        <div className="px-8 py-6 max-w-[640px] flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Your account</CardTitle>
              <CardDescription>
                Personal details for your Outpay login.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 border-b-0">
              <AvatarColorPicker
                fallbackLabel={initialData.fullName || initialData.email || "?"}
                initialColor={initialData.merchant.userAvatarColor}
              />
              <Input
                label="Full name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
              <Input
                label="Email"
                type="email"
                value={initialData.email}
                disabled
              />
            </CardContent>
            <CardContent className="flex justify-end">
              <Button
                variant="primary"
                size="medium"
                disabled={isPending}
                onClick={saveProfile}
              >
                Save changes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Password and sign-in</CardTitle>
              <CardDescription>
                Password changes are handled through Better Auth rather than a
                custom application credential store.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 border-b-0">
              <div className="text-sm text-foreground-light">
                Last password change:{" "}
                {initialData.passwordChangedAt
                  ? formatDashboardDate(initialData.passwordChangedAt)
                  : "No password change timestamp recorded"}
              </div>
              <div className="text-sm text-foreground-light">
                Two-factor status: {initialData.twoFactorStatus}
              </div>
              <Link href="/forgot" className="no-underline w-fit">
                <Button variant="outline" size="medium">
                  Start password reset
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
