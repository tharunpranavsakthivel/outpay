"use client";

import { AlertTriangle, Check, ImagePlus, ShieldCheck } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Checkbox } from "../components/ui/Checkbox";
import { Input } from "../components/ui/Input";

type Screen = "signup" | "login" | "forgot" | "onboarding";

const STEP_LABELS = ["Store details", "Wallet address", "Confirm"];
const INLINE_ACTION_CLASS =
  "bg-transparent border-0 p-0 font-inherit text-foreground font-medium cursor-pointer underline underline-offset-2";

/**
 * Auth & onboarding flow: sign up, log in, forgot password, and the
 * 3-step store onboarding wizard (store details → wallet → confirm).
 * In production this would likely be 4 routes; kept as one component here
 * to mirror the reviewable state-switcher screen it was designed in.
 */
export default function AuthOnboarding() {
  const [screen, setScreen] = useState<Screen>("signup");
  const [resetSent, setResetSent] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [step, setStep] = useState(1);
  const [storeName, setStoreName] = useState("");
  const [storeDesc, setStoreDesc] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletConfirmed, setWalletConfirmed] = useState(false);

  const step1Disabled = !storeName.trim();
  const step2Disabled = !walletAddress.trim() || !walletConfirmed;

  const Shell = ({
    children,
    width = 400,
  }: {
    children: React.ReactNode;
    width?: number;
  }) => (
    <div
      style={{ width, maxWidth: "100%" }}
      className="animate-[op-fade-in_0.25s_ease-out]"
    >
      <div className="text-center mb-7">
        <div className="text-[15px] font-semibold tracking-[-0.01em]">
          Outpay
        </div>
      </div>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-background font-sans text-foreground relative flex items-center justify-center px-5 py-16">
      {screen === "signup" && (
        <Shell>
          <Card>
            <CardHeader>
              <CardTitle>Create your account</CardTitle>
              <CardDescription>
                Accept USDC payments on Base in a few minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5 border-b-0">
              <Input label="Email" type="email" placeholder="you@store.com" />
              <Input
                label="Password"
                type="password"
                placeholder="At least 8 characters"
              />
            </CardContent>
            <CardContent className="flex flex-col gap-3.5 border-b-0 pt-1">
              <Button
                variant="primary"
                size="medium"
                block
                onClick={() => {
                  setScreen("onboarding");
                  setStep(1);
                }}
              >
                Sign up
              </Button>
              <div className="text-center text-[12.5px] text-foreground-lighter">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setScreen("login")}
                  className={INLINE_ACTION_CLASS}
                >
                  Log in
                </button>
              </div>
            </CardContent>
          </Card>
        </Shell>
      )}

      {screen === "login" && (
        <Shell>
          <Card>
            <CardHeader>
              <CardTitle>Log in</CardTitle>
              <CardDescription>Welcome back.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5 border-b-0">
              <Input label="Email" type="email" placeholder="you@store.com" />
              <div>
                <Input
                  label="Password"
                  type="password"
                  placeholder="Your password"
                />
                <div className="text-right mt-1.5">
                  <button
                    type="button"
                    onClick={() => setScreen("forgot")}
                    className="bg-transparent border-0 p-0 font-inherit text-xs text-foreground-lighter cursor-pointer underline underline-offset-2"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
            </CardContent>
            <CardContent className="flex flex-col gap-3.5 border-b-0 pt-1">
              <Button
                variant="primary"
                size="medium"
                block
                onClick={() => {
                  setScreen("onboarding");
                  setStep(1);
                }}
              >
                Log in
              </Button>
              <div className="text-center text-[12.5px] text-foreground-lighter">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => setScreen("signup")}
                  className={INLINE_ACTION_CLASS}
                >
                  Sign up
                </button>
              </div>
            </CardContent>
          </Card>
        </Shell>
      )}

      {screen === "forgot" && (
        <Shell>
          <Card>
            {!resetSent ? (
              <>
                <CardHeader>
                  <CardTitle>Reset your password</CardTitle>
                  <CardDescription>
                    Enter the email on your account and we'll send a reset link.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3.5 border-b-0">
                  <Input
                    label="Email"
                    type="email"
                    placeholder="you@store.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </CardContent>
                <CardContent className="flex flex-col gap-3.5 border-b-0 pt-1">
                  <Button
                    variant="primary"
                    size="medium"
                    block
                    onClick={() => setResetSent(true)}
                  >
                    Send reset link
                  </Button>
                  <div className="text-center text-[12.5px] text-foreground-lighter">
                    <button
                      type="button"
                      onClick={() => setScreen("login")}
                      className={INLINE_ACTION_CLASS}
                    >
                      Back to log in
                    </button>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex flex-col items-center text-center gap-3 border-b-0 py-9 px-6">
                <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center">
                  <Check size={20} className="opacity-85" />
                </div>
                <div className="text-[15px] font-semibold">
                  Check your email
                </div>
                <div className="text-sm text-foreground-lighter leading-[1.5] max-w-[300px]">
                  We sent a password reset link to{" "}
                  <strong className="text-foreground font-medium">
                    {forgotEmail || "you@store.com"}
                  </strong>
                  . It expires in 30 minutes.
                </div>
                <div className="text-xs text-foreground-lighter mt-1">
                  Didn't get it?{" "}
                  <button
                    type="button"
                    onClick={() => setResetSent(true)}
                    className={INLINE_ACTION_CLASS}
                  >
                    Resend
                  </button>
                </div>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setScreen("login")}
                    className="bg-transparent border-0 p-0 font-inherit text-[12.5px] text-foreground-lighter cursor-pointer underline underline-offset-2"
                  >
                    Back to log in
                  </button>
                </div>
              </CardContent>
            )}
          </Card>
        </Shell>
      )}

      {screen === "onboarding" && (
        <Shell width={460}>
          {/* step indicator */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-2.5">
              {[1, 2, 3].map((n) => {
                const isDone = n < step;
                const isActive = n === step;
                return (
                  <div
                    key={n}
                    className="flex items-center gap-2 flex-1 last:flex-none"
                  >
                    <div
                      className={[
                        "w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold border",
                        isDone || isActive
                          ? "bg-foreground text-background border-transparent"
                          : "bg-transparent text-foreground-lighter border-border",
                      ].join(" ")}
                    >
                      {isDone ? <Check size={11} /> : n}
                    </div>
                    {n < 3 && (
                      <div
                        className={[
                          "h-px flex-1",
                          n < step ? "bg-foreground" : "bg-border",
                        ].join(" ")}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-foreground-lighter font-medium">
              Step {step} of 3 — {STEP_LABELS[step - 1]}
            </div>
          </div>

          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Tell us about your store</CardTitle>
                <CardDescription>
                  This appears on your checkout pages and payment records.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 border-b-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-xl bg-accent shrink-0 flex items-center justify-center">
                    <ImagePlus size={18} className="opacity-50" />
                  </div>
                  <div>
                    <Button variant="outline" size="tiny">
                      Upload logo
                    </Button>
                    <div className="text-[11px] text-foreground-lighter mt-1.5">
                      PNG or SVG, at least 256×256. Optional — you can add this
                      later.
                    </div>
                  </div>
                </div>
                <Input
                  label="Store name"
                  placeholder="Acme Coffee Co."
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                />
                <Input
                  label="Short description"
                  placeholder="Specialty coffee beans & equipment"
                  value={storeDesc}
                  onChange={(e) => setStoreDesc(e.target.value)}
                />
              </CardContent>
              <CardContent className="flex justify-end border-b-0">
                <Button
                  variant="primary"
                  size="medium"
                  disabled={step1Disabled}
                  onClick={() => setStep(2)}
                >
                  Continue
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Add your payout wallet</CardTitle>
                <CardDescription>
                  Every payment your customers make goes directly here.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 border-b-0">
                <div className="flex gap-2 items-start text-xs leading-[1.5] bg-foreground/[0.026] border border-border rounded-lg p-3 text-foreground-light">
                  <ShieldCheck
                    size={14}
                    className="shrink-0 mt-0.5 opacity-60"
                  />
                  <div>
                    This is where every customer payment is sent directly,
                    wallet-to-wallet. Outpay never holds, custodies, or has
                    access to your funds.
                  </div>
                </div>
                <Input
                  label="Wallet address (Base)"
                  placeholder="0x…"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                />
                <div className="flex gap-2 items-start text-xs leading-[1.5] bg-warning/10 border border-border-warning rounded-lg p-3 text-foreground">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    Double-check this address before continuing. Payments on
                    Base cannot be reversed, and Outpay cannot recover funds
                    sent to the wrong wallet.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    checked={walletConfirmed}
                    onChange={setWalletConfirmed}
                  />
                  <span className="text-[12.5px] text-foreground-light leading-[1.5]">
                    I confirm this address is correct and controlled by me.
                  </span>
                </div>
              </CardContent>
              <CardContent className="flex justify-between border-b-0">
                <Button variant="text" size="medium" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  size="medium"
                  disabled={step2Disabled}
                  onClick={() => setStep(3)}
                >
                  Continue
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>You're all set</CardTitle>
                <CardDescription>
                  Review your details — you can change these anytime in
                  settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 border-b-0">
                <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                  <div className="w-10 h-10 rounded-[9px] bg-accent shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {storeName.trim() || "Untitled store"}
                    </div>
                    <div className="text-xs text-foreground-lighter truncate">
                      {storeDesc.trim() || "No description added"}
                    </div>
                  </div>
                </div>
                <div className="p-3 border border-border rounded-lg">
                  <div className="heading-meta text-foreground-lighter mb-1.5">
                    Payout wallet (Base)
                  </div>
                  <div className="font-mono text-[12.5px] text-foreground break-all">
                    {walletAddress}
                  </div>
                </div>
                <div className="flex gap-2 items-start text-xs leading-[1.5] bg-foreground/[0.026] border border-border rounded-lg p-3 text-foreground-light">
                  <ShieldCheck
                    size={14}
                    className="shrink-0 mt-0.5 opacity-60"
                  />
                  <div>
                    Checkouts are ready to accept USDC on Base. Payments go
                    straight to your wallet — nothing further to set up.
                  </div>
                </div>
              </CardContent>
              <CardContent className="flex justify-between items-center border-b-0">
                <Button variant="text" size="medium" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  size="medium"
                  onClick={() => {
                    window.location.href = "/dashboard";
                  }}
                >
                  Go to dashboard
                </Button>
              </CardContent>
            </Card>
          )}
        </Shell>
      )}
    </div>
  );
}
