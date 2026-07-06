"use client";

import { Clock } from "lucide-react";
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

/** Account settings: personal profile, password change, 2FA (coming soon). Store/Account tab switcher at top. */
export default function AccountSettings() {
  const [fullName, setFullName] = useState("Jordan Reyes");
  const [email, setEmail] = useState("jordan@acmecoffee.com");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar active="settings" />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-10 bg-background px-8 py-4 border-b border-border">
          <h1 className="heading-title m-0">Settings</h1>
          <p className="m-0 mt-1 text-xs text-foreground-lighter">
            Store profile and account preferences.
          </p>
        </div>

        <div className="px-8 pt-5">
          <div className="flex items-center gap-5 border-b border-border">
            <a
              href="/settings"
              className="py-2 text-sm border-b-2 border-transparent text-foreground-lighter no-underline"
            >
              Store
            </a>
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
              <Input
                label="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </CardContent>
            <CardContent className="flex justify-end">
              <Button variant="primary" size="medium">
                Save changes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
              <CardDescription>
                Choose a new password for your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 border-b-0">
              <Input
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <Input
                label="New password"
                type="password"
                hint="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </CardContent>
            <CardContent className="flex justify-end">
              <Button
                variant="outline"
                size="medium"
                disabled={!currentPassword || newPassword.length < 8}
              >
                Update password
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between border-b-0">
              <div>
                <div className="text-sm font-medium">
                  Two-factor authentication
                </div>
                <div className="text-xs text-foreground-lighter mt-0.5 max-w-[400px]">
                  Add an extra layer of security when logging in.
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-foreground-lighter border border-border rounded-full px-2.5 py-1 whitespace-nowrap">
                <Clock size={11} className="opacity-60" /> Coming soon
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
