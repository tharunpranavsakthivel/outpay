import { withMerchantContext } from "@/lib/dashboard/route";
import { getPaymentsPageData } from "@/lib/dashboard/server";
import Payments from "../../views/Payments";

/** Route: /payments */
export default async function PaymentsPage() {
  const data = await withMerchantContext(getPaymentsPageData, "/payments");
  return <Payments initialData={data} />;
}
