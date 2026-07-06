"use client";

import { ExternalLink } from "lucide-react";
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
import { StatusPill } from "../components/ui/StatusPill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/Table";

const KEYS = {
  test: "OUTPAY_TEST_SECRET_KEY",
  live: "OUTPAY_LIVE_SECRET_KEY",
};
const SECRET = "OUTPAY_WEBHOOK_SIGNING_SECRET";
const maskKey = (key: string) => `${key.slice(0, 10)}${"•".repeat(8)}`;

const DELIVERIES = [
  {
    timestamp: "Jul 6, 2026 · 14:32",
    event: "checkout.paid",
    ok: true,
    code: "200 OK",
  },
  {
    timestamp: "Jul 5, 2026 · 22:47",
    event: "checkout.paid",
    ok: true,
    code: "200 OK",
  },
  {
    timestamp: "Jul 5, 2026 · 18:15",
    event: "checkout.paid",
    ok: false,
    code: "503 Service Unavailable",
  },
  {
    timestamp: "Jul 4, 2026 · 09:39",
    event: "checkout.paid",
    ok: true,
    code: "200 OK",
  },
];

const DOC_LINKS = [
  {
    title: "API reference",
    description: "Full REST reference for checkouts, payments, and webhooks",
  },
  {
    title: "Webhook signature verification",
    description: "How to verify X-Outpay-Signature in your backend",
  },
  {
    title: "Base network & USDC",
    description: "Contract addresses, confirmation thresholds, and finality",
  },
  {
    title: "Client libraries",
    description: "Official Node.js and Python SDKs",
  },
];

const CODE_BLOCK_CREATE = `curl -X POST https://api.outpay.dev/v1/checkouts \\
  -H "Authorization: Bearer OUTPAY_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": "124.00",
    "currency": "USDC",
    "network": "base",
    "label": "Order #4471"
  }'`;

const CODE_BLOCK_RESPONSE = `{
  "id": "ch_8f2a91b4e6d7",
  "status": "pending",
  "amount": "124.00",
  "currency": "USDC",
  "network": "base",
  "checkout_url": "https://outpay.link/c/8f2a91b4e6d7",
  "created_at": "2026-07-06T14:32:00Z"
}`;

const CODE_BLOCK_PAYLOAD = `{
  "event": "checkout.paid",
  "checkout_id": "ch_8f2a91b4",
  "amount": "124.00",
  "currency": "USDC",
  "network": "base",
  "tx_hash": "0x8f2a91b4e6d7c3a0f251b8d9e4c6a7f3b91c91d4",
  "confirmed_at": "2026-07-05T18:42:11Z"
}`;

const CODE_BLOCK_CLASS =
  "m-0 p-4 rounded-lg bg-background-surface-200 border border-border font-mono text-xs leading-[1.7] overflow-x-auto whitespace-pre text-foreground";

/** Developers: API keys / Webhooks / Docs tabs. */
export default function Developers() {
  const [activeTab, setActiveTab] = useState<"keys" | "webhooks" | "docs">(
    "keys",
  );
  const [mode, setMode] = useState<"test" | "live">("test");
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [secretRevealed, setSecretRevealed] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState(
    "https://api.acmecoffee.com/webhooks/outpay",
  );

  const currentKey = KEYS[mode];
  const displayedKey = keyRevealed ? currentKey : maskKey(currentKey);
  const displayedSecret = secretRevealed ? SECRET : maskKey(SECRET);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar active="developers" />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-10 border-b border-border bg-background px-4 pt-4 sm:px-8">
          <h1 className="heading-title m-0 mb-1">Developers</h1>
          <p className="m-0 mb-4 text-xs text-foreground-lighter">
            API keys, checkout API, and signed webhooks.
          </p>
          <div className="flex items-center gap-5 overflow-x-auto">
            {(["keys", "webhooks", "docs"] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setActiveTab(t)}
                className={[
                  "bg-transparent border-0 py-2 text-sm cursor-pointer border-b-2",
                  activeTab === t
                    ? "border-foreground text-foreground"
                    : "border-transparent text-foreground-lighter",
                ].join(" ")}
              >
                {t === "keys"
                  ? "API keys"
                  : t === "webhooks"
                    ? "Webhooks"
                    : "Docs"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex max-w-[800px] flex-col gap-5 px-4 py-6 sm:px-8">
          {activeTab === "keys" && (
            <div className="flex flex-col gap-5">
              <div className="inline-flex gap-0.5 p-[3px] border border-border rounded-md bg-background-surface-75 w-fit">
                <button
                  type="button"
                  onClick={() => {
                    setMode("test");
                    setKeyRevealed(false);
                  }}
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
                  onClick={() => {
                    setMode("live");
                    setKeyRevealed(false);
                  }}
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
                <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Secret key</CardTitle>
                    <CardDescription>
                      {mode === "test"
                        ? "Test keys only create sandbox checkouts — no real USDC moves."
                        : "Live keys create real checkouts. Keep this secret — treat it like a password."}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="tiny"
                    onClick={() => setKeyRevealed(false)}
                    disabled={!keyRevealed}
                  >
                    Hide key
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 border-b-0 sm:flex-row sm:items-center">
                  <div className="flex h-[38px] min-w-0 flex-1 items-center overflow-hidden rounded-sm border border-border-control bg-foreground/[0.026] px-3 font-mono text-sm text-foreground">
                    {displayedKey}
                  </div>
                  <Button
                    variant="outline"
                    size="medium"
                    onClick={() => setKeyRevealed((v) => !v)}
                  >
                    {keyRevealed ? "Hide" : "Reveal"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Create a checkout</CardTitle>
                  <CardDescription>POST /v1/checkouts</CardDescription>
                </CardHeader>
                <CardContent className="border-b-0 flex flex-col gap-3">
                  <pre className={CODE_BLOCK_CLASS}>{CODE_BLOCK_CREATE}</pre>
                  <div className="heading-meta text-foreground-lighter">
                    Response — 201 Created
                  </div>
                  <pre className={CODE_BLOCK_CLASS}>{CODE_BLOCK_RESPONSE}</pre>
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
                    Sent on checkout.paid, signed with HMAC-SHA256
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 border-b-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <Input
                        label="Endpoint URL"
                        value={endpointUrl}
                        onChange={(e) => setEndpointUrl(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1.5">
                      Signing secret
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="flex h-[38px] min-w-0 flex-1 items-center overflow-hidden rounded-sm border border-border-control bg-foreground/[0.026] px-3 font-mono text-sm text-foreground">
                        {displayedSecret}
                      </div>
                      <Button
                        variant="outline"
                        size="medium"
                        onClick={() => setSecretRevealed((v) => !v)}
                      >
                        {secretRevealed ? "Hide" : "Reveal"}
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="secondary" size="medium">
                      Send test webhook
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
                        <TableHead>Status</TableHead>
                        <TableHead>Response</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {DELIVERIES.map((d) => (
                        <TableRow key={`${d.timestamp}-${d.event}`}>
                          <TableCell className="text-foreground-light text-[12.5px] whitespace-nowrap">
                            {d.timestamp}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground-light">
                            {d.event}
                          </TableCell>
                          <TableCell>
                            <StatusPill
                              variant={d.ok ? "success" : "destructive"}
                            >
                              {d.ok ? "Success" : "Failed"}
                            </StatusPill>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground-light">
                            {d.code}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Webhook payload</CardTitle>
                  <CardDescription>
                    checkout.paid — X-Outpay-Signature header carries the HMAC
                  </CardDescription>
                </CardHeader>
                <CardContent className="border-b-0">
                  <pre className={CODE_BLOCK_CLASS}>{CODE_BLOCK_PAYLOAD}</pre>
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
