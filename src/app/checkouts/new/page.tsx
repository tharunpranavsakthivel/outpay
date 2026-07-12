import { withMerchantContext } from "@/lib/dashboard/route";
import { getCreateCheckoutPageData } from "@/lib/dashboard/server";
import CreateCheckout from "../../../views/CreateCheckout";

/** Route: /checkouts/new */
export default async function CreateCheckoutPage() {
  const data = await withMerchantContext(
    getCreateCheckoutPageData,
    "/checkouts/new",
  );
  return <CreateCheckout initialData={data} />;
}
