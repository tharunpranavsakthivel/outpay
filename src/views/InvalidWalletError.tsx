"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Input } from "../components/ui/Input";

/** Invalid wallet address error state — inline validation on the onboarding wallet step. */
export default function InvalidWalletError() {
  const [walletAddress, setWalletAddress] = useState("0x8f3a2c92e");

  const trimmed = walletAddress.trim();
  const valid = /^0x[a-fA-F0-9]{40}$/.test(trimmed);
  const errorMessage =
    trimmed && !valid
      ? "That doesn't look like a valid wallet address. Base addresses start with 0x and are 42 characters long — double-check it before continuing."
      : "";

  return (
    <div className="min-h-screen bg-background font-sans text-foreground flex items-center justify-center px-5 py-16">
      <div className="w-[460px] max-w-full">
        <div className="text-center mb-7">
          <div className="text-[15px] font-semibold tracking-[-0.01em]">
            Outpay
          </div>
        </div>

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
                wallet-to-wallet. Outpay never holds or custodies your funds.
              </div>
            </div>

            <Input
              label="Wallet address (Base)"
              placeholder="0x…"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              error={errorMessage}
            />

            {!errorMessage && (
              <div className="flex gap-2 items-start text-xs leading-[1.5] bg-warning/10 border border-border-warning rounded-lg p-3 text-foreground">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>
                  Double-check this address before continuing. Payments on Base
                  cannot be reversed, and Outpay cannot recover funds sent to
                  the wrong wallet.
                </div>
              </div>
            )}
          </CardContent>
          <CardContent className="flex justify-end">
            <Button variant="primary" size="medium" disabled={!valid}>
              Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
