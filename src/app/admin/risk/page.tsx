/**
 * Admin merchant-risk review page.
 */

import { AdminTable } from "@/components/admin/AdminTable";
import { withAdminContext } from "@/lib/admin/route";
import { listAdminRisk } from "@/lib/admin/server";

export default async function AdminRiskPage() {
  const reviews = await withAdminContext(listAdminRisk, "/admin/risk");

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Risk reviews</h2>
        <p className="mt-2 text-sm text-foreground-lighter">
          Review merchant verification, onboarding, reactivation, and risk
          queues.
        </p>
      </div>
      <AdminTable
        emptyMessage="No merchant reviews have been recorded."
        headers={["Merchant", "Review type", "Status", "Opened"]}
        rows={reviews.map((review) => [
          review.merchantName,
          review.reviewType,
          review.status,
          review.createdAt,
        ])}
      />
    </section>
  );
}
