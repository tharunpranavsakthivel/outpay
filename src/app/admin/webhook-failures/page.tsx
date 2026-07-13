/**
 * Admin webhook failure page.
 */

import { AdminWebhookFailuresPanel } from "@/components/admin/AdminClient";
import { withAdminContext } from "@/lib/admin/route";
import { listAdminWebhookFailures } from "@/lib/admin/server";

export default async function AdminWebhookFailuresPage() {
  const failures = await withAdminContext(
    listAdminWebhookFailures,
    "/admin/webhook-failures",
  );

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Webhook failures</h2>
        <p className="mt-2 text-sm text-foreground-lighter">
          Retry exhausted merchant deliveries through the durable webhook
          worker.
        </p>
      </div>
      <AdminWebhookFailuresPanel initialFailures={failures} />
    </section>
  );
}
