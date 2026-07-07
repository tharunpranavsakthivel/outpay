"use client";

import { AlertTriangle, Lock, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
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
import { formatDashboardDate } from "../lib/dashboard/format";
import type { StoreSettingsData } from "../lib/dashboard/types";

/**
 * Merchant settings view backed by merchants, wallet_addresses, and
 * webhook_endpoints.
 */
export default function Settings({
  initialData,
}: {
  initialData: StoreSettingsData;
}) {
  const [storeName, setStoreName] = useState(initialData.merchant.storeName);
  const [storeDesc, setStoreDesc] = useState(
    initialData.merchant.description ?? "",
  );
  const [supportEmail, setSupportEmail] = useState(
    initialData.merchant.supportEmail ?? "",
  );
  const [websiteUrl, setWebsiteUrl] = useState(initialData.websiteUrl ?? "");
  const [webhookUrl, setWebhookUrl] = useState(initialData.webhookUrl ?? "");
  const [walletAddress, setWalletAddress] = useState(
    initialData.payoutWallet ?? "",
  );
  const [modal, setModal] = useState<"wallet" | "deactivate" | null>(null);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [walletConfirmed, setWalletConfirmed] = useState(false);
  const [deactivateConfirmText, setDeactivateConfirmText] = useState("");
  const [storeSecretPrefix, setStoreSecretPrefix] = useState(
    initialData.webhookSecretPrefix,
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastWebhookTestAt, setLastWebhookTestAt] = useState(
    initialData.lastWebhookTestAt,
  );
  const [isPending, startTransition] = useTransition();

  const walletConfirmDisabled = !walletConfirmed || !newWalletAddress;
  const deactivateDisabled =
    deactivateConfirmText.trim() !== initialData.merchant.storeName;

  const saveProfile = () => {
    startTransition(async () => {
      setErrorMessage(null);
      setSaveMessage(null);

      const response = await fetch("/api/settings/store-profile", {
        body: JSON.stringify({
          description: storeDesc,
          storeName,
          supportEmail,
          websiteUrl,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const payload = (await response.json()) as
        | { error?: { message?: string } }
        | Record<string, unknown>;
      const profileError = (payload as { error?: { message?: string } }).error
        ?.message;

      if (!response.ok || "error" in payload) {
        setErrorMessage(profileError ?? "Unable to save profile.");
        return;
      }

      setSaveMessage("Store profile saved.");
    });
  };

  const saveWallet = () => {
    startTransition(async () => {
      setErrorMessage(null);
      setSaveMessage(null);

      const response = await fetch("/api/settings/payout-wallet", {
        body: JSON.stringify({
          confirmed: walletConfirmed,
          walletAddress: newWalletAddress,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as
        | { error?: { message?: string }; walletAddress?: string }
        | { walletAddress: string };
      const walletError = (payload as { error?: { message?: string } }).error
        ?.message;

      if (!response.ok || "error" in payload) {
        setErrorMessage(walletError ?? "Unable to update wallet.");
        return;
      }

      setWalletAddress((payload as { walletAddress: string }).walletAddress);
      setModal(null);
      setSaveMessage("Primary payout wallet updated.");
    });
  };

  const saveWebhook = () => {
    startTransition(async () => {
      setErrorMessage(null);
      setSaveMessage(null);

      const response = await fetch("/api/developers/webhook-endpoint", {
        body: JSON.stringify({
          url: webhookUrl,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
      });
      const payload = (await response.json()) as
        | {
            endpoint?: { signing_secret_prefix?: string };
            error?: { message?: string };
          }
        | { endpoint: { signing_secret_prefix: string } };
      const webhookError = (payload as { error?: { message?: string } }).error
        ?.message;

      if (!response.ok || "error" in payload) {
        setErrorMessage(webhookError ?? "Unable to update webhook.");
        return;
      }

      setStoreSecretPrefix(
        (payload as { endpoint: { signing_secret_prefix?: string } }).endpoint
          .signing_secret_prefix ?? null,
      );
      setSaveMessage("Webhook endpoint saved and signing secret rotated.");
    });
  };

  const sendTestWebhook = () => {
    startTransition(async () => {
      setErrorMessage(null);
      setSaveMessage(null);

      const response = await fetch("/api/developers/webhook-endpoint", {
        method: "POST",
      });
      const payload = (await response.json()) as
        | { error?: { message?: string } }
        | Record<string, unknown>;
      const testWebhookError = (payload as { error?: { message?: string } })
        .error?.message;

      if (!response.ok || "error" in payload) {
        setErrorMessage(testWebhookError ?? "Unable to send test webhook.");
        return;
      }

      const now = new Date().toISOString();
      setLastWebhookTestAt(now);
      setSaveMessage("Test webhook queued.");
    });
  };

  const confirmDeactivate = () => {
    startTransition(async () => {
      setErrorMessage(null);
      setSaveMessage(null);

      const response = await fetch("/api/settings/store-status", {
        body: JSON.stringify({
          action: "deactivate",
          confirmationText: deactivateConfirmText,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as
        | { error?: { message?: string } }
        | Record<string, unknown>;
      const deactivateError = (payload as { error?: { message?: string } })
        .error?.message;

      if (!response.ok || "error" in payload) {
        setErrorMessage(deactivateError ?? "Unable to deactivate store.");
        return;
      }

      setModal(null);
      setSaveMessage("Store marked as deactivated.");
    });
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar
        active="settings"
        storeName={initialData.merchant.storeName}
      />
      <main className="flex-1 min-w-0 flex flex-col relative">
        <div className="sticky top-0 z-10 bg-background px-8 py-4 border-b border-border">
          <h1 className="heading-title m-0">Settings</h1>
          <p className="m-0 mt-1 text-xs text-foreground-lighter">
            Store profile, payout wallet, webhook endpoint, and merchant status.
          </p>
        </div>

        <div className="px-8 py-6 max-w-[680px] flex flex-col gap-5">
          {saveMessage && (
            <div className="text-sm text-foreground">{saveMessage}</div>
          )}
          {errorMessage && (
            <div className="text-sm text-destructive">{errorMessage}</div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Store profile</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 border-b-0">
              <div className="text-xs text-foreground-lighter leading-[1.5]">
                Logo assets exist in the schema, but this checkout does not yet
                have a storage pipeline. The editable merchant fields below map
                directly to `merchants`.
              </div>
              <Input
                label="Store name"
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
              />
              <Input
                label="Store description"
                value={storeDesc}
                onChange={(event) => setStoreDesc(event.target.value)}
              />
              <Input
                label="Support email"
                value={supportEmail}
                onChange={(event) => setSupportEmail(event.target.value)}
              />
              <Input
                label="Website URL"
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
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
              <CardTitle>Payout wallet</CardTitle>
              <CardDescription>
                Every payment goes directly to this active primary merchant
                wallet.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5 border-b-0">
              <div>
                <div className="text-sm font-medium mb-1.5">
                  Wallet address ({initialData.chainName})
                </div>
                <div className="h-[38px] border border-border-control rounded-sm bg-foreground/[0.026] flex items-center px-3 font-mono text-sm text-foreground overflow-hidden break-all">
                  {walletAddress || "No payout wallet configured"}
                </div>
              </div>
              <div className="flex gap-2 items-start text-xs leading-[1.5] bg-background-surface-200 border border-border rounded-lg p-3 text-foreground-light">
                <ShieldCheck size={14} className="shrink-0 mt-0.5 opacity-60" />
                <div>
                  This address is the live `recipient_wallet_id` target for new
                  checkout sessions. Outpay does not custody funds.
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
                Signed `checkout.paid` events are delivered using the
                `webhook_endpoints` configuration.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 border-b-0">
              <Input
                label="Endpoint URL"
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
              />
              <div className="text-xs text-foreground-lighter">
                Secret prefix: {storeSecretPrefix ?? "Not configured"}
              </div>
              {lastWebhookTestAt && (
                <div className="text-xs text-foreground-lighter">
                  Last test queued: {formatDashboardDate(lastWebhookTestAt)}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="medium"
                  disabled={isPending}
                  onClick={sendTestWebhook}
                >
                  Send test
                </Button>
                <Button
                  variant="primary"
                  size="medium"
                  disabled={isPending}
                  onClick={saveWebhook}
                >
                  Save webhook
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment options</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5 border-b-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">
                    {initialData.tokenSymbol} on {initialData.chainName}
                  </div>
                  <div className="text-xs text-foreground-lighter">
                    This matches the current token and blockchain rows used by
                    checkout creation.
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-foreground-lighter border border-border rounded-full px-2.5 py-1">
                  <Lock size={11} className="opacity-60" /> Locked
                </div>
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
                  This marks the merchant as deactivated and should stop new
                  checkout activity until the store is reactivated.
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
                    The current primary wallet will be marked as replaced and a
                    `wallet_change_requests` entry will be inserted.
                  </div>
                </div>
                <Input
                  label={`New wallet address (${initialData.chainName})`}
                  placeholder="0x…"
                  value={newWalletAddress}
                  onChange={(event) => setNewWalletAddress(event.target.value)}
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
                  disabled={walletConfirmDisabled || isPending}
                  onClick={saveWallet}
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
                Deactivate {initialData.merchant.storeName}?
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="text-sm text-foreground leading-[1.5]">
                  This updates the merchant status to `deactivated`. Type the
                  exact store name to confirm.
                </div>
                <div>
                  <div className="text-sm font-medium mb-1.5">
                    Type{" "}
                    <strong className="font-mono">
                      {initialData.merchant.storeName}
                    </strong>{" "}
                    to confirm
                  </div>
                  <Input
                    placeholder={initialData.merchant.storeName}
                    value={deactivateConfirmText}
                    onChange={(event) =>
                      setDeactivateConfirmText(event.target.value)
                    }
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
                  disabled={deactivateDisabled || isPending}
                  onClick={confirmDeactivate}
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
