"use client";

import { ExternalLink } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
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
import { StatusPill } from "../components/ui/StatusPill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/Table";
import { useToast } from "../components/ui/Toast";
import type {
  ApiKeyListItem,
  DevelopersPageData,
  WebhookDeliveryItem,
} from "../lib/dashboard/types";

const DOC_LINKS = [
  {
    description:
      "Create checkouts, inspect status, and use resource-based routes.",
    title: "API reference",
  },
  {
    description:
      "Verify HMAC signatures using the rotated signing secret shown after save.",
    title: "Webhook signature verification",
  },
  {
    description:
      "The checkout flow is currently locked to USDC on Base in the schema.",
    title: "Base network & USDC",
  },
];

const CODE_BLOCK_CREATE = `POST /api/v1/checkouts
Authorization: Bearer ck_test_<prefix>_<secret>
Idempotency-Key: order_4471
Content-Type: application/json

{
  "amount": "124.00",
  "currency": "USDC",
  "chain": "base",
  "successUrl": "https://merchant.example/thanks",
  "cancelUrl": "https://merchant.example/cart",
  "customerEmail": "buyer@example.com",
  "metadata": {
    "orderId": "Order #4471"
  }
}`;

const CODE_BLOCK_CLASS =
  "m-0 p-4 rounded-lg bg-background-surface-200 border border-border font-mono text-xs leading-[1.7] overflow-x-auto whitespace-pre text-foreground";

/**
 * Developers view aligned with schema-backed API keys and webhook records.
 */
export default function Developers({
  initialData,
}: {
  initialData: DevelopersPageData;
}) {
  const [activeTab, setActiveTab] = useState<"keys" | "webhooks" | "docs">(
    "keys",
  );
  const [mode, setMode] = useState<"test" | "live">("test");
  const [keyName, setKeyName] = useState("Dashboard-generated key");
  const [webhookUrl, setWebhookUrl] = useState(initialData.webhookUrl ?? "");
  const [apiKeys, setApiKeys] = useState(initialData.apiKeys);
  const [deliveries, setDeliveries] = useState(initialData.webhookDeliveries);
  const [webhookSecretPrefix, setWebhookSecretPrefix] = useState(
    initialData.webhookSecretPrefix,
  );
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const modeKeys = useMemo(
    () => apiKeys.filter((apiKey) => apiKey.environment === mode),
    [apiKeys, mode],
  );

  const createKey = () => {
    startTransition(async () => {
      setErrorMessage(null);
      setSaveMessage(null);
      setRevealedSecret(null);

      const response = await fetch("/api/developers/api-keys", {
        body: JSON.stringify({
          environment: mode,
          name: keyName,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as
        | {
            apiKey?: ApiKeyListItem;
            error?: { message?: string };
            revealedSecret?: string;
          }
        | { apiKey: ApiKeyListItem; revealedSecret: string };
      const createKeyError = (payload as { error?: { message?: string } }).error
        ?.message;

      if (!response.ok || "error" in payload) {
        const message = createKeyError ?? "Unable to create API key.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      const createdApiKey = payload.apiKey as ApiKeyListItem;
      const nextSecret = payload.revealedSecret as string;
      setApiKeys((current) => [createdApiKey, ...current]);
      setRevealedSecret(nextSecret);
      setSaveMessage(
        "API key created. Copy the secret now; it will not be shown again.",
      );
      toast.success("API key created.");
    });
  };

  const saveWebhook = () => {
    startTransition(async () => {
      setErrorMessage(null);
      setSaveMessage(null);
      setRevealedSecret(null);

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
            revealedSecret?: string;
          }
        | {
            endpoint: { signing_secret_prefix: string };
            revealedSecret: string;
          };
      const saveWebhookError = (payload as { error?: { message?: string } })
        .error?.message;

      if (!response.ok || "error" in payload) {
        const message = saveWebhookError ?? "Unable to save webhook.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      const nextEndpoint = payload.endpoint as {
        signing_secret_prefix: string;
      };
      setWebhookSecretPrefix(nextEndpoint.signing_secret_prefix);
      setRevealedSecret(payload.revealedSecret as string);
      setSaveMessage(
        "Webhook endpoint saved. Copy the rotated signing secret now; only the prefix is persisted.",
      );
      toast.success("Webhook endpoint saved.");
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
      const sendWebhookError = (payload as { error?: { message?: string } })
        .error?.message;

      if (!response.ok || "error" in payload) {
        const message = sendWebhookError ?? "Unable to queue test delivery.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      const deliveriesResponse = await fetch(
        "/api/developers/webhook-deliveries",
        {
          cache: "no-store",
        },
      );
      const deliveriesPayload = (await deliveriesResponse.json()) as {
        webhookDeliveries: WebhookDeliveryItem[];
      };

      setDeliveries(deliveriesPayload.webhookDeliveries);
      setSaveMessage("Test webhook queued.");
      toast.success("Test webhook queued.");
    });
  };

  const retryDelivery = (deliveryId: string) => {
    startTransition(async () => {
      setErrorMessage(null);
      setSaveMessage(null);

      const response = await fetch(
        `/api/developers/webhook-deliveries/${deliveryId}/retry`,
        {
          method: "POST",
        },
      );
      const payload = (await response.json()) as
        | { error?: { message?: string } }
        | Record<string, unknown>;
      const retryError = (payload as { error?: { message?: string } }).error
        ?.message;

      if (!response.ok || "error" in payload) {
        const message = retryError ?? "Unable to retry webhook delivery.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      const deliveriesResponse = await fetch(
        "/api/developers/webhook-deliveries",
        {
          cache: "no-store",
        },
      );
      const deliveriesPayload = (await deliveriesResponse.json()) as {
        webhookDeliveries: WebhookDeliveryItem[];
      };

      setDeliveries(deliveriesPayload.webhookDeliveries);
      setSaveMessage("Webhook delivery requeued.");
      toast.success("Webhook delivery requeued.");
    });
  };

  const revokeKey = (apiKeyId: string) => {
    if (
      !window.confirm(
        "Revoke this API key? Requests using this secret will fail immediately.",
      )
    ) {
      return;
    }

    startTransition(async () => {
      setErrorMessage(null);
      setSaveMessage(null);
      setRevealedSecret(null);

      const response = await fetch(`/api/developers/api-keys/${apiKeyId}`, {
        body: JSON.stringify({
          action: "revoke",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const payload = (await response.json()) as
        | {
            apiKey?: ApiKeyListItem;
            error?: { message?: string };
          }
        | { apiKey: ApiKeyListItem };
      const revokeError = (payload as { error?: { message?: string } }).error
        ?.message;

      if (!response.ok || "error" in payload) {
        const message = revokeError ?? "Unable to revoke API key.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      const revokedApiKey = payload.apiKey as ApiKeyListItem;
      setApiKeys((current) =>
        current.map((apiKey) =>
          apiKey.id === revokedApiKey.id ? revokedApiKey : apiKey,
        ),
      );
      setSaveMessage(
        "API key revoked. Requests using it now fail immediately.",
      );
      toast.success("API key revoked.");
    });
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar
        active="developers"
        storeName={initialData.merchant.storeName}
        logoUrl={initialData.merchant.logoUrl}
        userAvatarColor={initialData.merchant.userAvatarColor}
        userName={initialData.merchant.userFullName}
      />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-10 border-b border-border bg-background px-4 pt-4 sm:px-8">
          <h1 className="heading-title m-0 mb-1">Developers</h1>
          <p className="m-0 mb-4 text-xs text-foreground-lighter">
            API keys, checkout API, and signed webhook state from the live
            schema.
          </p>
          <div className="flex items-center gap-5 overflow-x-auto">
            {(["keys", "webhooks", "docs"] as const).map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  "bg-transparent border-0 py-2 text-sm cursor-pointer border-b-2",
                  activeTab === tab
                    ? "border-foreground text-foreground"
                    : "border-transparent text-foreground-lighter",
                ].join(" ")}
              >
                {tab === "keys"
                  ? "API keys"
                  : tab === "webhooks"
                    ? "Webhooks"
                    : "Docs"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex max-w-[840px] flex-col gap-5 px-4 py-6 sm:px-8">
          {saveMessage && (
            <div className="text-sm text-foreground">{saveMessage}</div>
          )}
          {errorMessage && (
            <div className="text-sm text-destructive">{errorMessage}</div>
          )}

          {activeTab === "keys" && (
            <div className="flex flex-col gap-5">
              <div className="inline-flex gap-0.5 p-[3px] border border-border rounded-md bg-background-surface-75 w-fit">
                <button
                  type="button"
                  onClick={() => setMode("test")}
                  className={[
                    "border-0 px-3.5 py-1.5 rounded text-xs font-medium cursor-pointer",
                    mode === "test"
                      ? "bg-card text-foreground"
                      : "bg-transparent text-foreground-lighter",
                  ].join(" ")}
                >
                  Test mode
                </button>
                <button
                  type="button"
                  onClick={() => setMode("live")}
                  className={[
                    "border-0 px-3.5 py-1.5 rounded text-xs font-medium cursor-pointer",
                    mode === "live"
                      ? "bg-card text-foreground"
                      : "bg-transparent text-foreground-lighter",
                  ].join(" ")}
                >
                  Live mode
                </button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Create API key</CardTitle>
                  <CardDescription>
                    Existing keys store only prefix, last four, and secret hash.
                    A newly generated secret is visible once.
                  </CardDescription>
                </CardHeader>
                <CardContent className="border-b-0 flex flex-col gap-3">
                  <Input
                    label="Key name"
                    value={keyName}
                    onChange={(event) => setKeyName(event.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      size="medium"
                      disabled={isPending}
                      onClick={createKey}
                    >
                      Create {mode} key
                    </Button>
                  </div>
                  {revealedSecret && (
                    <div className="rounded-lg border border-border bg-background-surface-200 p-3">
                      <div className="text-xs text-foreground-lighter mb-1">
                        Copy this secret now
                      </div>
                      <div className="font-mono text-sm break-all">
                        {revealedSecret}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {mode === "test" ? "Test" : "Live"} keys
                  </CardTitle>
                  <CardDescription>
                    Stored API key rows for this merchant and environment.
                  </CardDescription>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table className="min-w-[620px]">
                    <TableHeader>
                      <TableRow hoverable={false}>
                        <TableHead>Name</TableHead>
                        <TableHead>Prefix</TableHead>
                        <TableHead>Scopes</TableHead>
                        <TableHead>Last four</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last used</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modeKeys.map((apiKey) => (
                        <TableRow key={apiKey.id}>
                          <TableCell>{apiKey.name}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {apiKey.keyPrefix}
                          </TableCell>
                          <TableCell className="text-xs text-foreground-lighter">
                            {apiKey.scopes.join(", ")}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {apiKey.lastFour}
                          </TableCell>
                          <TableCell>
                            <StatusPill
                              variant={
                                apiKey.status === "active"
                                  ? "success"
                                  : "secondary"
                              }
                            >
                              {apiKey.status}
                            </StatusPill>
                          </TableCell>
                          <TableCell className="text-xs text-foreground-lighter">
                            {apiKey.lastUsedAt ?? "Never"}
                          </TableCell>
                          <TableCell>
                            {apiKey.status === "active" ? (
                              <Button
                                variant="outline"
                                size="small"
                                disabled={isPending}
                                onClick={() => revokeKey(apiKey.id)}
                              >
                                Revoke
                              </Button>
                            ) : (
                              <span className="text-xs text-foreground-lighter">
                                —
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Create a checkout</CardTitle>
                  <CardDescription>
                    Merchant dashboard checkout API
                  </CardDescription>
                </CardHeader>
                <CardContent className="border-b-0 flex flex-col gap-3">
                  <pre className={CODE_BLOCK_CLASS}>{CODE_BLOCK_CREATE}</pre>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "webhooks" && (
            <div className="flex flex-col gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>Webhook endpoint</CardTitle>
                  <CardDescription>
                    The endpoint row stores URL, secret prefix, secret hash, and
                    encrypted signing secret for real outbound delivery.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 border-b-0">
                  <Input
                    label="Endpoint URL"
                    value={webhookUrl}
                    onChange={(event) => setWebhookUrl(event.target.value)}
                  />
                  <div className="text-sm">
                    Secret prefix:{" "}
                    <span className="font-mono">
                      {webhookSecretPrefix ?? "Not configured"}
                    </span>
                  </div>
                  {revealedSecret && (
                    <div className="rounded-lg border border-border bg-background-surface-200 p-3">
                      <div className="text-xs text-foreground-lighter mb-1">
                        Rotated signing secret
                      </div>
                      <div className="font-mono text-sm break-all">
                        {revealedSecret}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="medium"
                      disabled={isPending}
                      onClick={sendTestWebhook}
                    >
                      Send test webhook
                    </Button>
                    <Button
                      variant="primary"
                      size="medium"
                      disabled={isPending}
                      onClick={saveWebhook}
                    >
                      Save & rotate secret
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Delivery history</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table className="min-w-[620px]">
                    <TableHeader>
                      <TableRow hoverable={false}>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Delivery</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead>HTTP</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveries.map((delivery) => (
                        <TableRow key={delivery.id}>
                          <TableCell className="text-foreground-light text-[12.5px] whitespace-nowrap">
                            {delivery.createdAt}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground-light">
                            {delivery.eventType}
                          </TableCell>
                          <TableCell>
                            <StatusPill
                              variant={
                                delivery.deliveryStatus === "delivered"
                                  ? "success"
                                  : delivery.deliveryStatus === "failed"
                                    ? "destructive"
                                    : "warning"
                              }
                            >
                              {delivery.deliveryStatus}
                            </StatusPill>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground-light">
                            {delivery.outcome}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground-light">
                            {delivery.responseStatusCode ?? "—"}
                          </TableCell>
                          <TableCell>
                            {delivery.canRetry ? (
                              <Button
                                variant="outline"
                                size="small"
                                disabled={isPending}
                                onClick={() => retryDelivery(delivery.id)}
                              >
                                Retry
                              </Button>
                            ) : (
                              <span className="text-xs text-foreground-lighter">
                                —
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Latest webhook payload</CardTitle>
                  <CardDescription>
                    Last stored `checkout.paid` payload from `webhook_events`
                  </CardDescription>
                </CardHeader>
                <CardContent className="border-b-0">
                  <pre className={CODE_BLOCK_CLASS}>
                    {initialData.lastWebhookPayload}
                  </pre>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "docs" && (
            <div className="flex flex-col gap-3">
              {DOC_LINKS.map((doc) => (
                <Card key={doc.title}>
                  <CardContent className="flex flex-col gap-3 border-b-0 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium">{doc.title}</div>
                      <div className="text-xs text-foreground-lighter mt-0.5">
                        {doc.description}
                      </div>
                    </div>
                    <ExternalLink size={15} className="opacity-50" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
