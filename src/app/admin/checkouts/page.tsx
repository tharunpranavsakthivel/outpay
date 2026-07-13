/**
 * Admin checkout search page.
 */

import { AdminCheckoutSearch } from "@/components/admin/AdminClient";
import { withAdminContext } from "@/lib/admin/route";
import { searchAdminCheckouts } from "@/lib/admin/server";

export default async function AdminCheckoutsPage() {
  const checkouts = await withAdminContext(
    () => searchAdminCheckouts(""),
    "/admin/checkouts",
  );

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Checkouts</h2>
        <p className="mt-2 text-sm text-foreground-lighter">
          Inspect checkout state and ownership across merchants.
        </p>
      </div>
      <AdminCheckoutSearch initialCheckouts={checkouts} />
    </section>
  );
}
