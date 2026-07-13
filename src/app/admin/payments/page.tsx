/**
 * Admin payment search page.
 */

import { AdminPaymentSearch } from "@/components/admin/AdminClient";
import { withAdminContext } from "@/lib/admin/route";
import { searchAdminPayments } from "@/lib/admin/server";

export default async function AdminPaymentsPage() {
  const payments = await withAdminContext(
    () => searchAdminPayments(""),
    "/admin/payments",
  );

  return (
    <section className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-foreground-lighter">
          Operational safety net
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Payments</h2>
        <p className="mt-2 max-w-2xl text-sm text-foreground-lighter">
          Find a payment across every merchant by transaction hash, payment
          reference, or checkout ID.
        </p>
      </div>
      <AdminPaymentSearch initialPayments={payments} />
    </section>
  );
}
