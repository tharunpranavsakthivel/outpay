"use client";

import { AlertTriangle, Lock, ShieldCheck } from "lucide-react";
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
import { Checkbox } from "../components/ui/Checkbox";
import { Input } from "../components/ui/Input";

const STORE_NAME = "Acme Coffee Co.";

/** Store settings: profile, payout wallet (+ change modal), webhook endpoint, payment options, danger zone (+ deactivate modal). */
export default function Settings() {
  const [storeName, setStoreName] = useState(STORE_NAME);
  const [storeDesc, setStoreDesc] = useState(
    "Specialty coffee beans & equipment",
  );
  const [supportEmail, setSupportEmail] = useState("support@acmecoffee.com");
  const [webhookUrl, setWebhookUrl] = useState(
    "https://acmecoffee.com/webhooks/outpay",
  );
  const [walletAddress, setWalletAddress] = useState(
    "0x4d92c8A1e5Bf0d3a6C71298fE4b0d9A2c1e0aa10",
  );
  const [modal, setModal] = useState<"wallet" | "deactivate" | null>(null);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [walletConfirmed, setWalletConfirmed] = useState(false);
  const [deactivateConfirmText, setDeactivateConfirmText] = useState("");

  const walletConfirmDisabled = !walletConfirmed || !newWalletAddress;
  const deactivateDisabled = deactivateConfirmText.trim() !== STORE_NAME;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar active="settings" />
      <main className="flex-1 min-w-0 flex flex-col relative">
        <div className="sticky top-0 z-10 bg-background px-8 py-4 border-b border-border">
          <h1 className="heading-title m-0">Settings</h1>
          <p className="m-0 mt-1 text-xs text-foreground-lighter">
            Store profile, payout wallet, webhook, and payment options.
          </p>
        </div>

        <div className="px-8 py-6 max-w-[680px] flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Store profile</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 border-b-0">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-xl bg-accent shrink-0" />
                <div>
                  <Button variant="outline" size="tiny">
                    Upload logo
                  </Button>
                  <div className="text-[11px] text-foreground-lighter mt-1.5">
                    PNG or SVG, at least 256×256
                  </div>
                </div>
              </div>
              <Input
                label="Store name"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
              <Input
                label="Store description"
                value={storeDesc}
                onChange={(e) => setStoreDesc(e.target.value)}
              />
              <Input
                label="Support email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
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
              <CardTitle>Payout wallet</CardTitle>
              <CardDescription>
                Every payment goes directly to this address — Outpay never holds
                or custodies funds.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5 border-b-0">
              <div>
                <div className="text-sm font-medium mb-1.5">
                  Wallet address (Base)
                </div>
                <div className="h-[38px] border border-border-control rounded-sm bg-foreground/[0.026] flex items-center px-3 font-mono text-sm text-foreground overflow-hidden break-all">
                  {walletAddress}
                </div>
              </div>
              <div className="flex gap-2 items-start text-xs leading-[1.5] bg-background-surface-200 border border-border rounded-lg p-3 text-foreground-light">
                <ShieldCheck size={14} className="shrink-0 mt-0.5 opacity-60" />
                <div>
                  This is where all payments are sent directly, non-custodially.
                  Outpay cannot move or access funds sent to this address.
                </div>
              </div>
              <div>
                <Button
                  variant="outline"
                  size="medium"
                  onClick={() => {
                    setModal("wallet");
                    setNewWalletAddress("");
                    setWalletConfirmed(false);
                  }}
                >
                  Change wallet
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhook endpoint</CardTitle>
              <CardDescription>
                Receives signed checkout.paid events
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2 items-end border-b-0">
              <div className="flex-1">
                <Input
                  label="Endpoint URL"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
              </div>
              <Button variant="outline" size="medium">
                Send test
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment options</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5 border-b-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">USDC on Base</div>
                  <div className="text-xs text-foreground-lighter">
                    Fixed for this MVP — cannot be changed
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-foreground-lighter border border-border rounded-full px-2.5 py-1">
                  <Lock size={11} className="opacity-60" /> Locked
                </div>
              </div>
              <div className="text-xs text-foreground-lighter leading-[1.5]">
                More networks and assets (additional chains, USDT) are planned
                for a future release.
              </div>
            </CardContent>
          </Card>

          <Card className="border-border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger zone</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between border-b-0">
              <div>
                <div className="text-sm font-medium">Deactivate store</div>
                <div className="text-xs text-foreground-lighter mt-0.5 max-w-[420px]">
                  Immediately disables new checkouts. Existing links stop
                  accepting payment. This can be reversed by contacting support.
                </div>
              </div>
              <Button
                variant="danger"
                size="medium"
                onClick={() => {
                  setModal("deactivate");
                  setDeactivateConfirmText("");
                }}
              >
                Deactivate
              </Button>
            </CardContent>
          </Card>
        </div>

        {modal === "wallet" && (
          <>
            <button
              type="button"
              aria-label="Close wallet dialog"
              onClick={() => setModal(null)}
              className="fixed inset-0 bg-foreground/45 z-30 animate-[op-scrim-in_0.15s_ease] border-0 p-0"
            />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] max-w-[92vw] bg-card border border-border rounded-xl shadow-lg z-40 animate-[op-modal-in_0.18s_ease-out]">
              <div className="px-6 py-5 border-b border-border text-[15px] font-semibold">
                Change payout wallet
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="flex gap-2 items-start text-xs leading-[1.5] bg-warning/10 border border-border-warning rounded-lg p-3 text-foreground">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    All future payments will be sent to the new address.
                    Double-check it — Outpay cannot recover funds sent to the
                    wrong wallet.
                  </div>
                </div>
                <Input
                  label="New wallet address (Base)"
                  placeholder="0x…"
                  value={newWalletAddress}
                  onChange={(e) => setNewWalletAddress(e.target.value)}
                />
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    checked={walletConfirmed}
                    onChange={setWalletConfirmed}
                  />
                  <span className="text-[12.5px] text-foreground-light leading-[1.5]">
                    I confirm this address is correct and controlled by me.
                    Payments cannot be reversed.
                  </span>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
                <Button
                  variant="text"
                  size="medium"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="medium"
                  disabled={walletConfirmDisabled}
                  onClick={() => {
                    setWalletAddress(newWalletAddress);
                    setModal(null);
                  }}
                >
                  Confirm change
                </Button>
              </div>
            </div>
          </>
        )}

        {modal === "deactivate" && (
          <>
            <button
              type="button"
              aria-label="Close deactivate dialog"
              onClick={() => setModal(null)}
              className="fixed inset-0 bg-foreground/45 z-30 animate-[op-scrim-in_0.15s_ease] border-0 p-0"
            />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] max-w-[92vw] bg-card border border-border-destructive rounded-xl shadow-lg z-40 animate-[op-modal-in_0.18s_ease-out]">
              <div className="px-6 py-5 border-b border-border text-[15px] font-semibold text-destructive">
                Deactivate {STORE_NAME}?
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="text-sm text-foreground leading-[1.5]">
                  This immediately disables all checkout links. Customers will
                  not be able to complete new payments until reactivated by
                  support.
                </div>
                <div>
                  <div className="text-sm font-medium mb-1.5">
                    Type <strong className="font-mono">{STORE_NAME}</strong> to
                    confirm
                  </div>
                  <Input
                    placeholder={STORE_NAME}
                    value={deactivateConfirmText}
                    onChange={(e) => setDeactivateConfirmText(e.target.value)}
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
                <Button
                  variant="text"
                  size="medium"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="medium"
                  disabled={deactivateDisabled}
                  onClick={() => setModal(null)}
                >
                  Deactivate store
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
