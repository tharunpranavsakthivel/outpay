/**
 * Admin provider health page.
 */

import { AdminTable } from "@/components/admin/AdminTable";
import { withAdminContext } from "@/lib/admin/route";
import { listAdminProviderHealth } from "@/lib/admin/server";

export default async function AdminProviderHealthPage() {
  const healthChecks = await withAdminContext(
    listAdminProviderHealth,
    "/admin/provider-health",
  );

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Provider health</h2>
        <p className="mt-2 text-sm text-foreground-lighter">
          Recent persisted RPC health checks used by failover and
          reconciliation.
        </p>
      </div>
      <AdminTable
        emptyMessage="No provider health checks have been recorded."
        headers={[
          "Provider",
          "Chain",
          "Status",
          "Latency",
          "Block",
          "Checked",
          "Error",
        ]}
        rows={healthChecks.map((check) => [
          check.provider,
          check.chain,
          check.status,
          check.latencyMs === null ? "—" : `${check.latencyMs} ms`,
          check.blockNumber ?? "—",
          check.checkedAt,
          check.error ?? "—",
        ])}
      />
    </section>
  );
}
