"use client";

import { AlertTriangle, Lock, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { DashboardSidebar } from "../components/layout/DashboardSidebar";
import { StoreLogoUploader } from "../components/settings/StoreLogoUploader";
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
import { StatusPill } from "../components/ui/StatusPill";
import { Switch } from "../components/ui/Switch";
import { useToast } from "../components/ui/Toast";
import { WalletVerificationPanel } from "../components/wallet/WalletVerificationPanel";
import {
  formatDashboardDate,
  formatUsd,
  truncateIdentifier,
} from "../lib/dashboard/format";
import type {
  StoreSettingsData,
  WalletChangeHistoryItem,
} from "../lib/dashboard/types";
import {
  type FieldErrors,
  getApiErrorMessage,
  getApiFieldErrors,
  hasApiError,
} from "../lib/validation/client";
import type { WalletSignatureProof } from "../lib/wallet/browser-wallet";

/**
 * Renders one merchant-scoped payout-wallet replacement with both wallet
 * endpoints, status, timestamp, and requester metadata.
 */
function WalletChangeHistoryRow({
  change,
}: {
  change: WalletChangeHistoryItem;
}) {
  return (
    <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">
          {formatDashboardDate(change.createdAt)}
        </div>
        <StatusPill>{change.status}</StatusPill>
      </div>
      <div className="grid gap-1 text-xs text-foreground-lighter sm:grid-cols-[auto_1fr] sm:gap-x-3">
        <span>Previous wallet</span>
        <span
          className="font-mono break-all"
          title={change.oldWalletAddress ?? "No previous wallet"}
        >
          {change.oldWalletAddress
            ? truncateIdentifier(change.oldWalletAddress)
            : "No previous wallet"}
        </span>
        <span>New wallet</span>
        <span className="font-mono break-all" title={change.newWalletAddress}>
          {truncateIdentifier(change.newWalletAddress)}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-lighter">
        {change.appliedAt && (
          <span>Applied {formatDashboardDate(change.appliedAt)}</span>
        )}
        {change.requestedBy && <span>Requested by {change.requestedBy}</span>}
      </div>
      {change.notes && (
        <div className="text-xs text-foreground-light">{change.notes}</div>
      )}
    </div>
  );
}

/**
 * Merchant settings view backed by merchants, wallet_addresses, and
 * webhook_endpoints.
 */
export default function Settings({
  initialData,
}: {
  initialData: StoreSettingsData;
}) {
  const canManageSensitiveActions =
    initialData.merchant.role === "owner" ||
    initialData.merchant.role === "admin";
  const [storeName, setStoreName] = useState(initialData.merchant.storeName);
  const [storeDesc, setStoreDesc] = useState(
    initialData.merchant.description ?? "",
  );
  const [supportEmail, setSupportEmail] = useState(
    initialData.merchant.supportEmail ?? "",
  );
  const [websiteUrl, setWebsiteUrl] = useState(initialData.websiteUrl ?? "");
  const [directorySummary, setDirectorySummary] = useState(
    initialData.directorySummary ?? "",
  );
  const [isDirectoryListed, setIsDirectoryListed] = useState(
    initialData.isDirectoryListed,
  );
  const [webhookUrl, setWebhookUrl] = useState(initialData.webhookUrl ?? "");
  const [walletAddress, setWalletAddress] = useState(
    initialData.payoutWallet ?? "",
  );
  const [modal, setModal] = useState<"wallet" | "deactivate" | null>(null);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [walletConfirmed, setWalletConfirmed] = useState(false);
  const [walletProof, setWalletProof] = useState<WalletSignatureProof | null>(
    null,
  );
  const [deactivateConfirmText, setDeactivateConfirmText] = useState("");
  const [storeSecretPrefix, setStoreSecretPrefix] = useState(
    initialData.webhookSecretPrefix,
  );
  const [lastWebhookTestAt, setLastWebhookTestAt] = useState(
    initialData.lastWebhookTestAt,
  );
  const [walletChangeHistory, setWalletChangeHistory] = useState(
    initialData.walletChangeHistory,
  );
  const [profileErrors, setProfileErrors] = useState<FieldErrors>({});
  const [walletErrors, setWalletErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const walletVerified =
    walletProof !== null &&
    walletProof.address.toLowerCase() === newWalletAddress.trim().toLowerCase();
  const walletConfirmDisabled =
    !walletConfirmed || !newWalletAddress || !walletVerified;

  const updateNewWalletAddress = (nextAddress: string) => {
    setNewWalletAddress(nextAddress);
    setWalletProof((current) =>
      current && current.address.toLowerCase() === nextAddress.toLowerCase()
        ? current
        : null,
    );
  };
  const deactivateDisabled =
    deactivateConfirmText.trim() !== initialData.merchant.storeName;

  const saveProfile = () => {
    startTransition(async () => {
      setProfileErrors({});
      const response = await fetch("/api/settings/store-profile", {
        body: JSON.stringify({
          description: storeDesc,
          ...(canManageSensitiveActions
            ? {
                directorySummary,
                isDirectoryListed,
              }
            : {}),
          storeName,
          supportEmail,
          websiteUrl,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const payload: unknown = await response.json();

      if (!response.ok || hasApiError(payload)) {
        setProfileErrors(getApiFieldErrors(payload));
        toast.error(getApiErrorMessage(payload, "Unable to save profile."));
        return;
      }

      toast.success("Store profile saved.");
    });
  };

  const saveWallet = () => {
    if (!canManageSensitiveActions) return;

    startTransition(async () => {
      setWalletErrors({});
      const response = await fetch("/api/settings/payout-wallet", {
        body: JSON.stringify({
          confirmed: walletConfirmed,
          walletAddress: newWalletAddress,
          walletSignature: walletProof?.signature ?? "",
          walletSignatureTimestampMs: walletProof?.timestampMs ?? 0,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload: unknown = await response.json();

      if (!response.ok || hasApiError(payload)) {
        setWalletErrors(getApiFieldErrors(payload));
        toast.error(getApiErrorMessage(payload, "Unable to update wallet."));
        return;
      }

      const walletPayload = payload as { walletAddress: string };
      setWalletAddress(walletPayload.walletAddress);
      setModal(null);
      setWalletProof(null);

      try {
        const historyResponse = await fetch("/api/settings/store-profile");
        const historyPayload: unknown = await historyResponse.json();
        if (
          !historyResponse.ok ||
          typeof historyPayload !== "object" ||
          historyPayload === null ||
          !Array.isArray(
            (historyPayload as { walletChangeHistory?: unknown })
              .walletChangeHistory,
          )
        ) {
          throw new Error(
            "Wallet history refresh returned an invalid response.",
          );
        }

        setWalletChangeHistory(
          (historyPayload as { walletChangeHistory: WalletChangeHistoryItem[] })
            .walletChangeHistory,
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? "Wallet changed, but history could not be refreshed. Reload Settings to see it."
            : "Wallet changed, but history could not be refreshed.",
        );
      }

      toast.success("Primary payout wallet updated.");
    });
  };

  const saveWebhook = () => {
    if (!canManageSensitiveActions) return;

    startTransition(async () => {
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
        toast.error(webhookError ?? "Unable to update webhook.");
        return;
      }

      setStoreSecretPrefix(
        (payload as { endpoint: { signing_secret_prefix?: string } }).endpoint
          .signing_secret_prefix ?? null,
      );
      toast.success("Webhook endpoint saved and signing secret rotated.");
    });
  };

  const sendTestWebhook = () => {
    startTransition(async () => {
      const response = await fetch("/api/developers/webhook-endpoint", {
        method: "POST",
      });
      const payload = (await response.json()) as
        | { error?: { message?: string } }
        | Record<string, unknown>;
      const testWebhookError = (payload as { error?: { message?: string } })
        .error?.message;

      if (!response.ok || "error" in payload) {
        toast.error(testWebhookError ?? "Unable to send test webhook.");
        return;
      }

      const now = new Date().toISOString();
      setLastWebhookTestAt(now);
      toast.success("Test webhook queued.");
    });
  };

  const confirmDeactivate = () => {
    if (!canManageSensitiveActions) return;

    startTransition(async () => {
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
        toast.error(deactivateError ?? "Unable to deactivate store.");
        return;
      }

      setModal(null);
      toast.success("Store marked as deactivated.");
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
      <main className="flex-1 min-w-0 flex flex-col relative">
        <div className="sticky top-0 z-10 bg-background px-8 py-4 border-b border-border">
          <h1 className="heading-title m-0">Settings</h1>
          <p className="m-0 mt-1 text-xs text-foreground-lighter">
            Store profile, payout wallet, webhook endpoint, and merchant status.
          </p>
        </div>

        <div className="px-8 py-6 max-w-[680px] flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Store profile</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 border-b-0">
              <StoreLogoUploader
                initialLogoUrl={initialData.merchant.logoUrl}
              />
              <Input
                label="Store name"
                value={storeName}
                error={profileErrors.storeName}
                onChange={(event) => setStoreName(event.target.value)}
              />
              <Input
                label="Store description"
                value={storeDesc}
                error={profileErrors.description}
                onChange={(event) => setStoreDesc(event.target.value)}
              />
              <Input
                label="Support email"
                value={supportEmail}
                error={profileErrors.supportEmail}
                onChange={(event) => setSupportEmail(event.target.value)}
              />
              <Input
                label="Website URL"
                value={websiteUrl}
                error={profileErrors.websiteUrl}
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
              <CardTitle>Billing &amp; usage</CardTitle>
              <CardDescription>
                Confirmed paid payments are metered monthly. Unpaid, expired,
                and failed payments do not count.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 border-b-0">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-foreground-lighter">Plan</div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {initialData.billing.planName}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-foreground-lighter">
                    Paid this month
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {initialData.billing.paidCheckoutCount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-foreground-lighter">
                    Free remaining
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {Math.max(
                      0,
                      initialData.billing.freeAllowanceCount -
                        initialData.billing.paidCheckoutCount,
                    ).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-foreground-lighter">
                    Platform fees
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {formatUsd(initialData.billing.platformFeeUsd)}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-foreground-lighter">
                <span>
                  {initialData.billing.billableCheckoutCount.toLocaleString()}{" "}
                  billable payments
                </span>
                <span>
                  {formatUsd(initialData.billing.grossVolumeUsd)} gross volume
                </span>
                <span>
                  {(Number(initialData.billing.usageFeeRate) * 100).toFixed(2)}%{" "}
                  after the allowance
                </span>
                <span>
                  Resets{" "}
                  {formatDashboardDate(
                    `${initialData.billing.usageMonth}T00:00:00.000Z`,
                  )}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Store directory</CardTitle>
              <CardDescription>
                Let buyers discover this store on Outpay&apos;s public
                directory. Only active stores appear.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 border-b-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">List this store</div>
                  <div className="text-xs text-foreground-lighter mt-0.5">
                    Your store name, logo, website, and directory summary will
                    be public.
                  </div>
                </div>
                <Switch
                  ariaLabel="List this store in the public directory"
                  checked={isDirectoryListed}
                  disabled={!canManageSensitiveActions || isPending}
                  onChange={setIsDirectoryListed}
                />
              </div>
              <label
                className="flex flex-col gap-1.5 font-sans"
                htmlFor="directory-summary"
              >
                <span className="text-sm font-medium text-foreground">
                  Directory summary
                </span>
                <textarea
                  id="directory-summary"
                  className="min-h-[96px] w-full resize-y rounded-sm border border-border-control bg-foreground/[0.026] px-3 py-2 font-sans text-sm outline-none transition-shadow duration-150 focus:shadow-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canManageSensitiveActions || isPending}
                  maxLength={1000}
                  value={directorySummary}
                  onChange={(event) => setDirectorySummary(event.target.value)}
                />
                <span className="text-xs text-foreground-lighter">
                  {directorySummary.length}/1000 characters
                </span>
              </label>
              {!canManageSensitiveActions && (
                <div className="text-xs text-foreground-lighter">
                  Only owners and admins can change directory visibility.
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="medium"
                  disabled={isPending || !canManageSensitiveActions}
                  title={
                    canManageSensitiveActions
                      ? undefined
                      : "Only owners and admins can update directory settings."
                  }
                  onClick={saveProfile}
                >
                  Save directory settings
                </Button>
              </div>
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
                  disabled={!canManageSensitiveActions}
                  title={
                    canManageSensitiveActions
                      ? undefined
                      : "Only owners and admins can change the payout wallet."
                  }
                  onClick={() => {
                    setModal("wallet");
                    setNewWalletAddress("");
                    setWalletConfirmed(false);
                    setWalletProof(null);
                  }}
                >
                  Change wallet
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Wallet change history</CardTitle>
              <CardDescription>
                An audit trail of payout-wallet replacements for this store.
              </CardDescription>
            </CardHeader>
            <CardContent className="border-b-0">
              {walletChangeHistory.length > 0 ? (
                <div className="flex flex-col divide-y divide-border">
                  {walletChangeHistory.map((change) => (
                    <WalletChangeHistoryRow key={change.id} change={change} />
                  ))}
                </div>
              ) : (
                <div className="py-3 text-sm text-foreground-lighter">
                  No payout-wallet changes have been recorded.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhook endpoint</CardTitle>
              <CardDescription>
                Signed `checkout.paid` events are delivered from the
                `webhook_endpoints` configuration using an encrypted-at-rest
                signing secret.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 border-b-0">
              <Input
                label="Endpoint URL"
                value={webhookUrl}
                disabled={!canManageSensitiveActions}
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
                  disabled={isPending || !canManageSensitiveActions}
                  title={
                    canManageSensitiveActions
                      ? undefined
                      : "Only owners and admins can update webhook configuration."
                  }
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
                  This revokes active API keys, disables webhook endpoints,
                  expires unpaid checkout links, and blocks new checkouts until
                  the store is reactivated by support.
                </div>
              </div>
              <Button
                variant="danger"
                size="medium"
                disabled={!canManageSensitiveActions}
                title={
                  canManageSensitiveActions
                    ? undefined
                    : "Only owners and admins can deactivate the store."
                }
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
                  error={walletErrors.walletAddress}
                  onChange={(event) =>
                    updateNewWalletAddress(event.target.value)
                  }
                />
                <WalletVerificationPanel
                  address={newWalletAddress}
                  onAddressChange={updateNewWalletAddress}
                  proof={walletProof}
                  onProofChange={setWalletProof}
                />
                {(walletErrors.walletSignature ||
                  walletErrors.walletSignatureTimestampMs ||
                  walletErrors.confirmed) && (
                  <div className="text-xs text-destructive" role="alert">
                    {walletErrors.walletSignature ||
                      walletErrors.walletSignatureTimestampMs ||
                      walletErrors.confirmed}
                  </div>
                )}
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
                  This immediately deactivates the store, revokes all active API
                  keys, disables webhook delivery, expires unpaid checkout
                  links, and blocks new checkout creation. Type the exact store
                  name to confirm.
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
