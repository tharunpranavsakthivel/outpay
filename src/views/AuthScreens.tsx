"use client";

import { AlertTriangle, Check, ImagePlus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth/client";
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

const STEP_LABELS = ["Store details", "Wallet address", "Confirm"];
const INLINE_ACTION_CLASS =
  "bg-transparent border-0 p-0 font-inherit text-foreground font-medium cursor-pointer underline underline-offset-2";

/**
 * Builds a default Better Auth profile name from the signup email when the UI
 * only collects email and password.
 *
 * Parameters:
 * - email: Email address entered on the signup form.
 *
 * Returns:
 * - Trimmed local-part based display name, or `Merchant` as a safe fallback.
 */
function buildSignupName(email: string) {
  const [localPart] = email.trim().split("@");
  return localPart?.trim() || "Merchant";
}

/**
 * Normalizes post-auth redirects so only in-app relative paths are honored.
 *
 * Parameters:
 * - candidate: Raw `returnTo` query-string value.
 * - fallbackPath: Route used when the candidate is missing or invalid.
 *
 * Returns:
 * - Safe relative path for the next client-side navigation.
 */
function resolveAuthRedirect(candidate: string | null, fallbackPath: string) {
  if (!candidate || !candidate.startsWith("/")) {
    return fallbackPath;
  }

  return candidate;
}

/**
 * AuthShell renders the shared centered shell used by all auth-entry pages.
 *
 * @param children Page content rendered inside the shell.
 * @param width Optional shell width for wider onboarding content.
 * @returns Shared auth page chrome.
 */
function AuthShell({
  children,
  width = 400,
}: {
  children: React.ReactNode;
  width?: number;
}) {
  return (
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
}

/**
 * AuthPageFrame provides the full-page background and centering wrapper for
 * the auth and onboarding routes.
 *
 * @param children Route-specific auth content.
 * @returns Auth route page frame.
 */
function AuthPageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground relative flex items-center justify-center px-5 py-16">
      {children}
    </div>
  );
}

/**
 * AuthInlineLink renders a text-only route transition matching the existing
 * auth prototype styling.
 *
 * @param href Internal route to navigate to.
 * @param children Link label content.
 * @returns Styled auth text link.
 */
function AuthInlineLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={INLINE_ACTION_CLASS}>
      {children}
    </Link>
  );
}

/**
 * OnboardingStepIndicator shows progress through the 3-step merchant setup
 * wizard.
 *
 * @param step Current 1-based onboarding step.
 * @returns Step indicator UI.
 */
function OnboardingStepIndicator({ step }: { step: number }) {
  return (
    <div className="mb-7">
      <div className="flex items-center gap-2 mb-2.5">
        {[1, 2, 3].map((number) => {
          const isDone = number < step;
          const isActive = number === step;
          return (
            <div
              key={number}
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
                {isDone ? <Check size={11} /> : number}
              </div>
              {number < 3 && (
                <div
                  className={[
                    "h-px flex-1",
                    number < step ? "bg-foreground" : "bg-border",
                  ].join(" ")}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="text-xs text-foreground-lighter font-medium">
        Step {step} of 3 - {STEP_LABELS[step - 1]}
      </div>
    </div>
  );
}

/**
 * SignupScreen renders the dedicated account creation page.
 *
 * @param returnTo Optional in-app path to visit after sign-up.
 * @returns Signup route content.
 */
export function SignupScreen({ returnTo }: { returnTo?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitSignup = () => {
    startTransition(async () => {
      setErrorMessage(null);

      try {
        const response = await authClient.signUp.email({
          email,
          name: buildSignupName(email),
          password,
        });

        if (response.error) {
          setErrorMessage(response.error.message || "Unable to create account.");
          return;
        }

        router.push(resolveAuthRedirect(returnTo ?? null, "/onboarding"));
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to create account.",
        );
      }
    });
  };

  return (
    <AuthPageFrame>
      <AuthShell>
        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              Accept USDC payments on Base in a few minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3.5 border-b-0">
            <Input
              label="Email"
              type="email"
              placeholder="you@store.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {errorMessage && (
              <div className="text-sm text-destructive">{errorMessage}</div>
            )}
          </CardContent>
          <CardContent className="flex flex-col gap-3.5 border-b-0 pt-1">
            <Button
              variant="primary"
              size="medium"
              block
              disabled={!email.trim() || password.length < 8 || isPending}
              onClick={submitSignup}
            >
              {isPending ? "Creating account..." : "Sign up"}
            </Button>
            <div className="text-center text-[12.5px] text-foreground-lighter">
              Already have an account?{" "}
              <AuthInlineLink href="/login">Log in</AuthInlineLink>
            </div>
          </CardContent>
        </Card>
      </AuthShell>
    </AuthPageFrame>
  );
}

/**
 * LoginScreen renders the dedicated sign-in page.
 *
 * @param returnTo Optional in-app path to visit after login.
 * @returns Login route content.
 */
export function LoginScreen({ returnTo }: { returnTo?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitLogin = () => {
    startTransition(async () => {
      setErrorMessage(null);

      try {
        const response = await authClient.signIn.email({
          email,
          password,
          rememberMe: true,
        });

        if (response.error) {
          setErrorMessage(response.error.message || "Unable to log in.");
          return;
        }

        router.push(resolveAuthRedirect(returnTo ?? null, "/dashboard"));
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to log in.",
        );
      }
    });
  };

  return (
    <AuthPageFrame>
      <AuthShell>
        <Card>
          <CardHeader>
            <CardTitle>Log in</CardTitle>
            <CardDescription>Welcome back.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3.5 border-b-0">
            <Input
              label="Email"
              type="email"
              placeholder="you@store.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <div>
              <Input
                label="Password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <div className="text-right mt-1.5">
                <Link
                  href="/forgot"
                  className="bg-transparent border-0 p-0 font-inherit text-xs text-foreground-lighter cursor-pointer underline underline-offset-2"
                >
                  Forgot password?
                </Link>
              </div>
            </div>
            {errorMessage && (
              <div className="text-sm text-destructive">{errorMessage}</div>
            )}
          </CardContent>
          <CardContent className="flex flex-col gap-3.5 border-b-0 pt-1">
            <Button
              variant="primary"
              size="medium"
              block
              disabled={!email.trim() || !password || isPending}
              onClick={submitLogin}
            >
              {isPending ? "Logging in..." : "Log in"}
            </Button>
            <div className="text-center text-[12.5px] text-foreground-lighter">
              Don&apos;t have an account?{" "}
              <AuthInlineLink href="/signup">Sign up</AuthInlineLink>
            </div>
          </CardContent>
        </Card>
      </AuthShell>
    </AuthPageFrame>
  );
}

/**
 * ForgotPasswordScreen renders the reset-request form and success state.
 *
 * @returns Forgot-password route content.
 */
export function ForgotPasswordScreen() {
  const [resetSent, setResetSent] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const requestReset = () => {
    startTransition(async () => {
      setErrorMessage(null);

      try {
        const response = await authClient.requestPasswordReset({
          email: forgotEmail,
          redirectTo: "/forgot",
        });

        if (response.error) {
          setErrorMessage(
            response.error.message || "Unable to start password reset.",
          );
          return;
        }

        setResetSent(true);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to start password reset.",
        );
      }
    });
  };

  return (
    <AuthPageFrame>
      <AuthShell>
        <Card>
          {!resetSent ? (
            <>
              <CardHeader>
                <CardTitle>Reset your password</CardTitle>
                <CardDescription>
                  Enter the email on your account and we&apos;ll send a reset
                  link.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3.5 border-b-0">
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@store.com"
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                />
                {errorMessage && (
                  <div className="text-sm text-destructive">{errorMessage}</div>
                )}
              </CardContent>
              <CardContent className="flex flex-col gap-3.5 border-b-0 pt-1">
                <Button
                  variant="primary"
                  size="medium"
                  block
                  disabled={!forgotEmail.trim() || isPending}
                  onClick={requestReset}
                >
                  {isPending ? "Submitting..." : "Send reset link"}
                </Button>
                <div className="text-center text-[12.5px] text-foreground-lighter">
                  <AuthInlineLink href="/login">Back to log in</AuthInlineLink>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center text-center gap-3 border-b-0 py-9 px-6">
              <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center">
                <Check size={20} className="opacity-85" />
              </div>
              <div className="text-[15px] font-semibold">Check your email</div>
              <div className="text-sm text-foreground-lighter leading-[1.5] max-w-[300px]">
                We accepted a password reset request for{" "}
                <strong className="text-foreground font-medium">
                  {forgotEmail || "you@store.com"}
                </strong>
                . Email delivery is not configured in this prototype yet, so no
                reset email was sent.
              </div>
              <div className="text-xs text-foreground-lighter mt-1">
                You can submit another request after mail delivery is wired up.
              </div>
              <div className="mt-2">
                <AuthInlineLink href="/login">Back to log in</AuthInlineLink>
              </div>
            </CardContent>
          )}
        </Card>
      </AuthShell>
    </AuthPageFrame>
  );
}

/**
 * OnboardingScreen renders the dedicated 3-step merchant setup route.
 *
 * @returns Onboarding route content.
 */
export function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletConfirmed, setWalletConfirmed] = useState(false);

  const stepOneDisabled = !storeName.trim();
  const stepTwoDisabled = !walletAddress.trim() || !walletConfirmed;

  return (
    <AuthPageFrame>
      <AuthShell width={460}>
        <OnboardingStepIndicator step={step} />

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
                    PNG or SVG, at least 256x256. Optional - you can add this
                    later.
                  </div>
                </div>
              </div>
              <Input
                label="Store name"
                placeholder="Acme Coffee Co."
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
              />
              <Input
                label="Short description"
                placeholder="Specialty coffee beans & equipment"
                value={storeDescription}
                onChange={(event) => setStoreDescription(event.target.value)}
              />
            </CardContent>
            <CardContent className="flex justify-end border-b-0">
              <Button
                variant="primary"
                size="medium"
                disabled={stepOneDisabled}
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
                <ShieldCheck size={14} className="shrink-0 mt-0.5 opacity-60" />
                <div>
                  This is where every customer payment is sent directly,
                  wallet-to-wallet. Outpay never holds, custodies, or has access
                  to your funds.
                </div>
              </div>
              <Input
                label="Wallet address (Base)"
                placeholder="0x..."
                value={walletAddress}
                onChange={(event) => setWalletAddress(event.target.value)}
              />
              <div className="flex gap-2 items-start text-xs leading-[1.5] bg-warning/10 border border-border-warning rounded-lg p-3 text-foreground">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>
                  Double-check this address before continuing. Payments on Base
                  cannot be reversed, and Outpay cannot recover funds sent to
                  the wrong wallet.
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
                disabled={stepTwoDisabled}
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
              <CardTitle>You&apos;re all set</CardTitle>
              <CardDescription>
                Review your details - you can change these anytime in settings.
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
                    {storeDescription.trim() || "No description added"}
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
                <ShieldCheck size={14} className="shrink-0 mt-0.5 opacity-60" />
                <div>
                  Checkouts are ready to accept USDC on Base. Payments go
                  straight to your wallet - nothing further to set up.
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
                onClick={() => router.push("/dashboard")}
              >
                Go to dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </AuthShell>
    </AuthPageFrame>
  );
}
