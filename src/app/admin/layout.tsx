/**
 * Shared admin shell. It performs the server-side admin check before any
 * child page can render and never relies on merchant membership roles.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { withAdminContext } from "@/lib/admin/route";
import { requireAdmin } from "@/lib/admin/server";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Admin Dashboard | Outpay",
  description: "Internal Outpay operational dashboard.",
  path: "/admin",
  noIndex: true,
});

const ADMIN_LINKS = [
  ["Payments", "/admin/payments"],
  ["Checkouts", "/admin/checkouts"],
  ["Provider health", "/admin/provider-health"],
  ["Webhook failures", "/admin/webhook-failures"],
  ["Reconciliation", "/admin/reconciliation"],
  ["Merchants", "/admin/merchants"],
  ["Risk", "/admin/risk"],
] as const;

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await withAdminContext(() => requireAdmin(), "/admin");

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8">
      <header className="mx-auto flex max-w-[1440px] flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-foreground-lighter">
            Outpay operations
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Admin dashboard</h1>
          <p className="mt-1 text-sm text-foreground-lighter">
            Cross-merchant support tooling · {admin.email}
          </p>
        </div>
        <nav aria-label="Admin navigation" className="flex flex-wrap gap-2">
          {ADMIN_LINKS.map(([label, href]) => (
            <Link
              className="rounded-sm border border-border-strong px-3 py-2 text-sm hover:bg-accent"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1440px] py-8">{children}</main>
    </div>
  );
}
