"use client";

/**
 * Interactive controls for admin searches and operational mutations. All
 * mutations call the server APIs, which repeat the admin guard and audit the
 * action; this client component never carries an authorization claim.
 */

import { type FormEvent, useState, useTransition } from "react";
import type {
  AdminMerchantRecord,
  AdminPaymentRecord,
  AdminWebhookFailureRecord,
} from "../../lib/admin/server";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Input } from "../ui/Input";
import { AdminTable } from "./AdminTable";

type ErrorPayload = { error?: { message?: string } };

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function getErrorMessage(payload: ErrorPayload, fallback: string): string {
  return payload.error?.message ?? fallback;
}

/**
 * Renders cross-merchant payment search by transaction hash or checkout ID.
 */
export function AdminPaymentSearch({
  initialPayments,
}: {
  initialPayments: AdminPaymentRecord[];
}) {
  const [payments, setPayments] = useState(initialPayments);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      const response = await fetch(
        `/api/admin/payments?search=${encodeURIComponent(search)}`,
      );
      const payload = await readJson<
        { payments: AdminPaymentRecord[] } & ErrorPayload
      >(response);
      if (!response.ok) {
        setError(getErrorMessage(payload, "Unable to search payments."));
        return;
      }
      setPayments(payload.payments);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment search</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
          <Input
            aria-label="Transaction hash or checkout ID"
            className="sm:flex-1"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Transaction hash, payment ref, or checkout ID"
            value={search}
          />
          <Button disabled={isPending} type="submit">
            {isPending ? "Searching…" : "Search"}
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AdminTable
          emptyMessage="No payments matched this search."
          headers={[
            "Payment",
            "Merchant",
            "Checkout",
            "Amount",
            "Status",
            "Transaction",
          ]}
          rows={payments.map((payment) => [
            <span className="font-mono text-xs" key={payment.paymentId}>
              {payment.paymentRef}
            </span>,
            <span key={`${payment.paymentId}-merchant`}>
              {payment.merchantName}
            </span>,
            <span
              className="font-mono text-xs"
              key={`${payment.paymentId}-checkout`}
            >
              {payment.checkoutRef}
            </span>,
            <span key={`${payment.paymentId}-amount`}>
              {payment.amountToken} USDC
            </span>,
            <span key={`${payment.paymentId}-status`}>{payment.status}</span>,
            <span
              className="break-all font-mono text-xs"
              key={`${payment.paymentId}-tx`}
            >
              {payment.txHash ?? "—"}
            </span>,
          ])}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Renders exhausted webhook failures and their audited manual retry action.
 */
export function AdminWebhookFailuresPanel({
  initialFailures,
}: {
  initialFailures: AdminWebhookFailureRecord[];
}) {
  const [failures, setFailures] = useState(initialFailures);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const retry = (failure: AdminWebhookFailureRecord) => {
    setRetryingId(failure.deliveryAttemptId);
    setError(null);
    void fetch(
      `/api/admin/webhook-failures/${failure.deliveryAttemptId}/retry`,
      { method: "POST" },
    )
      .then(async (response) => {
        const payload = await readJson<ErrorPayload>(response);
        if (!response.ok) {
          throw new Error(getErrorMessage(payload, "Unable to queue retry."));
        }
        setFailures((current) =>
          current.filter(
            (item) => item.deliveryAttemptId !== failure.deliveryAttemptId,
          ),
        );
      })
      .catch((retryError: unknown) => {
        setError(
          retryError instanceof Error
            ? retryError.message
            : "Unable to queue retry.",
        );
      })
      .finally(() => setRetryingId(null));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exhausted webhook deliveries</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AdminTable
          emptyMessage="No exhausted webhook deliveries need attention."
          headers={[
            "Merchant",
            "Event",
            "Attempt",
            "Response",
            "Endpoint",
            "Action",
          ]}
          rows={failures.map((failure) => [
            <span key={failure.deliveryAttemptId}>{failure.merchantName}</span>,
            <span key={`${failure.deliveryAttemptId}-event`}>
              {failure.eventType}
            </span>,
            <span key={`${failure.deliveryAttemptId}-attempt`}>
              {failure.attemptNumber}
            </span>,
            <span key={`${failure.deliveryAttemptId}-response`}>
              {failure.responseStatusCode ?? "network error"}
            </span>,
            <span key={`${failure.deliveryAttemptId}-endpoint`}>
              {failure.endpointStatus}
            </span>,
            <Button
              disabled={retryingId !== null}
              key={`${failure.deliveryAttemptId}-action`}
              onClick={() => retry(failure)}
              size="tiny"
              variant="warning"
            >
              {retryingId === failure.deliveryAttemptId ? "Queueing…" : "Retry"}
            </Button>,
          ])}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Renders the bounded block-range reconciliation form.
 */
export function AdminReconciliationForm() {
  const [fromBlock, setFromBlock] = useState("");
  const [toBlock, setToBlock] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      setMessage(null);
      setError(null);
      const response = await fetch("/api/admin/reconciliation", {
        body: JSON.stringify({
          chain: "base",
          fromBlock: Number(fromBlock),
          toBlock: Number(toBlock),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await readJson<{ jobId?: string } & ErrorPayload>(
        response,
      );
      if (!response.ok) {
        setError(getErrorMessage(payload, "Unable to queue reconciliation."));
        return;
      }
      setMessage(`Queued ${payload.jobId}.`);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Force reconciliation scan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground-lighter">
          Scans Base USDC transfers across a bounded block range using the
          durable reconciliation queue.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={submit}
        >
          <Input
            aria-label="From block"
            label="From block"
            min="0"
            onChange={(event) => setFromBlock(event.target.value)}
            required
            type="number"
            value={fromBlock}
          />
          <Input
            aria-label="To block"
            label="To block"
            min="0"
            onChange={(event) => setToBlock(event.target.value)}
            required
            type="number"
            value={toBlock}
          />
          <Button className="self-end" disabled={isPending} type="submit">
            {isPending ? "Queueing…" : "Queue scan"}
          </Button>
        </form>
        {message && <p className="text-sm text-success">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Renders merchant search and exact-name-confirmed disable controls.
 */
export function AdminMerchantsPanel({
  initialMerchants,
}: {
  initialMerchants: AdminMerchantRecord[];
}) {
  const [merchants, setMerchants] = useState(initialMerchants);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const findMerchants = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      const response = await fetch(
        `/api/admin/merchants?search=${encodeURIComponent(search)}`,
      );
      const payload = await readJson<
        { merchants: AdminMerchantRecord[] } & ErrorPayload
      >(response);
      if (!response.ok) {
        setError(getErrorMessage(payload, "Unable to search merchants."));
        return;
      }
      setMerchants(payload.merchants);
    });
  };

  const disable = (merchant: AdminMerchantRecord) => {
    const confirmationText = window.prompt(
      `Type "${merchant.displayName}" to disable this merchant.`,
    );
    if (confirmationText === null) return;
    const reason = window.prompt("Reason for disabling this merchant:");
    if (reason === null) return;

    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/admin/merchants/${merchant.id}`, {
        body: JSON.stringify({ confirmationText, reason }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = await readJson<
        { merchant?: AdminMerchantRecord } & ErrorPayload
      >(response);
      if (!response.ok || !payload.merchant) {
        setError(getErrorMessage(payload, "Unable to disable merchant."));
        return;
      }
      setMerchants((current) =>
        current.map((item) =>
          item.id === payload.merchant?.id ? payload.merchant : item,
        ),
      );
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Merchant operations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={findMerchants}
        >
          <Input
            aria-label="Merchant search"
            className="sm:flex-1"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Merchant name, support email, or UUID"
            value={search}
          />
          <Button disabled={isPending} type="submit">
            {isPending ? "Searching…" : "Search"}
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AdminTable
          emptyMessage="No merchants matched this search."
          headers={[
            "Merchant",
            "Status",
            "Support email",
            "Open checkouts",
            "Open reviews",
            "Action",
          ]}
          rows={merchants.map((merchant) => [
            <span key={merchant.id}>{merchant.displayName}</span>,
            <span key={`${merchant.id}-status`}>{merchant.status}</span>,
            <span key={`${merchant.id}-email`}>
              {merchant.supportEmail ?? "—"}
            </span>,
            <span key={`${merchant.id}-checkouts`}>
              {merchant.activeCheckouts}
            </span>,
            <span key={`${merchant.id}-reviews`}>{merchant.reviewCount}</span>,
            merchant.status === "deactivated" ? (
              <span
                className="text-xs text-foreground-lighter"
                key={`${merchant.id}-action`}
              >
                Disabled
              </span>
            ) : (
              <Button
                disabled={isPending}
                key={`${merchant.id}-action`}
                onClick={() => disable(merchant)}
                size="tiny"
                variant="danger"
              >
                Disable
              </Button>
            ),
          ])}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Renders the lightweight checkout search required by the admin route map.
 */
export function AdminCheckoutSearch({
  initialCheckouts,
}: {
  initialCheckouts: import("../../lib/admin/server").AdminCheckoutRecord[];
}) {
  const [checkouts, setCheckouts] = useState(initialCheckouts);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      const response = await fetch(
        `/api/admin/checkouts?search=${encodeURIComponent(search)}`,
      );
      const payload = await readJson<
        { checkouts: typeof initialCheckouts } & ErrorPayload
      >(response);
      if (!response.ok) {
        setError(getErrorMessage(payload, "Unable to search checkouts."));
        return;
      }
      setCheckouts(payload.checkouts);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checkout search</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
          <Input
            aria-label="Checkout search"
            className="sm:flex-1"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Checkout ref, checkout UUID, or merchant"
            value={search}
          />
          <Button disabled={isPending} type="submit">
            {isPending ? "Searching…" : "Search"}
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AdminTable
          emptyMessage="No checkouts matched this search."
          headers={["Checkout", "Merchant", "Amount", "Status", "Created"]}
          rows={checkouts.map((checkout) => [
            <span className="font-mono text-xs" key={checkout.checkoutId}>
              {checkout.checkoutRef}
            </span>,
            <span key={`${checkout.checkoutId}-merchant`}>
              {checkout.merchantName}
            </span>,
            <span key={`${checkout.checkoutId}-amount`}>
              {checkout.amountToken} USDC
            </span>,
            <span key={`${checkout.checkoutId}-status`}>
              {checkout.status}
            </span>,
            <span key={`${checkout.checkoutId}-created`}>
              {checkout.createdAt}
            </span>,
          ])}
        />
      </CardContent>
    </Card>
  );
}
