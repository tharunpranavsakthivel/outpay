/**
 * Admin merchant operations page.
 */

import { AdminMerchantsPanel } from "@/components/admin/AdminClient";
import { withAdminContext } from "@/lib/admin/route";
import { searchAdminMerchants } from "@/lib/admin/server";

export default async function AdminMerchantsPage() {
  const merchants = await withAdminContext(
    () => searchAdminMerchants(""),
    "/admin/merchants",
  );

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Merchants</h2>
        <p className="mt-2 text-sm text-foreground-lighter">
          Search merchant status and disable suspicious accounts after
          exact-name confirmation.
        </p>
      </div>
      <AdminMerchantsPanel initialMerchants={merchants} />
    </section>
  );
}
