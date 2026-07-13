/**
 * Admin reconciliation page.
 */

import { AdminReconciliationForm } from "@/components/admin/AdminClient";

export default function AdminReconciliationPage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Reconciliation</h2>
        <p className="mt-2 text-sm text-foreground-lighter">
          Repair a suspected provider gap by scanning an explicit Base block
          range.
        </p>
      </div>
      <AdminReconciliationForm />
    </section>
  );
}
