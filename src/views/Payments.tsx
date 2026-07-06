"use client";

import { Copy, ExternalLink, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { DashboardSidebar } from "../components/layout/DashboardSidebar";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import {
  StatusPill,
  type StatusPillVariant,
} from "../components/ui/StatusPill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/Table";

type Status = "paid" | "pending" | "failed" | "expired";

interface Payment {
  id: number;
  datetime: string;
  orderRef: string;
  amount: string;
  status: Status;
  sender: string;
  recipient: string;
  hash: string;
  confirmations: number;
  checkoutRef: string;
}

const STATUS_META: Record<
  Status,
  { variant: StatusPillVariant; label: string }
> = {
  paid: { variant: "success", label: "Paid" },
  pending: { variant: "warning", label: "Pending" },
  failed: { variant: "destructive", label: "Failed" },
  expired: { variant: "secondary", label: "Expired" },
};

const PAGE_SIZE = 8;

const RAW: Payment[] = [
  {
    id: 1,
    datetime: "Jul 6, 2026 · 14:32",
    orderRef: "Order #4471",
    amount: "124.00 USDC",
    status: "paid",
    sender: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    recipient: "0x4d92c8A1e5Bf0d3a6C71298fE4b0d9A2c1e0aa10",
    hash: "0x8f2a91b4e6d7c3a0f251b8d9e4c6a7f3b91c91d47a3f",
    confirmations: 24,
    checkoutRef: "chk_8f2a91b4e6d7",
  },
  {
    id: 2,
    datetime: "Jul 6, 2026 · 11:05",
    orderRef: "Order #4470",
    amount: "58.50 USDC",
    status: "pending",
    sender: "0x4A2f9c1D8e6B3a0F5127c8D9e4A6f3B1c911cD09",
    recipient: "0x4d92c8A1e5Bf0d3a6C71298fE4b0d9A2c1e0aa10",
    hash: "0x9e12f4a8b0d6c2e5910a3f7b8c1d4e0a6f9e124d0a",
    confirmations: 2,
    checkoutRef: "chk_9e12f4a8b0d6",
  },
  {
    id: 3,
    datetime: "Jul 5, 2026 · 22:47",
    orderRef: "Order #4469",
    amount: "312.00 USDC",
    status: "paid",
    sender: "0xE81b64f9C0a3e6D2b5108f7A9c4e6B2d0f18f7A2",
    recipient: "0x4d92c8A1e5Bf0d3a6C71298fE4b0d9A2c1e0aa10",
    hash: "0x7c569a4d1e0b6c3f829a5d7e1b9c0a4f6d3c7f2e1",
    confirmations: 41,
    checkoutRef: "chk_7c569a4d1e0b",
  },
  {
    id: 4,
    datetime: "Jul 5, 2026 · 18:14",
    orderRef: "Order #4468",
    amount: "19.99 USDC",
    status: "failed",
    sender: "0x2c9D1e6A8f4b0c3D5217e9A6f1B4c8D0e2a966Ba",
    recipient: "0x4d92c8A1e5Bf0d3a6C71298fE4b0d9A2c1e0aa10",
    hash: "0x1b0d5f2a9c6e3b0d8f174a5c9e2b0d6f3a19a44",
    confirmations: 0,
    checkoutRef: "chk_1b0d5f2a9c6e",
  },
  {
    id: 5,
    datetime: "Jul 4, 2026 · 09:38",
    orderRef: "Order #4467",
    amount: "85.00 USDC",
    status: "paid",
    sender: "0x9F4e2c8A1d6B3f0E5127c9D8a4E6f3B1c90c211",
    recipient: "0x4d92c8A1e5Bf0d3a6C71298fE4b0d9A2c1e0aa10",
    hash: "0xd48a6c1e9b3f0d275a8c4e1b9d0f6a3c7e433c7",
    confirmations: 108,
    checkoutRef: "chk_d48a6c1e9b3f",
  },
  {
    id: 6,
    datetime: "Jul 3, 2026 · 20:02",
    orderRef: "Order #4466",
    amount: "46.25 USDC",
    status: "pending",
    sender: "0x63Ab8f2c1d9E6b0A5327f8C4d1E9b6a0c3ee09",
    recipient: "0x4d92c8A1e5Bf0d3a6C71298fE4b0d9A2c1e0aa10",
    hash: "0x0f6b3a9c1e7d5f280b4a6c9e1d3f0a7b5c67ad2",
    confirmations: 1,
    checkoutRef: "chk_0f6b3a9c1e7d",
  },
  {
    id: 7,
    datetime: "Jul 2, 2026 · 16:29",
    orderRef: "Order #4465",
    amount: "210.00 USDC",
    status: "paid",
    sender: "0x1aC6f3e9b0D2c5A7108e4F6b9C1d3a0e5F27fa11",
    recipient: "0x4d92c8A1e5Bf0d3a6C71298fE4b0d9A2c1e0aa10",
    hash: "0x4e91c7a3b6d0f28e5a1c9d4b7e0f3a6c8d19b7e2",
    confirmations: 63,
    checkoutRef: "chk_4e91c7a3b6d0",
  },
  {
    id: 8,
    datetime: "Jul 1, 2026 · 13:11",
    orderRef: "Order #4464",
    amount: "12.50 USDC",
    status: "expired",
    sender: "0x77bE2a9c6D1f3B0e5A278c9D4e1B6f3a0C82d5e9",
    recipient: "0x4d92c8A1e5Bf0d3a6C71298fE4b0d9A2c1e0aa10",
    hash: "0x2d8f4c1a9b6e3d0f572a8c4e1d9b6f3a0c74e1a5",
    confirmations: 0,
    checkoutRef: "chk_2d8f4c1a9b6e",
  },
  {
    id: 9,
    datetime: "Jun 30, 2026 · 10:47",
    orderRef: "Order #4463",
    amount: "99.00 USDC",
    status: "paid",
    sender: "0xB3e9c1A6f0d2E5b8127c4D9a6E1f3b0C85d29ac4",
    recipient: "0x4d92c8A1e5Bf0d3a6C71298fE4b0d9A2c1e0aa10",
    hash: "0x6a3d9f1c7e0b4a2d685c1e9f3a0b7d4c2e58f0a3",
    confirmations: 152,
    checkoutRef: "chk_6a3d9f1c7e0b",
  },
  {
    id: 10,
    datetime: "Jun 29, 2026 · 08:23",
    orderRef: "Order #4462",
    amount: "33.20 USDC",
    status: "pending",
    sender: "0x5fD2a8c1E6b9D3f0527a4C1e9D6b3f0A82c5e17b",
    recipient: "0x4d92c8A1e5Bf0d3a6C71298fE4b0d9A2c1e0aa10",
    hash: "0x8b0e4a1c9d7f3b26a5c8e1d0f4b7a3c9e6d2f085",
    confirmations: 3,
    checkoutRef: "chk_8b0e4a1c9d7f",
  },
];

const STATUS_OPTIONS: { id: Status | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
  { id: "expired", label: "Expired" },
];

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Full transaction ledger: filters, paginated table, and a right-side payment detail panel. */
export default function Payments() {
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [dateRange, setDateRange] = useState("30d");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return RAW.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.sender.toLowerCase().includes(q) &&
          !p.recipient.toLowerCase().includes(q) &&
          !p.hash.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageSlice = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const selected = RAW.find((p) => p.id === selectedId) ?? null;

  const confirmationNote = (p: Payment) =>
    p.status === "paid"
      ? `Confirmed with ${p.confirmations} block confirmations on Base.`
      : p.status === "pending"
        ? `Detected on-chain, waiting for more confirmations (${p.confirmations} so far).`
        : p.status === "expired"
          ? "This checkout link expired before a payment was detected."
          : "This transaction did not confirm as a valid payment.";

  const fields = (p: Payment) => [
    { label: "Order reference", value: p.orderRef, mono: false },
    { label: "Checkout link ref", value: p.checkoutRef, mono: true },
    { label: "Sender wallet (full)", value: p.sender, mono: true },
    { label: "Recipient wallet (full)", value: p.recipient, mono: true },
    { label: "Transaction hash (full)", value: p.hash, mono: true },
    {
      label: "Block confirmations",
      value: `${p.confirmations} confirmations`,
      mono: false,
    },
    { label: "Timestamp", value: p.datetime, mono: false },
  ];

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <DashboardSidebar active="payments" />
      <main className="flex-1 min-w-0 flex flex-col relative">
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between px-8 py-4 border-b border-border">
          <div>
            <h1 className="heading-title m-0">Payments</h1>
            <p className="m-0 mt-1 text-xs text-foreground-lighter">
              Full transaction ledger for this store.
            </p>
          </div>
          <Button variant="primary" size="medium">
            Create checkout
          </Button>
        </div>

        <div className="px-8 pt-5 pb-10 flex flex-col gap-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex gap-0.5 p-[3px] border border-border rounded-md bg-background-surface-75">
              {STATUS_OPTIONS.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => {
                    setStatusFilter(f.id);
                    setPage(1);
                  }}
                  className={[
                    "border-0 px-3 py-1.5 rounded text-xs font-medium cursor-pointer",
                    statusFilter === f.id
                      ? "bg-card text-foreground"
                      : "bg-transparent text-foreground-lighter",
                  ].join(" ")}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="h-[34px] rounded-sm border border-border-control bg-background text-foreground text-xs px-2.5 font-sans"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>

            <div className="flex-1 min-w-[200px] max-w-[320px] ml-auto">
              <Input
                placeholder="Search by wallet or tx hash…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead>Date / time</TableHead>
                  <TableHead>Order ref</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tx hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageSlice.map((p) => {
                  const meta = STATUS_META[p.status];
                  return (
                    <TableRow
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className="cursor-pointer"
                    >
                      <TableCell className="text-foreground-light text-[12.5px] whitespace-nowrap">
                        {p.datetime}
                      </TableCell>
                      <TableCell className="text-[12.5px] text-foreground-light">
                        {p.orderRef}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        {p.amount}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-foreground-light">
                          {truncate(p.sender)}
                          <Copy
                            size={13}
                            className="cursor-pointer opacity-55"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard
                                ?.writeText(p.sender)
                                .catch(() => {});
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-foreground-light">
                          {truncate(p.recipient)}
                          <Copy
                            size={13}
                            className="cursor-pointer opacity-55"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard
                                ?.writeText(p.recipient)
                                .catch(() => {});
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusPill variant={meta.variant}>
                          {meta.label}
                        </StatusPill>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-foreground-light">
                          {truncate(p.hash)}
                          <ExternalLink
                            size={12}
                            className="cursor-pointer opacity-55"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-foreground-lighter">
              {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="tiny"
                disabled={currentPage <= 1}
                onClick={() => setPage(Math.max(1, currentPage - 1))}
              >
                ← Prev
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setPage(n)}
                  className={[
                    "w-7 h-7 rounded-md text-xs cursor-pointer border",
                    n === currentPage
                      ? "bg-accent border-border-strong text-foreground"
                      : "bg-transparent border-border text-foreground-lighter",
                  ].join(" ")}
                >
                  {n}
                </button>
              ))}
              <Button
                variant="outline"
                size="tiny"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              >
                Next →
              </Button>
            </div>
          </div>
        </div>

        {selected && (
          <>
            <button
              type="button"
              aria-label="Close payment details"
              onClick={() => setSelectedId(null)}
              className="fixed inset-0 bg-foreground/40 z-20 animate-[op-scrim-in_0.18s_ease] border-0 p-0"
            />
            <div className="fixed top-0 right-0 h-screen w-[420px] max-w-[92vw] bg-card border-l border-border shadow-lg z-30 overflow-y-auto animate-[op-panel-in_0.22s_cubic-bezier(0.2,0.8,0.2,1)]">
              <div className="sticky top-0 bg-card flex items-center justify-between px-6 py-4.5 border-b border-border">
                <div className="text-sm font-semibold">Payment detail</div>
                <X
                  size={16}
                  className="cursor-pointer opacity-60"
                  onClick={() => setSelectedId(null)}
                />
              </div>
              <div className="p-6 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div className="text-[26px] font-medium">
                    {selected.amount}
                  </div>
                  <StatusPill variant={STATUS_META[selected.status].variant}>
                    {STATUS_META[selected.status].label}
                  </StatusPill>
                </div>
                <div className="flex flex-col gap-3.5">
                  {fields(selected).map((f) => (
                    <div key={f.label}>
                      <div className="heading-meta text-foreground-lighter mb-1">
                        {f.label}
                      </div>
                      <div
                        className={[
                          "text-sm text-foreground break-all",
                          f.mono ? "font-mono" : "",
                        ].join(" ")}
                      >
                        {f.value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 items-start text-xs leading-[1.5] bg-background-surface-200 border border-border rounded-lg p-3">
                  <ShieldCheck
                    size={14}
                    className="shrink-0 mt-0.5 opacity-60"
                  />
                  <div className="text-foreground-light">
                    {confirmationNote(selected)}
                  </div>
                </div>
                <Button variant="outline" size="medium" block>
                  View on block explorer →
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
